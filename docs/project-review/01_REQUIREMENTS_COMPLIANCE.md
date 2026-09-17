# 01 — Requirements Compliance Matrix

> Requirement sources: `docs/TODO/01_leader_groups_events.md`, `02_posts_comments.md`, `03_profiles_followers.md`, `04_websocket_chat_notifications.md` (the four person-ownership checklists), `docs/BUSINESS_LOGIC.md`, and root `TODO.md`. Root `README.md` was consulted only as historical/reference material, not as a requirement source (it is itself flagged stale — see `10_DOCUMENTATION_CONFIG_REVIEW.md`).
>
> **Important caveat on the source checklists:** the `docs/TODO/0N_*.md` files' checkboxes are **not a reliable signal of implementation status** — many items are unchecked (`[ ]`) despite being fully implemented and verified working in current code (e.g. nearly all of Person 1's "Groups" backend checklist, and most of Person 4's WebSocket/chat/notifications checklist). These read as per-person planning checklists that were simply never updated as work landed, likely because ownership/tracking moved elsewhere once the team was integrating. This matrix reports **actual verified implementation status**, not checkbox state — where the two disagree, that disagreement is noted explicitly as its own signal (see `10_DOCUMENTATION_CONFIG_REVIEW.md`).
>
> Statuses: `PASS` / `PARTIAL` / `FAIL` / `NOT VERIFIED` / `EXTRA / ENHANCEMENT` / `OUTDATED REQUIREMENT`.

---

## Technology

| ID | Requirement | Status | FE | BE | DB | Tests | Evidence | Notes |
|---|---|---|:--:|:--:|:--:|:--:|---|---|
| REQ-T01 | Go backend | PASS | — | ✓ | — | ✓ | `backend/go.mod` (Go 1.27.1 toolchain observed, module targets 1.26); `go build`/`go vet`/`go test -race` all pass | |
| REQ-T02 | JS framework frontend | PASS | ✓ | — | — | — | `frontend/package.json` — Next.js 16.3.2, React 19.2.8, TS 5.9.3; `npm run build` succeeds, 16 routes generated | |
| REQ-T03 | SQLite | PASS | — | ✓ | ✓ | ✓ | `mattn/go-sqlite3`, WAL mode, single-connection (`db.SetMaxOpenConns(1)`) | |
| REQ-T04 | WebSockets | PASS | ✓ | ✓ | — | ✓ | `internal/websocket`, `hub_test.go`'s `TestHubConcurrentSend`; end-to-end chat send/receive verified working in current code (see note) | A stale internal doc (`docs/backend_docs/websocket-system.md`) claims chat WS sending is fundamentally broken — verified **false** against current code; see `10_DOCUMENTATION_CONFIG_REVIEW.md` §4 / `DOC-003`. |
| REQ-T05 | Sessions | PASS | ✓ | ✓ | ✓ | ✓ | 24h sliding expiry, `crypto/rand` tokens, correct revocation on logout | `DB-005`/`AUTH-005`: concurrent logins can create duplicate session rows (Medium) |
| REQ-T06 | Cookies | PASS | — | ✓ | — | ✓ | `HttpOnly`, `SameSite=Lax`, correct expiry | `AUTH-003`: `Secure` hardcoded `false`, no env override for a future TLS deployment (Low, appropriate for current local-dev scope) |
| REQ-T07 | Migrations | PARTIAL | — | ✓ | ✓ | ✓ | 30 up/down pairs, transactional runner, `go run ./cmd/migrate version` confirms latest applied | `DB-001`: one down-migration (`pending_group_attempts`) is not actually reversible under its own intended use case (High) |
| REQ-T08 | Docker | PARTIAL | ✓ | ✓ | — | — | `compose.yaml`, both Dockerfiles build and `docker compose config` validates cleanly | `DOC-001`: cross-service communication only works in the exact default localhost topology — the documented env-var override for a real (non-localhost) deployment is entirely non-functional (High) |

## Authentication

| ID | Requirement | Status | FE | BE | DB | Tests | Evidence | Notes |
|---|---|---|:--:|:--:|:--:|:--:|---|---|
| REQ-A01 | Registration (required fields: username, password, first/last name, email, DOB) | PASS | ✓ | ✓ | ✓ | ✓ | `auth/handler.go` `RegisterHandler`, `users` table migration, `tests/auth/` | |
| REQ-A02 | Optional avatar/nickname/about-me | PASS | ✓ | ✓ | ✓ | ✓ | `add_profile_extra_fields_to_users` migration; frontend register wizard | |
| REQ-A03 | Login | PASS | ✓ | ✓ | ✓ | ✓ | Generic error on failure (no username enumeration), verified | |
| REQ-A04 | Persistent session (sliding expiry) | PASS | ✓ | ✓ | ✓ | ✓ | 24h sliding window, refreshed each authenticated request | |
| REQ-A05 | Logout | PASS | ✓ | ✓ | ✓ | ✓ | Server-side revocation (`revoked_at`), not just cookie clear | `AUTH-004`: reachable via `GET`, enabling logout-CSRF (Low) |
| REQ-A06 | Password hashing | PASS | — | ✓ | — | ✓ | `bcrypt`, cost 10; never leaked in any response (verified across every response type) | |

