# 11 — Master Issue Register

> Every issue below was traced against current source (file:line), not inferred, and cross-verified where two independent review passes touched the same area (noted explicitly). No Critical-severity issue was found anywhere in this audit. High/Medium issues carry full structured records; Low/Info issues are recorded in condensed form (full evidence lives in the referenced subsystem file) to keep this register navigable. Duplicate root causes are merged into a single ID with multiple evidence locations, per the audit's deduplication rule.

## By Severity

| Severity | Count |
|---|---:|
| Critical | 0 |
| High | 4 |
| Medium | 23 |
| Low | 30 |
| Info | 5 |
| **Total** | **62** |

## By Subsystem

| Subsystem | Critical | High | Medium | Low | Info |
|---|---:|---:|---:|---:|---:|
| Auth/Security (AUTH/SEC) | 0 | 0 | 2 | 5 | 0 |
| Backend (BE) | 0 | 0 | 3 | 6 | 1 |
| Database/Migrations (DB) | 0 | 1 | 5 | 5 | 1 |
| Realtime/Chat/Notifications (WS) | 0 | 1 | 2 | 3 | 1 |
| Frontend (FE) | 0 | 1 | 1 | 4 | 0 |
| 3D/Performance (3D) | 0 | 0 | 2 | 3 | 0 |
| Documentation/Config (DOC) | 0 | 1 | 3 | 0 | 2 |
| Code Quality/Tech Debt (DX) | 0 | 0 | 3 | 2 | 0 |
| Testing (TEST) | 0 | 0 | 1 | 1 | 0 |

---

# High-Severity Issues

## DB-001 — `pending_group_attempts` down-migration fails under normal, expected data (reproduced)

**Severity:** High · **Confidence:** High · **Status:** Confirmed (reproduced against a scratch DB)
**Area:** Database/Migrations · **Requirement affected:** "Create matching `.down.sql` migrations" (`docs/TODO/01_leader_groups_events.md`)

**Evidence:**
- `backend/pkg/db/migrations/sqlite/20260906120000_pending_group_attempts.up.sql` — replaces full `UNIQUE(group_id, invited_user_id/user_id)` indexes with partial indexes (`WHERE status='pending'`).
- `backend/pkg/db/migrations/sqlite/20260906120000_pending_group_attempts.down.sql` — recreates the full unique index unconditionally.

**Observed behavior:** The up-migration intentionally allows multiple non-pending history rows per (group, user) pair so a user can be declined and later re-invited/re-request. The down-migration recreates the original full unique index, which fails with `UNIQUE constraint failed` the moment any such history exists — reproduced directly with the minimal realistic case (one `declined` row + one `pending` row for the same pair).

**Expected behavior:** A down-migration should either succeed against any state the up-migration's own use case can produce, or be explicitly documented/renamed as one-way.

**Why this matters:** "Declined once, invited again" is the exact flow this migration exists to support — it will occur in ordinary use almost immediately, permanently breaking `MigrateDown`/`MigrateDownAll` for this version and everything below it from that point on. The migration's own comment admits the defect, but the shipped down-file doesn't achieve reversibility.

**How to reproduce / verify:**
1. Insert one `declined` and one `pending` row for the same `group_id`/`user_id` into `group_join_requests` (or `group_invitations`).
2. Run `go run ./cmd/migrate down` past this version.
3. Observe `UNIQUE constraint failed: group_join_requests.group_id, group_join_requests.user_id`.

**Recommended fix:** Either document this migration as irreversible (remove the misleading down file), or have the down migration collapse history (keep only the latest row per pair, or add a disambiguating column) before recreating the full unique index.

**Dependencies / related issues:** None (isolated to migration tooling; does not affect the running application, which stays on the up-migrated schema).

---

## WS-001 — Chat (private and group) does not resync on WebSocket reconnect; messages received during a disconnect go missing from the live UI

**Severity:** High · **Confidence:** High · **Status:** Confirmed
**Area:** Realtime/Chat · **Requirement affected:** "Keep stored messages available when a user reconnects" (`docs/TODO/04_websocket_chat_notifications.md`)

**Evidence:**
- `frontend/src/providers/WebSocketProvider.tsx` (reconnect logic — flat ~1.5s retry, outgoing-only replay queue)
- `frontend/src/features/chat/hooks/useChat.ts` (no effect keyed on `isConnected`)
- `frontend/src/features/group-chat/hooks/useGroupChatMessages.ts` (initial-load effect keyed on `[groupId, isMember]` only)
- Contrast: `frontend/src/features/notifications/hooks/useNotificationSync.ts` correctly resyncs on reconnect/focus.

