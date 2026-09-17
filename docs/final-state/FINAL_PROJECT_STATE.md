# Final Project State

## Purpose and authority

This document is the consolidated internal truth for the repository state audited on 2026-09-17 at commit `0fa6276fd2daff461a33b47aa599324f0bfa02b0` on branch `feat/auth-regester-page`.

Evidence was reconciled in this order:

1. Confirmed runtime behavior in `docs/runtime-review/`.
2. Confirmed current-source findings in `docs/project-review/`.
3. Implementation evidence in `docs/ai-handoff/`.
4. Current requirements and current documentation.
5. Git history and old planning material.

This is a synthesis, not a fresh whole-repository audit. Targeted checks were limited to current command/configuration facts needed to resolve wording. Public classifications mean:

- **A — Safe to present publicly:** the core flow exists and works.
- **B — Safe with careful wording:** the capability exists, but an unrestricted claim would overstate it.
- **C — Do not present as implemented:** the core flow is materially incomplete or broken.
- **D — Internal issue only:** defects or debt that do not need to appear in public project copy.
- **E — Historical/journey only:** removed or superseded designs.

## Executive conclusion

The application is a working full-stack social network with a Next.js/React frontend, Go HTTP/WebSocket backend, SQLite persistence, embedded migrations, local Docker Compose topology, and an active configurable 3D space presentation. Runtime testing confirmed the principal user flows: registration and login, profile privacy, following, all three post-visibility modes when a valid audience is supplied, comments and likes, group privacy and membership workflows, events and RSVP changes, private and group chat, notification persistence/push, and validated uploads.

No core subsystem is wholly absent or blocked. Public documentation can accurately present the product now, provided it avoids claims of production readiness, multi-device session support, complete WebSocket logout revocation, automatic chat catch-up after reconnect, private authorization on raw uploaded files, arbitrary deployment origins, complete frontend automated coverage, or fully reversible migration history.

## Reconciled contradictions

| Topic | Earlier/static evidence | Higher-priority runtime evidence | Final conclusion |
|---|---|---|---|
| Group chat existence | Old internal docs called it disabled or incomplete; both audit sets found current code | Send, broadcast, history, outsider denial, and active membership revocation all passed | Implemented and README-safe with precise membership/history wording; old claims are historical/stale |
| Removed group member on an open socket | Static review found no client-facing removal event and stale UI | Runtime proved the removed user immediately stops receiving and cannot send | Authorization is correct; missing UI invalidation remains an internal UX issue |
| Sessions | Static review found a non-atomic session row check that can race into duplicate rows | Normal second login overwrote the existing token and invalidated the first browser | Concurrent multi-device sessions are not supported reliably; runtime behavior takes priority, while the true-concurrency race remains possible |
| WebSocket authentication lifecycle | Static review confirmed authentication at the upgrade handshake | Runtime proved an already-open socket remains usable after REST logout | Do not claim complete session revocation across realtime connections |
| Group invitations | One requirements row ambiguously said “creator/member-invite”; source review said creator-only | Runtime returned 403 for a member and 201 for the creator | Current behavior is creator-managed invitations only |
| Post custom audience | Runtime proved enforcement for a non-empty selected-follower list | Static review proved an empty custom audience is accepted with a success result | The privacy rule works, but the full authoring flow is partial and requires careful public wording |
| Upload privacy | Static review found raw file URLs are not authorization-gated | Runtime additionally found browsable directory indexes | Upload validation works; uploaded media must not be presented as access-controlled private storage |
| Docker/deployment | Compose configuration and local service topology validate | Runtime CORS probes failed for every non-`localhost:3000` origin; the frontend ignores origin environment variables | Docker is safe to describe only as a default localhost/containerized development setup |
| Migrations | 30 up/down pairs and runner were verified | Static reproduction showed one down migration fails with valid history rows; startup applied all up migrations | Automated/transactional up migration is safe to claim; universal reversibility is not |

## Authentication

