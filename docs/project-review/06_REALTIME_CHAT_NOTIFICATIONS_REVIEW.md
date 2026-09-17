# 06 — Realtime, Chat & Notifications Review

> Scope: `backend/internal/websocket/`, `backend/internal/chat/`, `backend/internal/notifications/`, `frontend/src/providers/WebSocketProvider.tsx`, `frontend/src/features/{chat,group-chat,notifications}/`. Concurrency/mutex-safety of the transport layer is covered in `03_BACKEND_REVIEW.md`; deep authorization tracing is in `05_AUTH_SECURITY_PRIVACY_REVIEW.md` §10. This file covers business-logic correctness and frontend↔backend state-sync, traced end to end, not inferred from naming.

## Overall Assessment

The realtime transport layer (`Hub`/`Client`) is sound: single-writer-per-connection discipline is respected everywhere, multi-tab/reconnect registration is correct, and the group-chat membership TOCTOU scenario this audit specifically prioritized is **not exploitable** (independently confirmed by two subagents — see `05_AUTH_SECURITY_PRIVACY_REVIEW.md` §10). The notification sync logic is genuinely well-designed — a true id-keyed union merge with a separately race-guarded unread counter, confirmed sound against every race scenario the audit brief asked about. The real gap is a **consistent state-sync hole on WebSocket reconnect**: chat (both private and group) has no resync mechanism, while notifications does — the inconsistency is itself evidence the gap is an oversight, not a design choice.

---

## 1. WebSocket Lifecycle

### Positive findings (Info)

- **Write serialization**: `Client.WritePump` is the only goroutine anywhere in the backend that calls `Conn.WriteMessage`/`Conn.NextWriter` (confirmed via a full-backend grep for direct `Conn.Write*`/`Conn.Read*` calls — only 3 hits, all inside `client.go` itself). All producers go through the non-blocking, buffered `Client.Send`. Gorilla's "one writer at a time" contract is respected everywhere.
- **Multi-tab / reconnect registration**: `Hub.clients` is explicitly `map[int64]map[*Client]bool`, built for multiple simultaneous connections per user; a fresh `*Client` is always created per `ServeWS` call, so a client can never be double-registered under one pointer identity. Directly tested by `hub_test.go`'s multi-tab case.
- **Auth on upgrade**: `ServeWS` requires `requestctx.UserID` (set by session middleware, which runs first) before upgrading — an unauthenticated request never reaches the handler at all.

### WS-001 — Neither private nor group chat resyncs on WebSocket reconnect; incoming messages during a disconnect window go missing from the live UI

**Severity:** High · **Confidence:** High

The frontend `WebSocketProvider` reconnects automatically (~1.5s flat delay after `onclose`, no backoff/cap) and correctly replays **outgoing** events queued while disconnected (`pendingQueueRef`). But there is **no mechanism to recover missed incoming events**: the provider tracks no "last seen" id and requests no resync from the server, and neither `useChat` nor `useGroupChatMessages` has an effect that reacts to the `isConnected` `false→true` transition.

