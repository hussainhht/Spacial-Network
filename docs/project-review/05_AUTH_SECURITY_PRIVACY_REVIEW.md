# 05 — Authentication, Session, Authorization & Privacy Review

> Scope: full call-chain tracing (handler → middleware → service → repository → SQL) across registration, login, sessions/cookies, profile privacy, followers, posts, comments, groups, events, private chat, group chat, uploads, CORS, and sensitive-data exposure. No live exploitation was performed; findings are static/code-path verified. Where a finding hinges on browser runtime behavior (SameSite handling), that is flagged explicitly as needing live verification.

## Overall Assessment

**This codebase is unusually careful about authorization.** Nearly every privacy-sensitive read/write path re-derives permission from the database on every request — no stale caching, no trust of client-supplied IDs for identity. The specific TOCTOU scenario prioritized by this audit (group membership revoked while a WebSocket stays connected) is **correctly handled**: membership is re-verified fresh from the database at send time and at broadcast time, not cached from connect/history-load time. **No Critical or High-confidence authorization-bypass findings exist.** The issues found are consistently small, systemic patterns (403-vs-404 existence oracles, a couple of hardcoded dev-only settings, one static-asset authorization gap) rather than outright bypasses.

---

## 1. Registration & Login

### AUTH-001 — Username uniqueness is case-sensitive; email is not

**Severity:** Low · **Confidence:** High

`username TEXT NOT NULL UNIQUE` / `email TEXT NOT NULL UNIQUE` (`backend/pkg/db/migrations/sqlite/20260827221112_create_users_table.up.sql:5-8`) has no `COLLATE NOCASE`. `Alice` and `alice` register as two distinct accounts. Email *is* lowercased before storage (`auth/validation.go:40-54`), username is not (`users/validation.go:18-25`). Enables username-squatting/impersonation and confusing login/@mention behavior. **Fix:** add `COLLATE NOCASE` to the username unique index or normalize to lowercase, plus a migration to detect pre-existing collisions.

### AUTH-002 — Registration leaks which field (username vs email) already exists

**Severity:** Low-Medium · **Confidence:** High

`RegisterHandler` (`backend/internal/auth/handler.go:236-270`) returns distinct `409` messages — `"Username already exists"` vs `"Email already exists"` — as two separately-checked branches. This lets an attacker submit a candidate email with a throwaway username to learn whether that email is already registered (email enumeration for phishing/credential-stuffing target lists), independent of login's own correctly-generic error (see below). **Fix:** one generic conflict message for both cases, or rate-limit/obfuscate the distinction.

**Positive control:** Login (`auth/service.go:23-42`, `auth/handler.go:123-134`) always returns the same `401 "Invalid username/email or password"` regardless of whether the identifier existed — correct, no username enumeration there.

### Info-level, no action needed
- No password complexity beyond `MinPasswordLength=8`/`MaxPasswordLength=72` — consistent with current NIST 800-63B guidance (length over forced complexity), not a defect.
- `/login`/`/register` are rate-limited (IP-keyed since no session exists yet; burst 10, refill 3/s, 15s penalty) — reasonable throttling, no account-level lockout by design (avoids DoS-via-lockout).
- Registration's duplicate-username/email check is a non-transactional check-then-insert, but the DB's own `UNIQUE` constraint prevents any actual duplicate; a genuine race just produces a confusing generic `500` instead of `409` (robustness note, not a security issue).

---

## 2. Sessions & Cookies

### AUTH-003 — `CookieSecure` is hardcoded `false`; no environment-based override exists for production

**Severity:** Low (as currently used) · **Confidence:** High (hardcoded) / Medium (real-world impact)

`backend/internal/config/config.go:47` — `CookieSecure: false` is a literal, unlike `ServerPort` a few lines above, which does read `os.Getenv`. The whole stack (plain `ListenAndServe`, no TLS; CORS hardcoded to `http://localhost:3000`; frontend hardcoded to `http://localhost:8080`) is self-consistently local-dev-only, so this should **not** be treated as a missing-Secure-flag finding in the usual sense — per this audit's own severity guidance, that would be over-flagging a correct local-dev default. The real gap: there is no env var to flip `CookieSecure` to `true` for a production deployment behind TLS. **Fix:** read `CookieSecure` from an env var (default `false` for parity with current behavior).