| Field | Final state |
|---|---|
| **Status** | Implemented; core registration, login, authenticated requests, password hashing, and REST logout pass. |
| **Core behavior** | Username-or-email login; bcrypt password verification; generic invalid-credential response; authenticated user context from a session cookie. |
| **Frontend status** | Multi-step registration and login pages are wired and the browser login flow redirected successfully into the authenticated app. |
| **Backend status** | Go handlers/services validate credentials and issue/revoke server-side sessions. |
| **Database status** | Users and sessions are persisted in SQLite; session tokens are stored with expiry/revocation fields. |
| **Runtime status** | Valid registration returned 201; valid login returned 200 and a cookie; bad credentials were rejected; REST logout revoked the token. |
| **Known internal issues** | Case-sensitive username uniqueness (`AUTH-001`), registration conflict enumeration (`AUTH-002`), state-changing GET logout (`AUTH-004`), unauthenticated GET login returns 405 (`RT-AUTH-001`), and logout does not terminate an already-open socket (`RT-WS-001`). |
| **Public README classification** | **A** for registration/login/logout; **B** for broad security/session-lifecycle claims. |
| **Confidence** | High. |
| **Evidence sources** | Runtime `02_AUTH_SESSION_E2E.md`, static `05_AUTH_SECURITY_PRIVACY_REVIEW.md`, handoff `EVIDENCE_INDEX.md`. |

## Registration

| Field | Final state |
|---|---|
| **Status** | Implemented and runtime-verified. |
| **Core behavior** | Requires username, password, first/last name, email, age/date-of-birth data; supports optional nickname, biography, and avatar. Registration uses multipart form data and does not auto-login. |
| **Frontend status** | Three-stage form with per-step validation and 3D planet presentation. |
| **Backend status** | Server-side validation, duplicate checks, content-sniffed avatar validation, and bcrypt hashing. |
| **Database status** | User fields and later profile extensions are represented by migrations and current schema. |
| **Runtime status** | Valid, invalid, missing-field, invalid-email, overlong-username, and duplicate-account cases behaved as expected. |
| **Known internal issues** | Conflict responses distinguish username from email; avatar WebP is intentionally not accepted. |
| **Public README classification** | **A**. |
| **Confidence** | High. |
| **Evidence sources** | Runtime `02_AUTH_SESSION_E2E.md`, static `01_REQUIREMENTS_COMPLIANCE.md`, handoff `README_HANDOFF.md`. |

## Sessions and cookies

| Field | Final state |
|---|---|
| **Status** | Implemented for normal single-session REST use; partial for multi-device and cross-transport revocation semantics. |
| **Core behavior** | A 64-hex-character token is set in an `HttpOnly`, `SameSite=Lax`, path `/` cookie with a 24-hour sliding expiry. REST logout revokes the session and clears the cookie. |
| **Frontend status** | Credentials are used for API requests; authenticated page reload preserved the tested session. |
| **Backend status** | Middleware validates and refreshes sessions on authenticated HTTP requests. WebSocket authentication happens at upgrade only. |
| **Database status** | The normal second login updates the existing user session token. The non-atomic check/write and missing `UNIQUE(user_id)` constraint can still race. |
| **Runtime status** | A second login invalidated the first browser's token. An open socket survived logout and could continue messaging. Multiple tabs sharing one active token received fan-out correctly. |
| **Known internal issues** | `RT-SESSION-001`/`DB-005`/`AUTH-005`, `RT-WS-001`, hardcoded `Secure=false` (`AUTH-003`), startup-only expired-session cleanup (`BE-003`). |
| **Public README classification** | **B**. Say “cookie-based sessions with 24-hour sliding expiry”; do not claim multi-device support or immediate socket revocation. |
| **Confidence** | High. |
| **Evidence sources** | Runtime `02_AUTH_SESSION_E2E.md`, `10_WEBSOCKET_RESILIENCE.md`, `12_MULTIUSER_MULTITAB_EDGE_CASES.md`; static `03_BACKEND_REVIEW.md`, `05_AUTH_SECURITY_PRIVACY_REVIEW.md`. |

## Profiles