**Concrete, routine repro:** User A and B are chatting. A's laptop sleeps or wifi drops for 20 seconds (a routine occurrence — tab backgrounding on mobile, brief network blips, corporate proxy idle-timeouts) — `ws.onclose` fires, the hub unregisters A, and `hub.SendToUser` silently no-ops for A during this window. B sends 2 messages; they persist correctly to `private_messages` (offline-recipient persistence is solid — `SavePrivateMessage` is unconditional and independent of hub delivery). A's socket reconnects ~1.5s after `onclose`, `isConnected` flips back to `true` — but **nothing reacts to that transition**. B's 2 messages never appear in A's open chat window, and A's unread badge for B doesn't update, until A manually closes/reopens the conversation or reloads the page. This is not a rare edge case; WS reconnects are routine. Data is never lost (DB persistence is solid) — it goes invisible in the live UI, which reads to an end user as "the message never sent" or "chat is broken." Group chat has the identical gap (`useGroupChatMessages`'s initial-load effect is keyed on `[groupId, isMember]` only, not `isConnected`).

**Notably, notifications gets this right** (see §4) — `useNotificationSync` re-fetches on reconnect via its `dataVersionRef`/focus-listener pattern, which is exactly the template this fix should copy.

**Fix:** add an effect in `useChat`/`useGroupChatMessages` keyed on the `isConnected` false→true transition that re-fetches conversations/history (merged/deduped against current state, not replaced) — reusing the pattern notifications already implements correctly.

**Could a test have caught this?** Yes — a WebSocket integration test that disconnects and reconnects a client mid-conversation and asserts the reconnected client eventually sees messages sent during the gap. No such test exists today (confirmed in `08_TESTING_RUNTIME_REVIEW.md`).

---

## 2. Private Chat Correctness

### Send-time permission enforcement — correct, server-side (Info, positive; full detail in `05_AUTH_SECURITY_PRIVACY_REVIEW.md` §9)

Traced the full WS-message-receipt→persist→deliver path: trim/empty/length checks, recipient existence, then `followChecker.CanMessage` — the real, DB-backed permission gate, re-checked on **every send**, not just at connection time. The frontend's eligibility check is confirmed to be UI-cosmetic only.

### No duplicate self-echo (Info, positive)

The backend delivers the persisted message to both sender and recipient (`hub.SendToUser` called twice). This could double-render if the frontend also optimistically inserted on send — it does not: `sendMessage` only calls `sendEvent`, never touches local state directly. The message enters `messages` exclusively via the WS listener, which dedupes by id. Exactly one bubble appears per message.

### WS-003 — Private chat `loadMoreHistory` has no id-based dedup, combined with fixed-offset pagination → duplicate message on a live-arrival race

**Severity:** Medium · **Confidence:** High

`GetPrivateHistory` uses classic offset pagination (`ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`). `useChat.ts`'s `loadMoreHistory` computes the next offset from a **fixed** `historyOffset` state that does not account for new messages arriving via WS in between, and its prepend merge (`setMessages((prev) => [...older, ...prev])`) has **no id-collision check** — unlike the live-message handler, which does dedupe.

**Repro:** user opens a conversation (offset stays 0 after the first fetch). A new live message arrives via WS mid-read (handled correctly, offset untouched). User scrolls up and loads older messages: `offset=20` is used, but because a new row was inserted at the top of the DB-ordered set since the first fetch, the `OFFSET 20` window has shifted by one — it re-returns the message that was already the oldest item of the first page, and because the prepend has no dedup, it renders **twice**.

**Group chat avoids this exact bug class** (see WS-003's counterpart below) via `offset = messages.length` (recomputed live) plus an id-keyed dedup on every merge — this is the correct pattern already present in the same codebase, just not applied to private chat. **Fix:** dedupe `loadMoreHistory`'s merge by id, and/or switch to cursor-based pagination (`before_id`/`before_created_at`).

### Group chat pagination — correctly avoids this bug (Info, positive)

`useGroupChatMessages.loadMoreHistory` uses `offset = messages.length` (live, recomputed at click-time) and routes every merge (initial, live, load-more) through an id-keyed `deduplicateAndSortMessages`. This is the correct pattern; recommend porting it to private chat to fix `WS-003`.

### Positive: empty/whitespace handling, refresh mid-chat — both correct on both sides, no drift

### WS-005 — Redundant `messages_read` broadcast on every `loadMoreHistory` page fetch

**Severity:** Low · **Confidence:** High

`Service.GetHistory` unconditionally calls `MarkMessagesAsRead` and re-broadcasts `messages_read` on **every** call to `/chat/history`, including `offset > 0` "load older" calls. Harmless (idempotent `UPDATE`, frontend receipt handler is itself deduped) but wasteful traffic on every "load older" click.

---

## 3. Group Chat & Membership TOCTOU

See `05_AUTH_SECURITY_PRIVACY_REVIEW.md` §10 for the full authorization trace. Summary: **no TOCTOU bypass exists** — membership is re-checked fresh from the DB at history-load, send, and broadcast-dispatch time independently, with zero caching layer anywhere in between (verified by reading `Hub`, which has no concept of "rooms" at all — every group broadcast resolves N individual `SendToUser` calls from a fresh per-message DB query).

### WS-002 — Group member removal produces no realtime signal to the removed client

**Severity:** Medium · **Confidence:** High

`groups.Service.RemoveMember` never touches the hub — confirmed via grep, no `hub.SendToUser`/`Broadcast` call anywhere in that function, unlike `broadcastEventResponseUpdate` or the existing `follow_removed` event elsewhere in the same codebase, which **do** proactively push a WS event after their respective persisted changes. There is no `group_member_removed` (or similar) event type defined anywhere.

Frontend membership state (`isMember`, from `useMembership`/`useGroupQuery`) is a fetch-once-and-cache-in-memory resource, not invalidated by any WS event and not polled. **Repro:** creator removes member M; M's browser tab has group chat open with an active WS connection. M's `isMember` stays `true` indefinitely; the composer stays enabled. If M sends a message, the backend correctly rejects it (per the TOCTOU finding above) with a generic `error` WS event that surfaces only as `WebSocketProvider`'s generic `errorMessage` string — nothing maps it to "you were removed" or flips `isMember`. M also simply stops receiving new messages with no visible explanation — looks like a frozen connection, not a removal.

**Fix:** broadcast a lightweight event (`group_member_removed`, or reuse the `notification` channel with a dedicated type) right after `RemoveMember` succeeds, and have the group-chat frontend invalidate `isMember` on receipt — mirroring the existing `follow_removed` pattern already in the codebase, which is the right template to copy.

---

## 4. Notification Sync Races

### The "monotonic merge" claim — verified true, and stronger than advertised (Info, positive)

`mergeNotifications` (`frontend/src/features/notifications/utils/mergeNotifications.ts`) is a true **id-keyed union**, seeded from current state and only ever `set()` from incoming data — never reset to incoming-only. Two properties confirmed, not just the one the code's own comment claims:
1. **Read-state is monotonic**: `isRead: incoming.isRead || existing.isRead` — a stale payload can never flip a locally-read notification back to unread.
2. **The list itself cannot lose entries**: a REST refresh that (for any reason — replica lag, timing) doesn't include an id already in local state simply never touches that key; it isn't dropped. This directly answers the audit's key question: out-of-order REST/WS arrival is handled correctly for **both** read-state and full-list-replacement, not just read-state.

### WS-push-before-REST-fetch-completes — verified not lost (Info, positive)

Because both the REST refresh and the WS-push handler use React's functional `setState` form, and the merge is an id-keyed union, the final state converges to the union of both sources regardless of arrival order. `unreadCount` (a raw scalar with no merge safety of its own) is separately protected via a `dataVersionRef` bumped on every WS push/mark-read call — `refresh()` only commits a fetched count if the version hasn't advanced since the fetch started, otherwise it re-fetches. This correctly prevents a stale unread count from clobbering a newer one.

### Mark-as-read vs incoming WS push — no regression found

A legitimate `notification` WS push for a given id can only fire once (at creation, before the user could have read it) and never re-fires with `isRead: false` afterward; combined with the monotonic merge, there is no code path that can un-read an already-read notification.

### Duplicate toast pop-ups — not found

`useNotificationToasts` subscribes exactly once per mount with stable callback dependencies, driven only by live WS pushes, never by the REST-loaded list. Mounted exactly once at the app root. No duplicate-toast mechanism found; two tabs open for the same user each correctly show their own independent toast (expected multi-tab behavior).

### WS-004 — Chat WS-push `created_at` uses second precision (hand-formatted); REST history uses full precision for the same field

**Severity:** Low · **Confidence:** High

`MessagePayload.CreatedAt`/`GroupMessagePayload.CreatedAt` (the live WS push) are explicitly formatted via `savedMsg.CreatedAt.UTC().Format(time.RFC3339)` — second-precision only. The REST history response for the *same message* uses Go's default `time.Time` marshaling — full nanosecond-precision. Both are valid RFC3339 and the frontend dedupes by numeric id (not timestamp string), so this causes no functional bug today, but it's a real inconsistency that would bite any future code that string-compares/hashes on `created_at`, and makes sub-second ordering unreliable for rapid-fire messages arriving at the REST/WS boundary. Notifications, by contrast, reuse the identical struct for both transports (confirmed byte-identical, and intentional per the code's own comment). **Fix:** format chat's WS payload the same way REST does (pass through `time.Time` or format at full precision).

### WS-007 — `read_at` TypeScript type is more permissive than the actual wire contract

**Severity:** Info · **Confidence:** High

`Notification.ReadAt *time.Time \`json:"read_at,omitempty"\`` means the field is **absent** when nil, never explicit `null`. The frontend type allows `string | null`, which the backend never actually sends. Not a functional bug (the frontend's `!= null` check handles both `undefined` and `null` identically) — purely a documentation-accuracy note on the type.

### Info — notification pagination has the same offset-drift characteristic as chat, but it's self-healing here

Same `ORDER BY ... LIMIT ? OFFSET ?` pattern as chat history — a new notification created between page-1 and page-2 fetches can shift the window the same way. Unlike private chat's `loadMoreHistory`, this is harmless: `mergeNotifications` is id-keyed, so a duplicate fetch just overwrites the same map key.

---

## 5. Contract Drift (Frontend TS types vs Go structs/JSON tags)

### Event type enum — fully consistent (Info)

Every `EventType` constant across `websocket/events.go`, `chat/models.go`, `notifications/events.go`, `followers/ws.go`, `groups/event_ws.go` is present, and only these, in the frontend `EventType` union. No stray or missing values.

### Field naming — consistent (Info)

All WS payload field names (`sender_id`, `recipient_id`, `group_id`, `user_id`, `is_typing`, `read_at`, `reader_id`, `actor_id`, `entity_type`, `entity_id`, etc.) match 1:1 between Go `json` tags and TS interfaces. No mismatches found.

---

## 6. Frontend Resource Leaks

### WS-006 — `ChatWindow`'s typing-indicator timer is not cleared on unmount

**Severity:** Low · **Confidence:** High

`typingTimerRef` (`setTimeout(() => onTyping(false), 1500)`, set in `handleInputChange`) is cleared inline on submit but has **no unmount cleanup effect**. If a user is mid-typing and navigates away (switches conversations, leaves the chat page) before the 1500ms timer fires, it still fires after unmount and sends a stray `typing: false` event for a conversation the user may have already left — the semantically-correct value, so low-impact, but a genuine missing-cleanup pattern. **Fix:** `useEffect(() => () => clearTimeout(typingTimerRef.current), [])`.

### Everything else checked — clean (Info)

`WebSocketProvider`'s reconnect timeout (cleared on unmount and on reopen, with a deliberate StrictMode double-mount guard), `useNotificationSync`'s debounce timer and `focus` listener, `useNotificationToasts`'s per-toast timer map, `useGroupChatAutoscroll`'s scroll listener, `NewChatModal`'s debounce/`keydown` listeners — all correctly cleaned up. All WS subscription hooks use `Set.add`/`Set.delete` with a returned unsubscribe function, consistently invoked from every consumer's own effect cleanup. No listener accumulation found across remounts or navigations.

---

## Summary Table

| ID | Finding | Severity |
|---|---|---|
| WS-001 | Chat (private + group) does not resync on WS reconnect | **High** |
| WS-002 | Group member removal produces no realtime signal to the removed client | Medium |
| WS-003 | Private chat `loadMoreHistory` merge has no id dedup → duplicate message on live-arrival race | Medium |
| WS-004 | Chat WS-push `created_at` precision drift vs REST for the same message | Low |
| WS-005 | Redundant `messages_read` broadcast on every `loadMoreHistory` page | Low |
| WS-006 | `ChatWindow` typing-indicator timer not cleared on unmount | Low |
| WS-007 | `read_at` TS type allows `null`, which the backend never sends | Info |
| — | Group-chat membership TOCTOU: **no bypass found** (verified) | Info (positive) |
| — | Notification merge: **verified sound** against every race scenario asked about | Info (positive) |
| — | WS transport write-serialization: **no concurrent-write race found** | Info (positive) |