### AUTH-004 — `GET /api/logout` performs a state change, enabling logout-CSRF via top-level navigation

**Severity:** Low · **Confidence:** Medium (needs live browser verification of SameSite=Lax handling on top-level GET navigation, which is well-established behavior but not independently reproduced here)

`/logout` is registered without a method restriction (`router.go:42-45`); `LogoutHandler` (`auth/handler.go:151-172`) accepts both `GET` and `POST` and revokes the session either way. A cross-site page forcing a top-level navigation to `http://localhost:8080/api/logout` (`window.location = ...`, or a plain link) carries the `SameSite=Lax` cookie (Lax cookies **are** sent on cross-site top-level GET navigations) and silently logs the victim out. Every other mutating route in the API is `POST`/`PUT`/`PATCH`/`DELETE`-only; this is a deviation. **Fix:** drop `GET` support; require `POST` only.

### Session lifecycle — correct (Info, positive control)

`ValidateSession` checks `revoked_at IS NULL AND expires_at > CURRENT_TIMESTAMP` and opportunistically deletes stale rows; `UpdateSessionExpiry` implements the 24h sliding window and fails closed if revoked/expired between requests; `Login` always issues a fresh `crypto/rand`-backed 32-byte token (no session-fixation path); logout marks `revoked_at` server-side (not just a cookie clear). **Product-behavior note (not a bug):** `CreateSession` keeps one row per `user_id`, so logging in on a second device silently invalidates the first device's session — see `AUTH-005`/`DB-005` for the concurrency defect this interacts with.

### AUTH-005 — Concurrent logins can create duplicate active sessions (cross-referenced with `DB-005`)

**Severity:** Medium · **Confidence:** High

`sessions.user_id` has no `UNIQUE` constraint (only `session_token` is unique), and `CreateSession` (`backend/internal/auth/repository.go:20-55`) is a non-transactional check-then-act (`SELECT` for existing row, then `UPDATE` or `INSERT` in a separate round-trip). Two concurrent logins for the same user (double-click, two tabs, a retried request) can both see "no row" and both `INSERT`, producing two live sessions where the code's own branching logic clearly intends exactly one. A subsequent logout then only revokes one of the two rows. **Fix:** wrap in a transaction, or replace with a single upsert guarded by a real `UNIQUE(user_id)` constraint — the codebase already uses this pattern correctly elsewhere (`followers.CreateFollowRequest`, event RSVP upsert). Full detail in `04_DATABASE_MIGRATIONS_REVIEW.md`.

---

## 3. Profile Privacy — no bypass found

`toProfileResponse` (`backend/internal/users/handler.go:21-62`) only includes UUID/Age/Gender/Email/DOB when `viewerID == profile.ID`; `AboutMe` is gated on `canViewFullProfile`; name/avatar/nickname are always included, matching the spec exactly. `CanViewFullProfile` (`users/service.go:111-129`) is a fresh per-request DB check — owner→true, not-private→true, else delegates to live `IsFollowing`. **No caching anywhere in this path**: a profile flipping private→public, or a follow being approved, takes effect immediately on the next request, with no stale-permission window.

---

## 4. Followers — no bypass found

Instant-follow for public profiles, pending follow_request for private ones; both paths reject self-follow and duplicate follow/pending-request (DB `UNIQUE` constraint + `ON CONFLICT ... WHERE status != 'pending'` upsert). `AcceptFollowRequestHandler`/`DeclineFollowRequestHandler` scope their lookup with `WHERE id = ? AND target_id = ?` — a user cannot accept/decline someone else's follow request by guessing its ID. Followers/following lists correctly gate through `CanViewFullProfile` before returning `403`.