| Field | Final state |
|---|---|
| **Status** | Implemented and strongly runtime-verified. |
| **Core behavior** | Users view and edit their profile, avatar, biography, personal details, and public/private state. Private profiles mask biography from non-followers; owner-only data stays private. |
| **Frontend status** | Profile view/edit and privacy controls are integrated. |
| **Backend status** | Response shaping applies viewer-specific field masking. |
| **Database status** | `users` contains privacy and extended profile fields. |
| **Runtime status** | Public, owner, private non-follower, and approved-follower personas returned the expected field sets. Email, date of birth, age, and UUID were not exposed to third parties. |
| **Known internal issues** | No core privacy bypass found. Minor issues are internal only. |
| **Public README classification** | **A**. |
| **Confidence** | High. |
| **Evidence sources** | Runtime `03_PROFILES_FOLLOWERS_E2E.md`; static `01_REQUIREMENTS_COMPLIANCE.md`, `05_AUTH_SECURITY_PRIVACY_REVIEW.md`. |

## Followers

| Field | Final state |
|---|---|
| **Status** | Implemented and runtime-verified. |
| **Core behavior** | Public profiles follow immediately; private profiles create requests; target users accept/decline; users can unfollow; self/duplicate relationships are prevented. |
| **Frontend status** | Follow actions, pending state, lists, and recommendations are wired. |
| **Backend status** | Target scoping and database-backed permission checks prevent another user from accepting a request. |
| **Database status** | Followers and follow requests use pair constraints and request-state handling. |
| **Runtime status** | `none → requested → following` and decline/unfollow transitions passed; private list access was denied to outsiders. |
| **Known internal issues** | Some list queries are unbounded (`DB-008`); decline history is overwritten (`DB-011`). |
| **Public README classification** | **A**. |
| **Confidence** | High. |
| **Evidence sources** | Runtime `03_PROFILES_FOLLOWERS_E2E.md`; static `01_REQUIREMENTS_COMPLIANCE.md`, handoff `EVIDENCE_INDEX.md`. |

## Post privacy and feeds

| Field | Final state |
|---|---|
| **Status** | Public and followers-only flows pass; custom-audience enforcement passes with selected followers, but empty custom audiences are accepted. |
| **Core behavior** | Text/media posts, cursor-based feed pagination, `all`/`following`/`friends` filters, and `public`/`followers`/`custom` visibility. Custom viewers must be followers. |
| **Frontend status** | Creation/edit forms and custom viewer picker exist; both omit the non-empty custom-audience validation guard. |
| **Backend status** | Direct reads, feed queries, and comment access enforce visibility at the query/service layer; validation also permits empty custom audiences. |
| **Database status** | `posts.visibility`, `post_allowed_viewers`, `post_media`, likes, and optional `group_id` are current. |
| **Runtime status** | A five-persona matrix confirmed public, follower, selected custom viewer, unselected follower, and outsider behavior. Likes were idempotent and feed filters responded. |
| **Known internal issues** | `FE-001` empty-audience success; raw uploaded media is outside post authorization (`SEC-001`); feed scan/index concerns (`DB-004`). |
| **Public README classification** | **B**. It is safe to say “public, followers-only, and selected-follower visibility,” but not “every invalid privacy configuration is prevented” or “private media is access-controlled.” |
| **Confidence** | High. |
| **Evidence sources** | Runtime `04_POSTS_COMMENTS_PRIVACY_E2E.md`; static `02_FRONTEND_REVIEW.md`, `05_AUTH_SECURITY_PRIVACY_REVIEW.md`. |

## Comments

| Field | Final state |
|---|---|
| **Status** | Implemented and runtime-verified. |
| **Core behavior** | Create/list/delete comments with optional image/GIF attachment; access inherits the parent post's visibility, including group membership. |
| **Frontend status** | Composer, list, counts, upload validation, and deletion flows are present. |
| **Backend status** | Direct comment reads/writes re-derive parent-post access. |
| **Database status** | Comments reference posts and users; post deletion cascades. |
| **Runtime status** | Authorized comment creation/count passed; an unauthorized commenter received 404 on restricted content. |
| **Known internal issues** | Lists are unbounded (`DB-008`), mutation error codes can leak resource existence (`SEC-003`), and raw media URLs are public. |
| **Public README classification** | **A** for comments; **B** if describing media privacy. |
| **Confidence** | High. |
| **Evidence sources** | Runtime `04_POSTS_COMMENTS_PRIVACY_E2E.md`; static `01_REQUIREMENTS_COMPLIANCE.md`, `05_AUTH_SECURITY_PRIVACY_REVIEW.md`. |