**Observed behavior:** On reconnect, the frontend replays only outgoing events queued while offline; nothing re-fetches conversations or active history. Messages sent by a partner during the disconnect window are correctly persisted server-side but never appear in the reconnected client's UI until the user manually reopens the conversation or reloads.

**Expected behavior:** On `isConnected` false→true, the client should re-sync (at minimum re-fetch the conversation list, and the active conversation's recent history, merged/deduped against local state) — the same pattern `useNotificationSync` already implements correctly.

**Why this matters:** WebSocket disconnects are routine (laptop sleep, mobile tab backgrounding, brief network drops), not an edge case. Data is never lost, but it becomes invisible in the live UI, which reads to a user as "chat is broken" or "the message never sent."

**How to reproduce / verify:** Open a chat between two test users; disconnect one client's network for ~20s (or throttle to offline in devtools); have the other user send messages; reconnect; observe the messages do not appear without a manual reload/reselect.

**Recommended fix:** Add a reconnect-triggered resync effect in `useChat`/`useGroupChatMessages`, mirroring `useNotificationSync`'s pattern.

**Dependencies / related issues:** `WS-002` (related state-sync gap), `WS-003` (private-chat pagination dedup — same general area of the codebase).

---

## FE-001 — Custom-visibility post can be submitted with zero selected recipients, silently producing a post visible to nobody

**Severity:** High · **Confidence:** High · **Status:** Confirmed
**Area:** Frontend / Posts · **Requirement affected:** "Private: Allow the post owner to select specific followers... Prevent users outside the selected list from accessing the post" (`docs/TODO/02_posts_comments.md`) — directly corresponds to the developer's own unresolved `TODO.md` item: *"privet post is not work there is not selct people so i can add them."*

**Evidence:**
- `frontend/src/features/posts/components/NewPostForm.tsx` `handleSubmit` (no `viewerIds.length > 0` check before submit)
- `frontend/src/features/posts/components/PostForm.tsx` `handleSubmit` (same gap)
- `backend/internal/posts/validation.go` `ValidateNewPostRequest`/`ValidateEditPostRequest` (validates `Title`/`Content`/`Visibility` enum only; never checks `ViewerIDs` non-emptiness)
- `frontend/src/features/posts/components/CustomViewerPicker.tsx:32-38` (unexplained empty state when the author has 0 followers)

**Observed behavior:** A user can select "Selected/Specific people," submit with no followers chosen (whether because they have none, forgot, or misunderstand the followers-only scope), and the app reports success ("Post published.", redirect to feed). The post is created with an empty `post_allowed_viewers` set.

**Expected behavior:** The client should block submission (and the server should reject, as defense in depth) when `visibility === "custom"` and no viewers are selected — or the UI should clearly communicate that the post will be visible to no one.

**Why this matters:** By the app's own visibility rule (`custom` requires the viewer to be on the allowed-viewers list), a zero-viewer custom post is visible to **no one but the author, forever, with no error surfaced anywhere in the flow.** This is a materially worse failure mode than a hard validation error — the UI actively confirms success for a functionally broken post. This is very likely the root cause (more so than the empty-follower-list state alone) of the developer's own long-standing bug report.

**How to reproduce / verify:** As any user with ≥1 follower, create a post, select "Specific people," deselect/select no one, submit. Observe success toast and a post that (as a different user, including a follower) is not visible anywhere.

**Recommended fix:** (1) Client: disable submit / show inline error for `visibility==="custom" && viewerIds.length===0` in both forms. (2) Server: mirror the same check in both validation functions. (3) UX: explain the followers-only scope in the picker's empty state.

**Dependencies / related issues:** None blocking; independent, self-contained fix.

---

## DOC-001 — Configurable backend origin (frontend API/WS base URL + backend CORS) is entirely dead plumbing

**Severity:** High · **Confidence:** High · **Status:** Confirmed
**Area:** Documentation/Configuration/Docker · **Requirement affected:** Docker requirement — "frontend image, backend image, communication" (this audit's own requirements checklist); implicitly, any non-single-host deployment.

**Evidence:**
- `frontend/src/lib/api.ts:1-9,25-27,56-59` — doc comment claims `NEXT_PUBLIC_BACKEND_ORIGIN`/`NEXT_PUBLIC_BACKEND_WS_ORIGIN` override the defaults; `getBackendBaseUrl()`/`getWebSocketUrl()` never read `process.env` and unconditionally return hardcoded `http://localhost:8080`/`ws://localhost:8080`. `DEFAULT_BACKEND_ORIGIN`/`cleanOrigin` are confirmed dead code (flagged by `npm run lint`'s `@typescript-eslint/no-unused-vars`).
- `frontend/Dockerfile:12-18,29-37` and `compose.yaml:15-18` — both declare/pass `NEXT_PUBLIC_BACKEND_ORIGIN`/`NEXT_PUBLIC_BACKEND_WS_ORIGIN` as real build args, as if the app consumes them.
- `frontend/next.config.ts:3-4` — correctly reads `process.env.NEXT_PUBLIC_BACKEND_ORIGIN` for `next/image` remote patterns — proving the codebase knows the correct pattern in one place but didn't apply it in `lib/api.ts`.
- `backend/internal/middleware/cors.go:9-10` — `Access-Control-Allow-Origin: "http://localhost:3000"` is a bare literal with **no** env-var read at all (contrast with `config.go`'s `SERVER_PORT`, which does read from the environment for the analogous concern).

**Observed behavior:** Both sides are hardcoded to `localhost`. Today this is invisible because Docker Compose's default topology places both services on `localhost` from the host's perspective, so the hardcoded values happen to match the build-arg defaults.

**Expected behavior:** The env-var override the Dockerfile/compose/doc-comment all imply should exist should actually change the runtime API/WS origin the browser calls.

**Why this matters:** The moment the backend is deployed anywhere other than exactly the same host as the browser (a real staging/prod deployment, backend on a different container/domain/port), every `fetch()` call and the WebSocket connection will still target `localhost:8080` from the browser's perspective, while `next/image` (which *does* honor the env var) will correctly load images from the real origin — producing a confusing partial failure (images work, everything else silently breaks) with no error message pointing at the real cause. This is exactly the "prod bug from API-base-URL drift" failure class, and it undermines the project's own Docker-configurability design intent.

**How to reproduce / verify:** `docker build --build-arg NEXT_PUBLIC_BACKEND_ORIGIN=https://api.example.com ...` the frontend image, run it, and observe the browser's network tab still requests `localhost:8080`.

**Recommended fix:** Make `getBackendBaseUrl()`/`getWebSocketUrl()` read `process.env.NEXT_PUBLIC_BACKEND_ORIGIN`/`NEXT_PUBLIC_BACKEND_WS_ORIGIN` with the current hardcoded strings only as the fallback (mirroring `next.config.ts`'s existing correct pattern — the dead `DEFAULT_BACKEND_ORIGIN`/`cleanOrigin` helpers look like the remnant of exactly this, so restoring it may be close to a one-line fix); give `middleware.CORS` the same env-var-driven treatment via `config.Config`.

**Dependencies / related issues:** None blocking; independent, safe, low-risk fix (the current fallback values are preserved as defaults).

---

# Medium-Severity Issues

## SEC-001 — `/uploads/*` static file serving has no authorization check

**Severity:** Medium · **Confidence:** High (code) / Medium (real-world exploitability) · **Status:** Confirmed
**Area:** Security/Uploads · **Requirement affected:** Post/comment/event privacy enforcement at the asset level.
**Evidence:** `backend/internal/router/router.go:318-323` — `/uploads/` mounted on the top-level `mux`, outside `apiMux`, unwrapped by session middleware or CORS.
**Observed/Expected:** The JSON API correctly gates restricted content's metadata; the underlying media file, once its URL is known, is fetchable forever with no session and no revocation tied to later access changes (unfollow, removal from a custom-post viewer list, group removal).
**Why it matters:** Real gap between API-level and asset-level authorization; mitigated by unguessable UUID filenames (not brute-forceable), so risk is specifically about URL retention after revocation, not enumeration.
**Repro:** As a follower, note a `followers`-visibility post's image URL; have the author remove you as a follower; `GET` the same URL directly — still `200 OK`, no cookie required.
**Fix:** Proxy media through an authenticated route re-running the same access checks, or explicitly document this as an accepted local-scale tradeoff.
**Related:** None. Full detail: `05_AUTH_SECURITY_PRIVACY_REVIEW.md` §11.

## SEC-004 — Group mutation endpoints leak private/hidden group existence via 403-vs-404

**Severity:** Medium · **Confidence:** High · **Status:** Confirmed
**Area:** Security/Groups · **Requirement affected:** "Private groups... Hidden from directory and search" (`docs/BUSINESS_LOGIC.md`).
**Evidence:** `backend/internal/groups/service.go` — `UpdateGroup`, `DeleteGroup`, `RemoveMember`, `RequestToJoin`, `CreateGroupInvitation`, `AcceptJoinRequest`/`RejectJoinRequest` all call raw `GetGroupByID` (no privacy gate) before a specific permission check, producing distinct 403/404. Read paths already do this correctly via `ensureCanViewGroup`.
**Why it matters:** Specifically undermines the "hidden from directory" property private groups are supposed to have — an outsider can confirm a specific private group's existence (never its content) by the status-code difference.
**Fix:** Apply the same visibility-first check used by read paths to these mutation endpoints. Full detail: `05_AUTH_SECURITY_PRIVACY_REVIEW.md` §7.4.

## BE-001 — `posts`/`likes`/`share`/`comments` handlers never set `Content-Type`; served as `text/plain`

**Severity:** Medium · **Confidence:** High (empirically reproduced) · **Status:** Confirmed
**Area:** Backend/HTTP correctness.
**Evidence:** 22 handler functions across 4 packages; reproduced with a real `httptest.NewServer` showing Go's content-sniffing serves unset-header JSON as `text/plain; charset=utf-8`. Every other domain (groups, users, followers, notifications, chat, search) sets the header correctly.
**Why it matters:** Real protocol inconsistency across the highest-traffic endpoints (feed, likes, comments); masked today only because browser `fetch().json()` doesn't check the header.
**Fix:** Set `Content-Type: application/json` at the top of every handler in these 4 packages. Full detail: `03_BACKEND_REVIEW.md` §3.

## BE-002 — Raw filesystem/OS error text returned to the client on genuine `500` upload failures (6 locations, 5 packages)

**Severity:** Medium · **Confidence:** High · **Status:** Confirmed
**Area:** Backend/Error handling.
**Evidence:** Identical copy-pasted pattern in `posts/handler.go`, `comments/handler.go`, `groups/handler.go` (×2), `users/handler.go`, `auth/handler.go` — on genuine OS-level upload failure (disk full, permission denied), status is correctly `500` but the body still serializes raw `err.Error()`. `groups/event_handler.go`'s own upload path gets this right (fixed message), proving the correct pattern already exists in the same codebase.
**Why it matters:** Real information-disclosure class bug (server filesystem paths), though exploitability requires a genuine OS-level failure, not attacker-controlled input.
**Fix:** Use a fixed message on the `500` branch in all 6 locations. Full detail: `03_BACKEND_REVIEW.md` §4.

## BE-003 — `AuthService.CleanupSessions()` runs once at startup only; no periodic sweep

**Severity:** Medium · **Confidence:** High · **Status:** Confirmed
**Area:** Backend/Sessions.
**Evidence:** `backend/internal/router/router.go:23-25` is the only call site. Contrast with `internal/ratelimit/limiter.go`'s correct periodic `cleanupLoop()` in the same codebase.
**Why it matters:** Unbounded `sessions` table growth over a long-running instance's lifetime.
**Fix:** Start a periodic goroutine mirroring `ratelimit.Limiter.cleanupLoop`. Full detail: `03_BACKEND_REVIEW.md` §4.

## DB-002 — `notifications.actor_id` cascades instead of `SET NULL`, deleting receivers' notification history when an unrelated actor deletes their account

**Severity:** Medium · **Confidence:** High · **Status:** Confirmed
**Area:** Database/Foreign keys.
**Evidence:** `20260903211849_create_notifications_table.up.sql` — `actor_id` is nullable (for system notifications) but its FK is `ON DELETE CASCADE`.
**Why it matters:** Deleting user A, who merely liked/commented on user B's content, deletes B's notification history too — silent, receiver-side data loss caused by an unrelated third party.
**Fix:** Change the FK to `ON DELETE SET NULL`. Full detail: `04_DATABASE_MIGRATIONS_REVIEW.md` §2.

## DB-003 — Missing indexes on FK columns to `users(id)` force full table scans on every cascading user deletion

**Severity:** Medium · **Confidence:** High (verified via `EXPLAIN QUERY PLAN` on the live DB) · **Status:** Confirmed
**Area:** Database/Indexes.
**Evidence:** `sessions.user_id`, `posts.user_id`, `comments.user_id`, `likes.user_id`, `group_members.user_id`, `notifications.actor_id`, `group_invitations.invited_by`, `events.created_by`, `group_messages.user_id`, `event_responses.user_id`, etc. all confirmed `SCAN`, not `SEARCH`.
**Why it matters:** Given `db.SetMaxOpenConns(1)`, every user deletion blocks the single connection through full scans of most tables in the schema — invisible at dev-scale row counts, real once tables grow.
**Fix:** Add single-column (or FK-leading composite) indexes on the listed columns. Full detail: `04_DATABASE_MIGRATIONS_REVIEW.md` §3.

## DB-004 — Main feed query (`ListPosts`) full-scans `posts` plus an extra temp-sort; no index on `created_at`

**Severity:** Medium · **Confidence:** High (verified via `EXPLAIN QUERY PLAN`) · **Status:** Confirmed
**Area:** Database/Indexes.
**Evidence:** `posts` has exactly one index (`idx_posts_group_id`); `EXPLAIN QUERY PLAN` on the live `ListPosts` query shows `SCAN p` plus `USE TEMP B-TREE FOR ORDER BY`.
**Why it matters:** This is the hottest endpoint in the app, hit on every page load.
**Fix:** `CREATE INDEX idx_posts_created_at ON posts(created_at DESC, id DESC)`. Full detail: `04_DATABASE_MIGRATIONS_REVIEW.md` §3.

## DB-005 — `sessions.user_id` has no UNIQUE constraint; combined with non-transactional `CreateSession`, concurrent logins can create duplicate active sessions

**Severity:** Medium · **Confidence:** High · **Status:** Confirmed
**Area:** Database + Auth (cross-referenced as `AUTH-005` in `05_AUTH_SECURITY_PRIVACY_REVIEW.md`).
**Evidence:** `backend/internal/auth/repository.go:20-55` — separate `SELECT` then `UPDATE`/`INSERT` round-trips, no transaction; no `UNIQUE(user_id)` constraint on `sessions`.
**Why it matters:** Double-login (double-click, two tabs, a retried request) is realistic and produces two live session rows for one user, silently violating the one-session-per-user invariant the code is clearly trying to enforce; a subsequent logout only revokes one row.
**Fix:** Wrap in a transaction or replace with a single upsert guarded by a real `UNIQUE(user_id)` constraint, matching patterns already used correctly elsewhere. Full detail: `04_DATABASE_MIGRATIONS_REVIEW.md` §5.

## DB-006 — Timestamp columns mix two incompatible textual formats; one query relies on raw string ordering that only works if formats don't mix

**Severity:** Medium · **Confidence:** High (verified against live data) · **Status:** Confirmed
**Area:** Database/Types.
**Evidence:** Live query of `backend/data/social-network.db` confirmed both `DEFAULT CURRENT_TIMESTAMP`-produced (no offset) and Go-driver-serialized (offset-suffixed, varying offset) timestamp strings coexist across tables. `posts.ListPostsByGroup` sorts with a raw `ORDER BY created_at DESC` (no `datetime()` wrapper) on a column always stored in the offset format for that table, unlike `posts.ListPosts`, which correctly wraps both sides in `datetime(...)`.
**Why it matters:** Raw lexicographic comparison across different timezone offsets does not reliably match chronological order; live data already shows mixed offsets.
**Fix:** Standardize on UTC everywhere a timestamp is explicitly bound, and/or wrap `ListPostsByGroup`'s `ORDER BY` in `datetime(...)`. Full detail: `04_DATABASE_MIGRATIONS_REVIEW.md` §6.

## DB-008 — Unbounded (no `LIMIT`) list queries

**Severity:** Medium · **Confidence:** High · **Status:** Confirmed
**Area:** Database/Query quality.
**Evidence:** `followers.GetFollowers`/`GetFollowing`, `groups.GetGroupMembers`, `comments.ListCommentsByPost`, `event_repository.GetEventsByGroup` — all return every matching row with no bound.
**Why it matters:** A popular account or a viral post produces a large single-query result set fully materialized and marshaled in one request.
**Fix:** Add `LIMIT`/cursor pagination to all four. Full detail: `04_DATABASE_MIGRATIONS_REVIEW.md` §5.

## WS-002 — Group member removal produces no realtime signal to the removed client

**Severity:** Medium · **Confidence:** High · **Status:** Confirmed
**Area:** Realtime/Groups.
**Evidence:** `backend/internal/groups/service.go:212-237` (`RemoveMember`) never touches the hub, unlike the existing `follow_removed` pattern elsewhere in the same codebase; no `group_member_removed` event type exists.
**Why it matters:** A removed member's still-open tab silently stops sending/receiving with no explanation — a state-sync/UX gap (not a security gap; the underlying authorization is correctly enforced, see `05_AUTH_SECURITY_PRIVACY_REVIEW.md` §10).
**Fix:** Broadcast a lightweight event on removal, mirroring the existing `follow_removed` pattern. Full detail: `06_REALTIME_CHAT_NOTIFICATIONS_REVIEW.md` §3.

## WS-003 — Private chat `loadMoreHistory` merge has no id-based dedup, combined with fixed-offset pagination → duplicate message on a live-arrival race

**Severity:** Medium · **Confidence:** High · **Status:** Confirmed
**Area:** Realtime/Chat.
**Evidence:** `useChat.ts`'s `loadMoreHistory` prepend has no id-collision check, unlike group chat's `deduplicateAndSortMessages`, which handles the identical scenario correctly in the same codebase.
**Why it matters:** A live message arriving mid-pagination shifts the offset-based SQL window, producing a rendered duplicate.
**Fix:** Dedupe the merge by id, or switch to cursor-based pagination. Full detail: `06_REALTIME_CHAT_NOTIFICATIONS_REVIEW.md` §2.

## FE-003 — Inconsistent focus management across modals; the two weakest examples guard the most destructive actions

**Severity:** Medium · **Confidence:** High · **Status:** Confirmed
**Area:** Frontend/Accessibility.
**Evidence:** `ConfirmDialog.tsx` implements the full accessible-dialog contract; `RemoveMemberDialog` (`GroupPanels.tsx`) and `DeleteGroupDialog` (`GroupDangerZone.tsx`) only handle Escape, despite `role="alertdialog"` markup asserting focus containment.
**Why it matters:** Guards "remove member" and "delete group" — the two most destructive actions in the app.
**Fix:** Reuse `ConfirmDialog` (see `FE-004`). Full detail: `02_FRONTEND_REVIEW.md` §7.

## 3D-001 — `PlanetBackground`/Canvas not behind `next/dynamic(ssr:false)`; three.js/R3F/drei ship on every authenticated route

**Severity:** Medium · **Confidence:** High · **Status:** Confirmed
**Area:** 3D/Performance.
**Evidence:** `(main)/layout.tsx` → `AppShell.tsx` → `PlanetBackground.tsx` statically imports drei/R3F/three at module top level; zero `next/dynamic` usage anywhere near the space code.
**Why it matters:** Every authenticated route ships the 3D library bundle, including routes with no 3D content.
**Fix:** Wrap `PlanetBackground` in `next/dynamic(..., { ssr: false, loading: () => null })` — a no-behavior-change fix since the component already self-gates on client-readiness. Full detail: `07_3D_SPACE_PERFORMANCE_REVIEW.md` §1.

## 3D-002 — No GLTF cache eviction; cycling planets pins all loaded assets in GPU memory for the session

**Severity:** Medium · **Confidence:** High · **Status:** Confirmed
**Area:** 3D/Performance.
**Evidence:** `useGLTF.clear()` exists in the installed drei version; zero call sites repo-wide.
**Why it matters:** Bounded (~52MB/9 assets) but avoidable footprint; already listed as an unimplemented recommendation in the project's own optimization report.
**Fix:** Call `useGLTF.clear(path)` for the previously-displayed planet after a swap completes. Full detail: `07_3D_SPACE_PERFORMANCE_REVIEW.md` §2.

## DOC-002 — `frontend/README.md` actively contradicts current behavior (not just outdated)

**Severity:** Medium · **Confidence:** High · **Status:** Confirmed
**Area:** Documentation.
**Evidence:** Claims *"Group chat remains an existing disabled placeholder"* (contradicted by a fully-built 28-file feature) and describes the 3D system as *"intentionally dormant"* (contradicted by the fully-active 8-planet system).
**Why it matters:** Makes specific, falsifiable, wrong claims rather than merely being stale — actively misleading for onboarding. Full detail: `10_DOCUMENTATION_CONFIG_REVIEW.md` §3.

## DOC-003 — `docs/backend_docs/*` and `docs/TEST_AUDIT_REPORT.md` are systemically stale, in a style that invites false trust

**Severity:** Medium · **Confidence:** High · **Status:** Confirmed
**Area:** Documentation.
**Evidence:** `websocket-system.md` §9 asserts chat WS sending "does not work end to end" — verified false against current `dependencies.go`/`chat/service.go`. `notifications.md` claims Follow Requests and Group Events "don't exist" — verified false. `docs/TEST_AUDIT_REPORT.md` (dated 2026-09-06) claims Followers, Comments, Docker, and 5+ other major features are "NOT IMPLEMENTED" — all now implemented.
**Why it matters:** These docs are written in a detailed, file:line-citing, "traced this code" style that reads as current and authoritative — a more dangerous form of drift than an obviously-old planning doc, precisely the failure mode this audit was commissioned to catch. **Not flagged by the prior Gemini audit at all** (beyond `TEST_AUDIT_REPORT.md`, which it did catch). Full detail: `10_DOCUMENTATION_CONFIG_REVIEW.md` §4.

## DOC-006 — Root `README.md` describes an architecture that was never actually built this way

**Severity:** Medium · **Confidence:** High · **Status:** Confirmed
**Area:** Documentation.
**Evidence:** Wrong backend entrypoint path, wrong migration-naming scheme, missing 8 of 17 backend packages, entirely different (non-existent) frontend file structure.
**Why it matters:** Reads as a pre-implementation planning scaffold (matching the `docs/TODO/0N_*.md` person-checklists' style) that was never updated — cannot currently be trusted for onboarding. The `Makefile` beside it, by contrast, is accurate. Full detail: `10_DOCUMENTATION_CONFIG_REVIEW.md` §2.

## DX-001 — Pagination-clamp logic duplicated 3x in Go with a real behavioral quirk

**Severity:** Medium · **Confidence:** High · **Status:** Confirmed
**Area:** Code Quality (cross-referenced as the same root cause as `DB-012`, counted once here).
**Evidence:** `chat.GetPrivateHistory`, `chat.GetGroupHistory`, `followers.GetEligibleChatContacts` each independently reimplement `if limit<=0 || limit>MAX { limit = DEFAULT }`, collapsing an over-limit request to the small default instead of the max.
**Why it matters:** Easy to "fix" at one call site during a future bug report and leave wrong at the other two — no single place to fix it.
**Fix:** Extract one shared clamp helper. Full detail: `09_CODE_QUALITY_TECH_DEBT.md` §2.

## DX-002 — `search` package duplicates its limit constants in the repository layer with a looser value than the service layer declares

**Severity:** Medium · **Confidence:** High · **Status:** Confirmed
**Area:** Code Quality.
**Evidence:** `search/service.go` declares `MaxLimit=50`; `search/repository.go` reimplements the clamp 4 times using a hardcoded `100`.
**Why it matters:** Currently unreachable via HTTP (service always clamps first), but the repository's own exported methods carry a silently looser ceiling for any future direct caller.
**Fix:** Reference the service's constants from the repository instead of re-declaring literals. Full detail: `09_CODE_QUALITY_TECH_DEBT.md` §2.

## DX-003 — Systemic unvalidated type assertions on API/WebSocket response shapes

**Severity:** Medium · **Confidence:** High · **Status:** Confirmed
**Area:** Code Quality/Frontend.
**Evidence:** `frontend/src/lib/api/client.ts`'s shared `apiRequest<T>()` (27+ call sites) does `response.json() as Promise<T>` with no runtime schema validation; `WebSocketProvider.tsx` does the same on 7 parsed WS payload branches.
**Why it matters:** A backend response-shape drift provides zero compile-time protection and surfaces later as an undefined-property runtime error deep in a component.
**Fix:** Introduce runtime shape validation (zod or equivalent) at the one shared boundary. Full detail: `09_CODE_QUALITY_TECH_DEBT.md` §5.

## TEST-001 — Frontend has zero automated test coverage of any kind

**Severity:** Medium · **Confidence:** High · **Status:** Confirmed
**Area:** Testing.
**Evidence:** No jest/vitest/playwright config or dependency anywhere; zero `.test.ts(x)`/`.spec.ts(x)` files; `package.json`'s `test:smoke` script points at a nonexistent `frontend/tests/run-smoke.sh` (reproduced: fails immediately).
**Why it matters:** Every frontend-only defect in this audit (`FE-001`, `FE-003`, `WS-001`/`WS-003`/`WS-006`, the 3D findings) is currently uncatchable by any automated check.
**Fix:** Stand up a minimal component/integration test harness (Vitest + Testing Library is the lowest-friction fit for this stack), starting with a regression test for `FE-001`. Full detail: `08_TESTING_RUNTIME_REVIEW.md` §3, `09_CODE_QUALITY_TECH_DEBT.md` §8.

---

# Low & Info-Severity Issues (condensed)

Full evidence for every item below is in its referenced subsystem file.

| ID | Summary | Severity | File |
|---|---|---|---|
| AUTH-001 | Username uniqueness is case-sensitive (email is correctly lowercased, username isn't) | Low | 05 §1 |
| AUTH-002 | Registration leaks which field (username/email) conflicts — email enumeration | Low | 05 §1 |
| AUTH-003 | `CookieSecure` hardcoded `false`, no env override for a future TLS deployment | Low | 05 §2 |
| AUTH-004 | `GET /api/logout` performs a state change — logout-CSRF via top-level navigation | Low | 05 §2 |
| SEC-002 | WebSocket `CheckOrigin` always `true`, inconsistent with strict REST CORS | Low | 05 §12 |
| SEC-003 | `PUT/PATCH/DELETE /posts/{id}`, `DELETE /comments/{id}` leak existence via 403-vs-404 | Low | 05 §5-6 |
| BE-004 | `groups` package god files (`handler.go` 1156 lines, 4 sub-domains in one file) | Low | 03 §2, 09 §3 |
| BE-005 | Duplicated method-check boilerplate; ~11/19 in-handler checks are dead code | Low | 03 §2 |
| BE-006 | `pkg/response.JsonResponse` is a maintained helper with zero adopters | Low | 03 §2, 09 §1 |
| BE-007 | Three incompatible error-response JSON shapes coexist across the API | Low | 03 §3 |
| BE-008 | `json.Encode` errors discarded at all ~370 call sites | Low | 03 §4 |
| BE-009 | No `recover()` anywhere in the backend — an unrecovered WS-goroutine panic crashes the whole server | Low | 09 §6 |
| DB-009 | `add_post_media` migration leaves `posts.image_path` permanently denormalized (documented, latent) | Low | 04 §1 |
| DB-010 | `posts.group_id` index not composite with `created_at`, unlike equivalent indexes elsewhere | Low | 04 §3 |
| DB-011 | `follow_requests` full-unique-index design loses decline history (vs. group invitations' pattern) | Low | 04 §3 |
| DB-013 | `SELECT *` from CTEs (not raw tables) in `followers/repository.go` | Low | 04 §5 |
| DB-014 | Minor read-after-write race in `likes.CreateLike`'s already-liked read-back | Low | 04 §5 |
| WS-004 | Chat WS-push `created_at` precision (seconds) drifts from REST history (nanoseconds) for the same message | Low | 06 §4 |
| WS-005 | Redundant `messages_read` broadcast on every `loadMoreHistory` page fetch | Low | 06 §2 |
| WS-006 | `ChatWindow` typing-indicator timer not cleared on unmount | Low | 06 §6 |
| FE-004 | Duplicated, inconsistent modal implementations (root cause of `FE-003`) | Low | 02 §2 |
| FE-005 | Module-scoped group cache not tied to auth/session lifecycle | Low | 02 §2 |
| FE-006 | `.group-member-name` ellipsis has no effect without `white-space: nowrap` | Low | 02 §6 |
| FE-007 | Login/Register cross-links use `<a>` instead of `next/link` | Low | 02 §5 |
| 3D-003 | `moon-final.glb` (11MB) exceeds the 10MB flag threshold — documented, deliberate tradeoff | Low | 07 §7 |
| 3D-004 | Main app renders 3D Canvas on mobile; auth stages skip it — undocumented inconsistency | Low | 07 §5 |
| 3D-005 | Three localStorage keys use two different naming conventions | Low | 07 §4 |
| DX-004 | Avatar/photo max-size constant re-declared 4x; the one correct shared helper is unused | Low | 09 §2 |
| DX-005 | Session cookie construction duplicated instead of using the existing (dead) helper | Low | 09 §2 |
| TEST-002 | Backend `search` package test coverage thin (1 test covering 1 of 4 result domains) | Low | 09 §8 |
| BE-010 | Neither rate-limiter nor hub is explicitly shut down on server exit | Info | 03 §5 |
| DB-007 | `schema.dbml` drift: 4 confirmed (prior audit) + 10 additional items found this pass | Info | 04 §4 |
| WS-007 | `read_at` TS type allows `null`, which the backend (`omitempty`) never actually sends | Info | 06 §4 |
| DOC-004 | No `.env.example` despite `.gitignore` carving out an exception for one | Info | 10 §5 |
| DOC-005 | `MODEL_ASSETS.md`/`docs/3d-model-optimization-report.md` reference a phantom asset, a removed dev route, and stale sizes | Info | 10, 07 §6 |

---

# Positive Findings Worth Preserving (not issues — do not "fix," do not regress)

These were actively verified (not assumed) and represent real engineering strength this audit found no fault with:

- **Group-chat membership TOCTOU: no bypass exists.** Membership is re-derived from the database independently at history-load, send, and broadcast-dispatch time, with zero caching layer anywhere in the hub. Confirmed by two independent review passes.
- **Notification sync is a true id-keyed union merge**, verified sound against every race scenario this audit's brief asked about (WS-before-REST, REST-before-WS, mark-read races).
- **WebSocket transport concurrency**: single-writer-per-connection discipline, mutex-guarded hub map, non-blocking send with dead-client eviction — `go test -race ./...` passes clean across the full backend suite, not just the two packages the prior audit race-tested.
- **Upload validation**: magic-byte content sniffing against an allow-list that excludes SVG/HTML (blocking disguised-file stored XSS), UUID filenames, redundant size enforcement.
- **Direct-by-ID access control** (`GET /posts/{id}`, group details, event details) correctly collapses "doesn't exist" and "exists but hidden" into a uniform 404 — the existence-oracle issues in this register are confined to *mutation* endpoints, not reads.
- **3D system engineering**: correct shared-vs-owned disposal semantics, full render-loop pause on tab-hidden/reduced-motion, genuine unmount (not CSS-hide) when disabled, memoized context preventing app-wide re-renders, 100% registry↔disk asset consistency.
- **Database transactional integrity**: every multi-statement write reviewed (group+membership creation, post+media+viewers creation, join/invite accept-or-reject) is correctly transaction-wrapped; no N+1 query pattern found anywhere in the repository layer.
- **TypeScript hygiene**: zero `as any`, zero `@ts-ignore`, effectively zero unsafe non-null assertions across the entire frontend.
- **Zero `TODO`/`FIXME`/`HACK` comments** anywhere in source — unusually clean for a codebase this size.