---

## 5. Posts

### 5.1 Direct `GET /api/posts/{id}` — correctly enforces the same rule as the feed (the single most important check this audit verified)

`GetPostByIDHandler` calls `canAccessPost` and returns `404` (not `403`) on denial — collapsing "doesn't exist" and "exists but you can't see it" so **ID iteration cannot be used to enumerate restricted posts via the read endpoint.** `canAccessPost` logic, verified line-by-line: group posts → strict group membership (ignores stored `visibility` entirely); owner → always allowed; `public` → everyone; `followers` → live `IsFollowing`; `custom` → viewer must be **both** on `post_allowed_viewers` **and** a current follower. `ListPosts`, `SearchPosts`, and the direct-fetch path all implement the identical predicate — confirmed by reading all three. `CreatePost`/`UpdatePost` always intersect client-supplied `viewer_ids` with the author's actual follower list server-side before persisting — a post owner cannot grant "custom" access to a non-follower even via a crafted request.

### SEC-003 — `PUT/PATCH/DELETE /posts/{id}` and `DELETE /comments/{id}` leak resource existence via 403-vs-404

**Severity:** Low · **Confidence:** High — see full evidence in `03_BACKEND_REVIEW.md` §3. Summary: `UpdatePost`/`DeletePost`/`DeleteComment` fetch the resource raw (no visibility check) before branching to ownership, so a non-owner with **zero viewing rights** to a private/custom/group post still learns whether the ID exists via the 403-vs-404 distinction.

---

## 6. Comments — correctly inherit post visibility

`CreateComment`/`ListComments`/`CountComments` all gate through `postsService.CanCreateComment`/`CanAccess`, fully inheriting the parent post's access rules including group membership. `DeleteComment` shares the SEC-003 existence-oracle pattern.

---

## 7. Groups

### 7.1–7.3 — Membership, invitations, join requests, private-group hiding, group-content scoping: no bypass found

`RespondToJoinRequest`/`RespondToInvitation` verify creator/invitee identity from a fresh DB read and only transition `status='pending'` rows (guards a double-accept race). `RemoveMember` restricts to the creator and blocks removing the creator. `GetAllGroups`/`SearchGroups` filter `WHERE privacy='public'` unconditionally — private groups never appear in discovery regardless of who's asking. `GetGroupForUser` returns `404` (not `403`) for a private group's non-member. Group posts/comments/chat/events are strictly members-only **independent of the stored `visibility` field** — `canAccessPost` short-circuits to `IsGroupMember` whenever `GroupID` is set.

### SEC-004 — Group mutation/action endpoints leak *private, hidden* group existence via 403-vs-404

**Severity:** Low-Medium · **Confidence:** High

`UpdateGroup`, `DeleteGroup`, `RemoveMember`, `RequestToJoin`, `CreateGroupInvitation`, `AcceptJoinRequest`/`RejectJoinRequest`, `SearchInviteCandidates` all call the **raw** `GetGroupByID` (no privacy/membership gate) before checking a specific permission, producing a domain-specific `403` for an existing-but-inaccessible group vs `404` for a genuinely nonexistent one. This is more significant than the equivalent posts/comments oracle (`SEC-003`) because private groups are specifically supposed to be hidden from directory/search entirely: `POST /api/groups/{id}/join-requests` → `403 "Private groups are invite only"` for a real private group vs `404` for a fake ID confirms a specific hidden group's existence (though never its content/members). Read paths (`GetGroupForUser`, `GetVisibleGroupMembers`, `GetMembership`) already do this correctly, routing through `ensureCanViewGroup` for a uniform `404`. **Fix:** apply the same visibility-first check to the mutation endpoints listed above.

---

## 8. Group Events — no bypass found

`CreateEventWithImage` checks `!eventTime.After(time.Now())` as the first, explicitly-documented "authoritative" check (not merely a client/handler-side one). Membership required for create/list/details/RSVP. `GetEventDetails` explicitly checks `event.GroupID != groupID` — prevents supplying a valid event ID from Group X alongside a `groupID` for Group Y (a group the caller *is* a member of) to read cross-group event details. RSVP is a single-row-per-user upsert restricted to `going`/`not_going`.