## Groups

| Field | Final state |
|---|---|
| **Status** | Implemented and runtime-verified. |
| **Core behavior** | Create public/private groups, browse eligible groups, view details, manage membership, publish member-only posts/comments, and protect the creator role. |
| **Frontend status** | Directory, creation, group detail, content, chat, event, and settings surfaces are present. |
| **Backend status** | Membership and creator authorization live in the service layer. |
| **Database status** | Groups, members, invitations, join requests, posts, messages, events, and responses are linked by foreign keys. |
| **Runtime status** | Creation, public join workflow, private isolation, member content access, and creator-only mutations passed. |
| **Known internal issues** | Some mutation endpoints reveal the existence of a private group through 403-vs-404 (`SEC-004`); group package maintainability is an internal concern (`BE-004`). |
| **Public README classification** | **A**. |
| **Confidence** | High. |
| **Evidence sources** | Runtime `05_GROUPS_EVENTS_E2E.md`; static `03_BACKEND_REVIEW.md`, `05_AUTH_SECURITY_PRIVACY_REVIEW.md`. |

## Group privacy

| Field | Final state |
|---|---|
| **Status** | Core privacy model implemented and runtime-verified. |
| **Core behavior** | Public groups are discoverable and use creator-approved join requests; private groups are hidden from the directory/direct read and are invite-only. Group content is membership-gated. |
| **Frontend status** | Privacy choice and membership-specific UI states exist. |
| **Backend status** | Read paths hide private groups and member-only resources; join requests are rejected for private groups. |
| **Database status** | `groups.privacy` supports `public` and `private`. |
| **Runtime status** | Outsiders could not discover or directly read private groups and could not read content/events. |
| **Known internal issues** | Private group existence can be inferred on selected mutation endpoints (`SEC-004`), without content disclosure. |
| **Public README classification** | **A** for the user-facing model; the existence oracle remains **D**. |
| **Confidence** | High. |
| **Evidence sources** | Runtime `05_GROUPS_EVENTS_E2E.md`; static `05_AUTH_SECURITY_PRIVACY_REVIEW.md`. |

## Invitations

| Field | Final state |
|---|---|
| **Status** | Implemented as a creator-managed invitation workflow. |
| **Core behavior** | The group creator invites an eligible user; the invitee lists and accepts/declines the invitation; accepted invitations create membership. |
| **Frontend status** | Invitation modal/search and invitee response UI are wired. |
| **Backend status** | Invitation creation is restricted to the creator; payload key is `invited_user_id`. |
| **Database status** | Invitation rows preserve status with a partial unique constraint for pending attempts. |
| **Runtime status** | Member invite returned 403, creator invite 201, invite listing and acceptance 200. |
| **Known internal issues** | One older static requirement row used ambiguous “creator/member-invite” wording; runtime resolves this to creator-only. The related down migration is not fully reversible (`DB-001`). |
| **Public README classification** | **A**, worded “creator-managed invitations.” |
| **Confidence** | High. |
| **Evidence sources** | Runtime `05_GROUPS_EVENTS_E2E.md`; static `01_REQUIREMENTS_COMPLIANCE.md`, `05_AUTH_SECURITY_PRIVACY_REVIEW.md`. |

## Join requests

| Field | Final state |
|---|---|
| **Status** | Implemented and runtime-verified for public groups. |
| **Core behavior** | Outsiders request to join a public group; duplicates are blocked; only the creator accepts/rejects; private groups reject join requests. |
| **Frontend status** | Request state and creator review controls exist. |
| **Backend status** | Creator and target scoping are enforced. |
| **Database status** | Pending uniqueness permits later retry/history states. |
| **Runtime status** | Submit, duplicate conflict, non-creator rejection, creator approval, and membership transition passed. |
| **Known internal issues** | Down-migration reversibility for repeated attempts (`DB-001`). |
| **Public README classification** | **A**. |
| **Confidence** | High. |
| **Evidence sources** | Runtime `05_GROUPS_EVENTS_E2E.md`; static `04_DATABASE_MIGRATIONS_REVIEW.md`. |