## Profiles

| ID | Requirement | Status | FE | BE | DB | Tests | Evidence | Notes |
|---|---|---|:--:|:--:|:--:|:--:|---|---|
| REQ-P01 | Own profile view/edit | PASS | ✓ | ✓ | ✓ | ✓ | `users/handler.go`, `ProfilePage.tsx` | Profile-details/avatar/privacy editing is `EXTRA / ENHANCEMENT` beyond the minimum spec |
| REQ-P02 | Other users' profiles | PASS | ✓ | ✓ | ✓ | ✓ | `GetProfileHandler`, correct field masking | |
| REQ-P03 | Public/private state | PASS | ✓ | ✓ | ✓ | ✓ | `is_private` column, toggle endpoint | |
| REQ-P04 | Visibility rules (owner-only fields, follower-gated About Me) | PASS | ✓ | ✓ | ✓ | ✓ | Deeply verified end-to-end, no TOCTOU/bypass found — see `05_AUTH_SECURITY_PRIVACY_REVIEW.md` §3 | Strongest-verified area of the whole audit |

## Followers

| ID | Requirement | Status | FE | BE | DB | Tests | Evidence | Notes |
|---|---|---|:--:|:--:|:--:|:--:|---|---|
| REQ-F01 | Follow public profile (instant) | PASS | ✓ | ✓ | ✓ | ✓ | Verified, no bypass | |
| REQ-F02 | Follow private profile (pending request) | PASS | ✓ | ✓ | ✓ | ✓ | | |
| REQ-F03 | Accept / decline follow request | PASS | ✓ | ✓ | ✓ | ✓ | Scoped by target ID — cannot accept/decline another user's request | |
| REQ-F04 | Unfollow | PASS | ✓ | ✓ | ✓ | ✓ | Correctly revokes `post_allowed_viewers` grants on unfollow | |
| REQ-F05 | Duplicate follow/request prevention | PASS | ✓ | ✓ | ✓ | ✓ | DB `UNIQUE` + partial-index upsert | |
| REQ-F06 | Self-follow prevention | PASS | ✓ | ✓ | ✓ | ✓ | DB-level `CHECK` constraint, not just app layer | |

## Posts

| ID | Requirement | Status | FE | BE | DB | Tests | Evidence | Notes |
|---|---|---|:--:|:--:|:--:|:--:|---|---|
| REQ-PO01 | Create post (text/image) | PASS | ✓ | ✓ | ✓ | ✓ | | |
| REQ-PO02 | Feed | PASS | ✓ | ✓ | ✓ | ✓ | Cursor-paginated, filters (all/following/friends) | `DB-004`: main feed query full-scans + extra sort (Medium, perf only) |
| REQ-PO03 | Media (image/GIF) | PASS | ✓ | ✓ | ✓ | ✓ | JPEG/PNG/GIF/WebP, content-sniffed | |
| REQ-PO04 | Public visibility | PASS | ✓ | ✓ | ✓ | ✓ | | |
| REQ-PO05 | Followers-only visibility | PASS | ✓ | ✓ | ✓ | ✓ | | |
| REQ-PO06 | Private / selected-followers visibility | **FAIL** | ✓ | ✓ | ✓ | ✓ | Backend enforcement of the "custom" rule is correct and thoroughly verified (`05_AUTH_SECURITY_PRIVACY_REVIEW.md` §5.1) | **`FE-001` (High):** the client and server both fail to reject a `custom`-visibility post submitted with zero selected viewers — the post is created but visible to nobody, with a false "success" message. This is the exact, developer-acknowledged bug from root `TODO.md`: *"privet post is not work there is not selct people so i can add them."* |
| REQ-PO07 | Direct API authorization (no ID-iteration bypass) | PASS | — | ✓ | ✓ | ✓ | Verified: `GET /posts/{id}` collapses "doesn't exist" and "exists but hidden" into a uniform 404 | `SEC-003` (Low): mutation endpoints (`PUT`/`DELETE`) leak existence via 403-vs-404 |

## Comments