---

## 9. Private Chat

### 9.1 The actual permission rule: "at least one direction," not mutual

`Service.CanMessage` (`followers/service.go:187-193`) delegates to `HasFollowRelationship`, implemented as `A follows B OR B follows A` — one-directional following in either direction is sufficient; mutual following is not required. This matches the codebase's own `share/service.go` comment and is confirmed intended design, not a bug. Enforced live, server-side, on **every** message send (`chat/service.go:132-143`) — a client cannot bypass this by hiding the "ineligible" UI banner; the frontend's `isPartnerEligible` check is purely cosmetic and is not the enforcement point (independently confirmed in `06_REALTIME_CHAT_NOTIFICATIONS_REVIEW.md` §2.1).

Self-message and length limits (2000 runes) are enforced server-side, independent of any HTTP validation layer. History load does not independently re-check the follow relationship, but this is not exploitable: the SQL is strictly scoped to conversations the **authenticated caller** was personally a party to — no cross-user leakage. This means message history remains visible after a later unfollow, consistent with most chat products.

---

## 10. Group Chat (WebSocket) — TOCTOU, the audit's top-priority check

### No backend TOCTOU bypass found (verified, not assumed) — Info, positive finding

This was the highest-priority item in this audit's brief. Two independent subagents traced the full path and reached the same conclusion:

- **History load** (`GetGroupHistory`): live `IsGroupMember` check on every call, not cached from connect time.
- **Send time** (`HandleGroupMessage`): a **fresh, per-message** `IsGroupMember` check before any persistence.
- **Broadcast time**: the recipient list is **not** a cached room/roster — `GetGroupMembers` issues a fresh SQL query at the moment of broadcast, and only currently-mapped WebSocket connections for that freshly-queried list receive the event.
- **No sender-identity spoofing**: message payloads carry client-writable sender/user ID fields, but persistence and broadcast always use the connection-authenticated ID bound at `ServeWS` time, never the payload's self-reported value.

**Net effect for "removed mid-session, WebSocket still open":** the removed user can neither send (rejected at the fresh send-time check) nor receive (excluded from the fresh broadcast-time member list) further group activity, even though their socket remains technically open. There is a UX gap here (no proactive notice to the removed user — see `WS-002` in `06_REALTIME_CHAT_NOTIFICATIONS_REVIEW.md`), but it is not a security gap: no unauthorized data continues to flow.

---

## 11. Uploads

### Positive control — content-sniffed validation, randomized filenames, redundant size enforcement

`saveUpload` (shared by avatars/group photos/event covers) validates via `http.DetectContentType` against an explicit allow-list (jpeg/png/gif, +webp for post/comment media) — **never** trusts client-supplied filename or `Content-Type`. Critically, `image/svg+xml` and any HTML/text type are excluded from every allow-list, blocking the classic "upload an SVG/HTML disguised as an image, get it served and rendered with an embedded `<script>`" stored-XSS vector. Filenames are always fresh UUIDs (eliminates path-traversal-via-filename and collisions); `removeUpload` additionally rejects `..`/absolute paths on delete. Size limits are enforced both via the declared `Content-Length` and redundantly via `io.LimitReader` + post-copy length check, so a forged `Content-Length` can't bypass the cap.

### SEC-001 — `/uploads/*` static file serving has no authorization check; non-public media is fetchable forever once its URL is known

**Severity:** Medium · **Confidence:** High (code) / Medium (real-world exploitability, depends on URL retention)