## Events

| Field | Final state |
|---|---|
| **Status** | Implemented and runtime-verified. |
| **Core behavior** | Group members create future-dated events, view group events, and set/change `going` or `not_going` responses. |
| **Frontend status** | Event cards, creation, image/template selection, countdown, and RSVP controls are present. |
| **Backend status** | Membership and future-time rules are server-enforced; RSVP uses a per-user upsert. |
| **Database status** | Events and event responses are related to groups/users with a unique response per user/event. |
| **Runtime status** | Past event rejected, outsider rejected, member creation succeeded, and RSVP changes updated counts. |
| **Known internal issues** | Event listing is unbounded (`DB-008`); raw cover media has no access gate. |
| **Public README classification** | **A**. |
| **Confidence** | High. |
| **Evidence sources** | Runtime `05_GROUPS_EVENTS_E2E.md`; static `01_REQUIREMENTS_COMPLIANCE.md`. |

## Private chat

| Field | Final state |
|---|---|
| **Status** | Core realtime send/receive/history works; reconnect catch-up in an already-open UI is partial. |
| **Core behavior** | Follow-based one-to-one messaging when either user follows the other, persisted history, typing indicators, read receipts, unread conversation state, and shared-post previews. |
| **Frontend status** | Two-pane responsive chat UI, contact eligibility, history paging, typing/read state, and post preview rendering are integrated. |
| **Backend status** | Permission is rechecked on each send; messages persist before delivery; events fan out to sender and recipient. |
| **Database status** | `private_messages` stores content, timestamps, and read time; shared posts travel as message links/content and render as previews client-side. |
| **Runtime status** | Mutual and one-way eligible messaging passed; unrelated users were rejected; typing, receipts, offline persistence, rapid ordering, and same-session multi-tab fan-out passed. |
| **Known internal issues** | No automatic history resync after reconnect (`WS-001`), pagination duplicate race (`WS-003`), and a logged-out existing socket remains usable (`RT-WS-001`). |
| **Public README classification** | **B**. Safe: “realtime private chat with persisted history, typing indicators, and read receipts.” Avoid guaranteed seamless reconnect recovery. |
| **Confidence** | High. |
| **Evidence sources** | Runtime `06_PRIVATE_CHAT_E2E.md`, `10_WEBSOCKET_RESILIENCE.md`; static `06_REALTIME_CHAT_NOTIFICATIONS_REVIEW.md`. |

## Group chat

| Field | Final state |
|---|---|
| **Status** | Core members-only send/receive/history works and authorization reacts immediately to removal. |
| **Core behavior** | Persisted group messages broadcast over the shared WebSocket connection; history and send/receive require current membership. |
| **Frontend status** | Complete group-chat shell, composer, timeline, members/info UI, pagination, and transport hooks. |
| **Backend status** | Membership is queried at history load, every send, and broadcast recipient resolution; the hub does not cache room permissions. |
| **Database status** | `group_messages` links messages to groups and users. |
| **Runtime status** | Creator/member delivery, outsider isolation, history denial, and immediate active-socket revocation after member removal all passed. |
| **Known internal issues** | Removed client receives no explicit removal event and UI remains stale (`WS-002`); reconnect history is not automatically resynced (`WS-001`). Per-message member lookups are a scale observation, not a current failure. |
| **Public README classification** | **A** for group chat existence and membership enforcement; **B** for reliability/UX superlatives. |
| **Confidence** | High. |
| **Evidence sources** | Runtime `07_GROUP_CHAT_E2E.md`; static `05_AUTH_SECURITY_PRIVACY_REVIEW.md`, `06_REALTIME_CHAT_NOTIFICATIONS_REVIEW.md`. |

## Notifications