| ID | Requirement | Status | FE | BE | DB | Tests | Evidence | Notes |
|---|---|---|:--:|:--:|:--:|:--:|---|---|
| REQ-C01 | Create comment | PASS | ✓ | ✓ | ✓ | ✓ | | |
| REQ-C02 | List comments | PASS | ✓ | ✓ | ✓ | ✓ | | |
| REQ-C03 | Image/GIF in comments | PASS | ✓ | ✓ | ✓ | ✓ | | |
| REQ-C04 | Parent-post access inheritance | PASS | ✓ | ✓ | ✓ | ✓ | Fully re-derives the post's access rule, including group membership | |

## Groups

| ID | Requirement | Status | FE | BE | DB | Tests | Evidence | Notes |
|---|---|---|:--:|:--:|:--:|:--:|---|---|
| REQ-G01 | Create group (public/private) | PASS | ✓ | ✓ | ✓ | ✓ | | |
| REQ-G02 | Browse / discover groups | PASS | ✓ | ✓ | ✓ | ✓ | Private groups correctly excluded from discovery | |
| REQ-G03 | Group details view | PASS | ✓ | ✓ | ✓ | ✓ | | |
| REQ-G04 | Membership (join public via request, private via invite-only) | PASS | ✓ | ✓ | ✓ | ✓ | | `SEC-004` (Medium): mutation endpoints leak private-group *existence* (never content) via 403-vs-404 |
| REQ-G05 | Group invitations | PASS | ✓ | ✓ | ✓ | ✓ | Creator/member-invite, accept/decline, duplicate-prevention all verified | |
| REQ-G06 | Group join requests | PASS | ✓ | ✓ | ✓ | ✓ | Creator-only accept/reject, duplicate-prevention verified | |
| REQ-G07 | Member restrictions (removal, creator protection) | PASS | ✓ | ✓ | ✓ | ✓ | Creator cannot be removed; only creator can remove | |
| REQ-G08 | Group posts/comments — members-only | PASS | ✓ | ✓ | ✓ | ✓ | Strictly membership-gated independent of the stored `visibility` field | |
| REQ-G09 | Group chat — members-only | PASS | ✓ | ✓ | ✓ | ✓ | Membership re-verified at history-load, send, *and* broadcast time — no TOCTOU (see `05` §10) | This directly contradicts a stale internal doc claiming group chat isn't built at all — see `DOC-003` |

## Events

| ID | Requirement | Status | FE | BE | DB | Tests | Evidence | Notes |
|---|---|---|:--:|:--:|:--:|:--:|---|---|
| REQ-E01 | Create event (title/desc/date-time, members only) | PASS | ✓ | ✓ | ✓ | ✓ | Future-date check is server-side authoritative, explicitly documented as such in code | |
| REQ-E02 | List/view events | PASS | ✓ | ✓ | ✓ | ✓ | Cross-group event-ID-swap guard verified | |
| REQ-E03 | RSVP (going / not going) | PASS | ✓ | ✓ | ✓ | ✓ | Single-row-per-user upsert | |
| REQ-E04 | Change RSVP | PASS | ✓ | ✓ | ✓ | ✓ | | |
| REQ-E05 | Non-member restriction | PASS | ✓ | ✓ | ✓ | ✓ | | |

## Private Chat

| ID | Requirement | Status | FE | BE | DB | Tests | Evidence | Notes |
|---|---|---|:--:|:--:|:--:|:--:|---|---|
| REQ-CH01 | WebSocket delivery | PASS | ✓ | ✓ | — | ✓ | Verified end-to-end against current code | |
| REQ-CH02 | History / persistence | PASS | ✓ | ✓ | ✓ | ✓ | Offline-recipient persistence confirmed unconditional | |
| REQ-CH03 | Messaging permission rule (follow-based) | PASS | ✓ | ✓ | — | ✓ | Server-side, re-checked on every send, not cached — rule is "A follows B OR B follows A" | |
| REQ-CH04 | Text / emoji support | PASS | ✓ | ✓ | — | ✓ | | |
| REQ-CH05 | Reliable delivery across reconnects | PARTIAL | ✓ | ✓ | ✓ | — | Data persistence is solid | `WS-001` (High): messages received during a brief disconnect don't appear in the live UI until manual reload — data isn't lost, but "available on reconnect" fails at the UI layer |

## Group Chat