`/uploads/` is mounted directly on the top-level `mux`, entirely outside `apiMux` (`backend/internal/router/router.go:318-323`) — **not** wrapped by session middleware, CORS, or any authorization logic. The JSON API correctly gates a restricted post/comment/event/group's *metadata* (§5, §6, §7, §8 above), but the *media file itself* — once its URL is known to anyone who legitimately saw it once (a follower later removed, a user dropped from a custom post's viewer list, a member removed from a private group whose event cover they'd already loaded) — remains fetchable **forever**, unauthenticated, with no revocation. Filenames are unguessable UUIDs (blind enumeration is impractical), so the risk is specifically **URL retention after access revocation**, not brute-forcing. Avatars/group photos are intentionally public per spec, so this only matters for post/comment/event media tied to non-public visibility. **Fix options:** (a) proxy media through an authenticated route that re-runs the same access checks before streaming (loses simple static-file serving), or (b) accept as a documented, intentional local-scale tradeoff — but stop presenting it as equivalently protected to the API.

---

## 12. CORS

### DOC-001 — Configurable backend origin is entirely dead plumbing (cross-referenced; full detail in `10_DOCUMENTATION_CONFIG_REVIEW.md` §1)

`backend/internal/middleware/cors.go` hardcodes `Access-Control-Allow-Origin: http://localhost:3000`, does **not** reflect the request's `Origin` header (avoiding the common misconfiguration — no wildcard+credentials, no origin reflection), and has zero env-var override path. `frontend/src/lib/api.ts` independently hardcodes the backend origin as `http://localhost:8080`, despite its own doc comment claiming `NEXT_PUBLIC_BACKEND_ORIGIN`/`NEXT_PUBLIC_BACKEND_WS_ORIGIN` override it — they never do (dead `DEFAULT_BACKEND_ORIGIN`/`cleanOrigin` helpers confirm a partially-removed implementation). Not a CORS *misconfiguration* — a real functional/deployment defect. See `10_DOCUMENTATION_CONFIG_REVIEW.md` for the full four-file evidence trail (this is one root cause, not two separate issues).

### SEC-002 — WebSocket upgrade accepts any Origin, inconsistent with the REST API's strict CORS policy

**Severity:** Low-Medium · **Confidence:** Medium (hinges on browser SameSite-on-WS-handshake behavior, which is well-established but not independently reproduced here)

`backend/internal/websocket/client.go:22-28` — `CheckOrigin: func(r *http.Request) bool { return true }`. `GET /api/ws` (session-cookie-gated) completes the handshake regardless of the requesting page's origin, unlike the REST API's strict single-origin policy. Mitigated in a compliant browser by same-origin-policy on reading the response and by `SameSite=Lax` not attaching to a non-navigation cross-origin WS handshake — but this relies entirely on correct, consistent cross-browser SameSite enforcement specifically for WebSocket handshakes (historically less consistent than `fetch`/XHR), and provides no defense-in-depth if that assumption breaks or if the session cookie is exfiltrated by an unrelated means and replayed. **Fix:** restrict `CheckOrigin` to the same allow-list as `middleware.CORS`, ideally sourced from one shared config value.

---

## 13. Sensitive Data Exposure — no leakage found (Info, positive control)

Every response type reviewed (auth, profile, posts, comments, followers, groups, chat) uses minimal author/sender/member summary shapes — never embeds `password_hash`, `session_token`, or another user's `email`/`date_of_birth`/`uuid`. `GetPasswordHashByID`/`GetCredentials` are only ever called for internal hash comparison and traced to never cross into an HTTP response struct. Error responses across every domain spot-checked return generic messages on `500` (raw `err.Error()` leakage is confined to the 6 upload-error sites documented as `BE-002` in `03_BACKEND_REVIEW.md`, not a general pattern).

---

## What Would Need Runtime Verification

- `AUTH-004` and `SEC-002` both hinge on exact browser SameSite-cookie behavior for GET top-level navigations and WebSocket handshakes respectively — a live cross-origin browser test would confirm or refute real-world exploitability.
- `SEC-001`'s practical severity depends on how often a post/comment/event image URL actually becomes known to a user later denied access (browser cache, a still-open tab) — worth checking whether the frontend ever surfaces these URLs somewhere a since-revoked user could retain them.