| Field | Final state |
|---|---|
| **Status** | Implemented and runtime-verified. |
| **Core behavior** | Persisted notifications, unread count, individual/all read mutations, realtime push, in-app toasts, and offline retrieval. |
| **Frontend status** | Global provider merges REST and WebSocket data by ID with monotonic read state. |
| **Backend status** | Business triggers persist notifications and push the same event shape to active users. |
| **Database status** | Notifications store receiver, actor, type/entity, and read timestamp. |
| **Runtime status** | Like, comment, and invitation triggers pushed quickly and persisted; read scoping, mark-all, offline retrieval, and stale-REST merge passed. |
| **Known internal issues** | Deleting an actor cascades away other users' notification rows (`DB-002`); this does not affect ordinary notification delivery. |
| **Public README classification** | **A**. |
| **Confidence** | High. |
| **Evidence sources** | Runtime `08_NOTIFICATIONS_E2E.md`; static `06_REALTIME_CHAT_NOTIFICATIONS_REVIEW.md`. |

## Uploads

| Field | Final state |
|---|---|
| **Status** | Upload validation/storage works; static serving is public and directory-browsable. |
| **Core behavior** | UUID filenames, dedicated subdirectories, 5 MiB limits, magic-byte MIME detection, and safe deletion paths. Formats vary by target: avatars/groups accept JPEG/PNG/GIF; posts/comments/events also accept WebP. |
| **Frontend status** | Forms validate files and clean preview object URLs. |
| **Backend status** | Upload helpers inspect bytes rather than trusting extension/header. Static delivery uses `http.FileServer`. |
| **Database status** | Paths are stored on user/group/event/comment records and in `post_media`. |
| **Runtime status** | Valid PNG/GIF accepted; spoofed text, PDF, oversize, wrong field, and disallowed avatar WebP rejected. Direct files and directory indexes were accessible without authentication. |
| **Known internal issues** | No asset-level authorization and open directory listing (`SEC-001`/`RT-UPLOAD-001`); raw OS upload failures may leak paths (`BE-002`). |
| **Public README classification** | **B**. Say “validated image uploads with filesystem storage”; do not call the media store private or authorization-gated. |
| **Confidence** | High. |
| **Evidence sources** | Runtime `09_UPLOADS_MEDIA_E2E.md`; static `03_BACKEND_REVIEW.md`, `05_AUTH_SECURITY_PRIVACY_REVIEW.md`. |

## WebSockets

| Field | Final state |
|---|---|
| **Status** | Multiplexed realtime transport works; lifecycle authorization has a post-logout gap. |
| **Core behavior** | One `/api/ws` connection carries private/group messages, typing, receipts, notifications, presence, RSVP sync, follow removal, invite search, and error events. |
| **Frontend status** | A global provider reconnects, queues outgoing events while disconnected, and fans events to feature subscribers. It also connects repeatedly on unauthenticated pages. |
| **Backend status** | Gorilla WebSocket hub supports multiple connections per user, nonblocking delivery, and single-writer discipline; handshake requires a valid session. |
| **Database status** | Persistent events are written through domain services; ephemeral presence/typing are hub-only. |
| **Runtime status** | Multi-tab fan-out, concurrent bidirectional messages, chat delivery, membership checks, and notifications passed. Existing sockets were not invalidated by logout. |
| **Known internal issues** | `RT-WS-001`, unauthenticated reconnect loop (`RT-WS-002`), permissive `CheckOrigin` (`SEC-002`), and chat catch-up gap (`WS-001`). |
| **Public README classification** | **B**. Safe: “single multiplexed WebSocket channel for chat and notifications.” Avoid “fully session-bound” or “seamless reconnect recovery.” |
| **Confidence** | High. |
| **Evidence sources** | Runtime `06_PRIVATE_CHAT_E2E.md`, `07_GROUP_CHAT_E2E.md`, `08_NOTIFICATIONS_E2E.md`, `10_WEBSOCKET_RESILIENCE.md`; static `06_REALTIME_CHAT_NOTIFICATIONS_REVIEW.md`. |

## Migrations