| ID | Requirement | Status | FE | BE | DB | Tests | Evidence | Notes |
|---|---|---|:--:|:--:|:--:|:--:|---|---|
| REQ-GC01 | Members-only send/receive | PASS | ✓ | ✓ | ✓ | ✓ | No TOCTOU bypass — independently verified twice | |
| REQ-GC02 | WebSocket delivery | PASS | ✓ | ✓ | — | ✓ | | |
| REQ-GC03 | History / persistence | PASS | ✓ | ✓ | ✓ | ✓ | | |
| REQ-GC04 | Behavior after member removal | PARTIAL | ✓ | ✓ | — | — | Authorization is correct (removed user can't send/receive) | `WS-002` (Medium): no realtime signal to the removed client — UI stays stale, no explanation given |

## Notifications

| ID | Requirement | Status | FE | BE | DB | Tests | Evidence | Notes |
|---|---|---|:--:|:--:|:--:|:--:|---|---|
| REQ-N01 | Global visibility across the app | PASS | ✓ | ✓ | ✓ | ✓ | | |
| REQ-N02 | Follow-request notification | PASS | ✓ | ✓ | ✓ | ✓ | Wired via `NotificationFollowRequest` | A stale doc claims this "doesn't exist" — verified false, see `DOC-003` |
| REQ-N03 | Group invitation notification | PASS | ✓ | ✓ | ✓ | ✓ | | |
| REQ-N04 | Group join-request notification | PASS | ✓ | ✓ | ✓ | ✓ | | |
| REQ-N05 | New group event notification | PASS | ✓ | ✓ | ✓ | ✓ | Wired via `NotificationGroupEvent` | Same stale doc also claims this "doesn't exist" — verified false |
| REQ-N06 | Unread/read state + count | PASS | ✓ | ✓ | ✓ | ✓ | Monotonic, id-keyed union merge — verified sound against every race scenario checked | |
| REQ-N07 | Real-time push | PASS | ✓ | ✓ | — | ✓ | | |

## Uploads

| ID | Requirement | Status | FE | BE | DB | Tests | Evidence | Notes |
|---|---|---|:--:|:--:|:--:|:--:|---|---|
| REQ-U01 | JPEG/PNG/GIF support | PASS | ✓ | ✓ | — | ✓ | Content-sniffed, not trust-the-client-header | |
| REQ-U02 | Filesystem/path storage behavior | PARTIAL | — | ✓ | — | ✓ | Safe filenames (UUID), path-traversal-safe deletion, size limits redundantly enforced | `SEC-001` (Medium): served with no authorization check at all — fine for public content, a real gap for non-public post/comment/event media |

## Database / Migrations

| ID | Requirement | Status | FE | BE | DB | Tests | Evidence | Notes |
|---|---|---|:--:|:--:|:--:|:--:|---|---|
| REQ-D01 | Up/down migration files | PARTIAL | — | — | ✓ | ✓ | 30 pairs, correctly ordered | `DB-001` (High): one pair is not actually reversible under valid data |
| REQ-D02 | Migration runner | PASS | — | ✓ | ✓ | ✓ | Transactional, embedded via `embed.FS`, CLI (`up`/`down`/`down-all`/`version`/`create`) | |
| REQ-D03 | Schema consistency (code vs. actual schema) | PASS | — | ✓ | ✓ | — | Application code verified fully in sync with the real schema | `docs/database/schema.dbml` (documentation, not application code) is **OUTDATED REQUIREMENT** material — 14 confirmed drift items, see `DB-007` |
| REQ-D04 | Safe migration behavior (no data-loss-risk `NOT NULL` additions) | PASS | — | — | ✓ | — | Verified: zero violations across all 30 migrations | |

---

## Requirement-Level Failures Requiring Action (summary)

| Requirement | Status | Issue ID(s) |
|---|---|---|
| Post: Private/selected-followers visibility must actually restrict to the chosen audience and never silently produce an unreadable post | **FAIL** | `FE-001` |
| Migration: every `.down.sql` must be able to reverse its `.up.sql` under data the up-migration itself permits | **FAIL** | `DB-001` |
| Docker: frontend/backend must be able to communicate when configured for a non-default (non-localhost) deployment | **PARTIAL→FAIL for the configurable case** | `DOC-001` |
| Private chat: messages sent while a recipient is briefly disconnected must become visible without manual intervention on reconnect | **PARTIAL** | `WS-001` |

## Extra / Enhancement Features (beyond the minimum requirement set — not defects)

- Full profile-details/avatar/privacy self-service editing UI (beyond the base "view profile" requirement).
- Post likes, in-app post sharing into chat, universal navbar search, follow/group recommendations ("Who to Follow," suggested groups).
- Two-tier weighted rate limiting (global + per-endpoint, with discounted costs for high-frequency reads).
- The entire 8-planet 3D visual/theming system — not part of any written requirement, a self-directed enhancement.
- Typing indicators and read receipts in private chat.

None of these introduce a defect by their mere existence; where they do have implementation issues, those are logged in the relevant subsystem files and the issue register under their own IDs, not held against the base requirement set.