| Field | Final state |
|---|---|
| **Status** | Automated up migrations and runner work; full down-chain reversibility is partial. |
| **Core behavior** | 30 timestamped up/down pairs are embedded with `embed.FS`, run transactionally, and apply automatically at server startup. CLI supports `up`, `down`, `down-all`, `version`, and `create`. |
| **Frontend status** | Not applicable. |
| **Backend status** | Server startup calls migration-up; a separate CLI and seeder binary are available. |
| **Database status** | Current application code matches the actual migrated schema; `schema.dbml` is stale. One historical down migration fails after valid repeated invitation/join-request history. |
| **Runtime status** | All 30 up migrations applied cleanly; `go run ./cmd/migrate version` reported the latest version. The failing down migration was reproduced in the static audit. |
| **Known internal issues** | `DB-001` non-reversible pair; documentation drift (`DB-007`); indexing/timestamp/query issues remain internal. |
| **Public README classification** | **B**. Say “embedded, transactional migrations with startup automation and CLI”; do not say every migration is safely reversible. |
| **Confidence** | High. |
| **Evidence sources** | Runtime `00_RUNTIME_EXECUTIVE_SUMMARY.md`; static `04_DATABASE_MIGRATIONS_REVIEW.md`; handoff `VERIFICATION_LOG.md`. |

## Docker

| Field | Final state |
|---|---|
| **Status** | Default localhost Compose configuration is strongly confirmed; portable/non-localhost deployment is not supported by current origin handling. |
| **Core behavior** | `compose.yaml` builds backend and frontend, maps ports 8080/3000, persists `/app/data` in `backend-data`, and supplies frontend build arguments. |
| **Frontend status** | Dockerfile and Compose exist, but API/WS helpers ignore backend-origin environment variables. |
| **Backend status** | Dockerfile and `SERVER_PORT` configuration exist; CORS is fixed to `http://localhost:3000`. |
| **Database status** | Named volume retains the SQLite database and uploads. |
| **Runtime status** | `docker compose config` passed. Native backend/frontend runtime passed. A full Compose cluster launch was not performed by either verification pass. Non-localhost CORS failed at runtime. |
| **Known internal issues** | `DOC-001`/`RT-CONTRACT-001`/`RT-CONTRACT-002`; no `.env.example` (`DOC-004`). |
| **Public README classification** | **B**. Describe Docker-based local/containerized setup at the default localhost ports, not a production deployment system. |
| **Confidence** | Medium-high for the default topology; high that non-localhost flexibility is broken. |
| **Evidence sources** | Runtime `01_TEST_ENVIRONMENT.md`, `11_FRONTEND_BACKEND_INTEGRATION.md`; static `08_TESTING_RUNTIME_REVIEW.md`, `10_DOCUMENTATION_CONFIG_REVIEW.md`. |

## 3D / space experience

| Field | Final state |
|---|---|
| **Status** | Active, current, and integrated; not dormant or historical. |
| **Core behavior** | Eight selectable bodies (`earth`, `mercury`, `venus`, `mars`, `jupiter`, `saturn`, `uranus`, `sun`) plus Earth's Moon; dynamic CSS theme variables; responsive transforms; cross-tab preference persistence; true unmount when disabled. |
| **Frontend status** | Mounted as a nonblocking background across authenticated layouts and used in login/registration stages. Settings expose planet, model-enabled, and scroll-follow preferences. |
| **Backend status** | Not applicable. |
| **Database status** | Preferences are browser-local, not database-backed. |
| **Runtime status** | Login page rendered the 3D backdrop in browser automation; build generated all routes. Static asset/registry consistency is 9/9. |
| **Known internal issues** | Eager library bundling (`3D-001`), bounded GLTF cache retention (`3D-002`), large Moon asset (`3D-003`), differing mobile treatment (`3D-004`), and stale asset docs (`DOC-005`). |
| **Public README classification** | **A** for the current experience; the old route-intercepting solar-system system is **E**. |
| **Confidence** | High. |
| **Evidence sources** | Static `07_3D_SPACE_PERFORMANCE_REVIEW.md`; handoff `PROJECT_HISTORY.md`, `README_HANDOFF.md`; runtime `02_AUTH_SESSION_E2E.md`. |

## Settings

| Field | Final state |
|---|---|
| **Status** | Implemented. |
| **Core behavior** | Segmented profile, avatar, privacy/security, password, appearance/planet, and session-oriented settings. |
| **Frontend status** | `/settings` is a built route with validated forms and appearance controls. |
| **Backend status** | Profile, avatar, privacy, and password mutation endpoints are wired. |
| **Database status** | Profile/privacy/password changes persist; 3D preferences are localStorage-backed. |
| **Runtime status** | Supporting profile/auth APIs passed; full settings-page click-through was not separately enumerated in runtime reports. |
| **Known internal issues** | A root TODO mentions removing session information from settings; this is a polish/product decision, not evidence that the settings route is absent. |
| **Public README classification** | **A** for profile/privacy/appearance settings; omit detailed session-management promises. |
| **Confidence** | Medium-high. |
| **Evidence sources** | Handoff `EVIDENCE_INDEX.md`, `PROJECT_HISTORY.md`; static `02_FRONTEND_REVIEW.md`, `01_REQUIREMENTS_COMPLIANCE.md`. |

## Responsive UI

| Field | Final state |
|---|---|
| **Status** | Broad responsive behavior is implemented; no automated frontend viewport suite exists. |
| **Core behavior** | Feed/composer grids collapse at narrow widths; chat becomes a mobile single-pane flow; inputs account for iOS zoom; planet transforms adapt by viewport; auth pages use a lightweight mobile orb fallback. |
| **Frontend status** | Responsive CSS and viewport-aware 3D logic were statically reviewed. |
| **Backend status** | Not applicable. |
| **Database status** | Not applicable. |
| **Runtime status** | Browser runtime covered core pages but did not constitute a full cross-device visual regression suite. |
| **Known internal issues** | Minor text truncation (`FE-006`) and inconsistent mobile 3D gating (`3D-004`). |
| **Public README classification** | **A** for “responsive interface”; avoid exhaustive device/browser compatibility claims. |
| **Confidence** | Medium-high. |
| **Evidence sources** | Static `02_FRONTEND_REVIEW.md`, `07_3D_SPACE_PERFORMANCE_REVIEW.md`; runtime `01_TEST_ENVIRONMENT.md`. |

## Testing and quality

| Field | Final state |
|---|---|
| **Status** | Backend quality automation is strong; frontend validation is build/lint/typecheck only. |
| **Core behavior** | Backend black-box integration suites cover 16 packages; full race detector passes; frontend lint, TypeScript, and production build pass. |
| **Frontend status** | Zero automated component/E2E test infrastructure. The declared `test:smoke` script points to a missing file and must not be documented as working. |
| **Backend status** | `go build`, `go vet`, `go test`, and `go test -race` passed; the suite uses real SQLite/HTTP test setups and includes hub concurrency coverage. |
| **Database status** | Migration runner tests exist; they did not catch every individual down-pair defect. |
| **Runtime status** | Independent browser/API/WebSocket runtime audit exercised the main multi-user flows. |
| **Known internal issues** | `TEST-001` no frontend tests/missing smoke script; `TEST-002` thin search coverage; some live reconnect/session cases are not in automated regression tests. |
| **Public README classification** | **B**. List the verified checks precisely; do not claim full-stack automated E2E or comprehensive frontend coverage. |
| **Confidence** | High. |
| **Evidence sources** | Static `08_TESTING_RUNTIME_REVIEW.md`; handoff `VERIFICATION_LOG.md`; all runtime E2E reports. |

## Final public classification summary

| Classification | Subsystems/facts |
|---|---|
| **A — Safe publicly** | Registration/login core, profile privacy, follower workflows, comments, group creation/membership/privacy, creator invitations, public-group join requests, events/RSVPs, notification center, current 3D experience, profile/privacy/appearance settings, responsive interface. |
| **B — Careful wording** | Sessions/cookies, custom post privacy, private/group chat reliability, raw media uploads, WebSocket security lifecycle, migrations, Docker/local setup, testing breadth. |
| **C — Do not present as implemented** | Multi-device concurrent sessions; automatic missed-chat recovery after reconnect; asset-level private-media authorization; configurable non-localhost deployment; complete frontend automated test suite; universally reversible down migrations. |
| **D — Internal only** | Performance/indexing, protocol consistency, accessibility gaps, stale caches/timers, code organization, minor API contract observations, and the remaining issue backlog. |
| **E — Historical only** | Route-intercepting GSAP solar-system navigation, separate group-post tables, black-hole UI concept, and claims that current group chat/3D are dormant. |
