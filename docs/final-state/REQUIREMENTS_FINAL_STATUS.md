# Requirements Final Status

## Method

This matrix reconciles the original requirement set summarized in `docs/project-review/01_REQUIREMENTS_COMPLIANCE.md` with the runtime scenarios in `docs/runtime-review/` and the implementation evidence in `docs/ai-handoff/`.

Final statuses use only:

- `PASS`
- `PASS WITH MINOR INTERNAL ISSUE`
- `PARTIAL`
- `FAIL`
- `NOT VERIFIED`
- `EXTRA FEATURE`
- `HISTORICAL / NO LONGER APPLICABLE`

README impact uses only:

- `Safe to mention`
- `Mention carefully`
- `Do not mention as completed`
- `Historical only`

Runtime evidence takes priority. “Not separately exercised” means the runtime audit did not isolate that exact subcase; it does not erase source/test evidence.

## Technology and platform

| ID | Requirement | Final status | Why | Runtime evidence | Source evidence | README impact |
|---|---|---|---|---|---|---|
| `REQ-T01` | Go backend | PASS | Current backend and three CLI binaries compile; server uses the Go standard HTTP stack. | Native Go backend served all tested flows. | `backend/go.mod`; project review `08`; handoff verification log. | Safe to mention |
| `REQ-T02` | JavaScript framework frontend | PASS | Next.js/React/TypeScript frontend builds and exposes the current route set. | Browser E2E ran against Next.js 16.3.2; production build passed. | `frontend/package.json`; project review `08`. | Safe to mention |
| `REQ-T03` | SQLite | PASS | SQLite is the active relational store with foreign keys, WAL, and serialized pooling. | Runtime services and all test data used SQLite successfully. | Project review `04`; handoff evidence index. | Safe to mention |
| `REQ-T04` | WebSockets | PASS | Private/group chat, notifications, typing, receipts, presence, and live updates use Gorilla WebSocket. | Multi-client delivery, group broadcast, notifications, and multi-tab fan-out passed. | Runtime `06`–`10`; project review `06`. | Safe to mention |
| `REQ-T05` | Sessions | PARTIAL | Normal REST session validation/sliding expiry works, but a second login invalidates the first token and REST logout does not invalidate an existing socket. | `RT-SESSION-001` and `RT-WS-001` reproduced. | Runtime `02`, `10`, `12`; project review `05`. | Mention carefully |
| `REQ-T06` | Cookies | PASS WITH MINOR INTERNAL ISSUE | `HttpOnly`, `SameSite=Lax`, expiry, and clear-on-logout work for local HTTP. `Secure` is fixed false. | Cookie attributes and browser persistence verified. | Runtime `02`; `AUTH-003`. | Mention carefully |
| `REQ-T07` | Migrations | PARTIAL | Embedded transactional up migrations and CLI work, but one valid-state down migration is not reversible. | All 30 up migrations applied; version command reached latest. | `DB-001`; project review `04`; handoff verification log. | Mention carefully |
| `REQ-T08` | Docker | PARTIAL | Compose and both service definitions support the exact default localhost topology; configurable/non-localhost origins do not work. | Compose config passed; native services passed; alternate-origin CORS failed; full Compose launch was not run. | `DOC-001` / `RT-CONTRACT-001` / `RT-CONTRACT-002`. | Mention carefully |

## Authentication

| ID | Requirement | Final status | Why | Runtime evidence | Source evidence | README impact |
|---|---|---|---|---|---|---|
| `REQ-A01` | Registration with username, password, first/last name, email, and DOB/age fields | PASS | Required fields and validation exist end to end. | Valid request returned 201; invalid/missing/duplicate cases were rejected. | Runtime `02`; project review `01`. | Safe to mention |
| `REQ-A02` | Optional avatar, nickname, and About Me | PASS | Registration/profile schema and UI support all optional fields. | Avatar upload and profile payloads verified; registration without avatar passed. | Runtime `02`, `03`, `09`; source review. | Safe to mention |
| `REQ-A03` | Login | PASS | Username or email credentials authenticate with a generic failure response. | Browser and direct API login passed; invalid credentials returned 401. | Runtime `02`. | Safe to mention |
| `REQ-A04` | Persistent/sliding session | PASS | Authenticated HTTP requests refresh a 24-hour expiry and browser reload preserves the session. | Login, cookie persistence, and authenticated reload passed. | Runtime `02`; middleware source trace. | Safe to mention |
| `REQ-A05` | Logout | PARTIAL | REST cookie clearing and session revocation work, but an already-open WebSocket remains usable. | Subsequent REST requests failed; existing socket still sent a message. | Runtime `02`, `10`; `RT-WS-001`. | Mention carefully |
| `REQ-A06` | Password hashing | PASS | bcrypt cost 10 is used and hashes never appear in responses. | Valid/invalid password behavior passed. | Project review `05`; handoff evidence index. | Safe to mention |

## Profiles

| ID | Requirement | Final status | Why | Runtime evidence | Source evidence | README impact |
|---|---|---|---|---|---|---|
| `REQ-P01` | Own profile view/edit | PASS | Owner can view/edit profile details, avatar, privacy, and password through current UI/APIs. | Own profile and avatar update APIs passed; settings click-through was not separately enumerated. | Project review `01`, `02`; handoff evidence index. | Safe to mention |
| `REQ-P02` | Other users' profiles | PASS | Public summary/profile views exist with viewer-aware response shaping. | Public and private target profiles tested across personas. | Runtime `03`. | Safe to mention |
| `REQ-P03` | Public/private state | PASS | Privacy toggle is persisted and changes follower-gated visibility. | Private/public profile behavior verified. | Runtime `03`; project review `05`. | Safe to mention |
| `REQ-P04` | Profile visibility rules | PASS | Owner-only identity data is never returned to third parties; private biography/social lists are follower-gated. | Full field matrix and followers/following access checks passed. | Runtime `03`; project review `05`. | Safe to mention |

## Followers

| ID | Requirement | Final status | Why | Runtime evidence | Source evidence | README impact |
|---|---|---|---|---|---|---|
| `REQ-F01` | Follow a public profile immediately | PASS | Direct follow relationship is created for public targets. | State transition verified. | Runtime `03`; project review `01`. | Safe to mention |
| `REQ-F02` | Follow a private profile through a pending request | PASS | Private targets receive pending requests rather than immediate follows. | `none → requested` verified. | Runtime `03`. | Safe to mention |
| `REQ-F03` | Accept/decline follow requests | PASS | Only the target user can mutate the request. | Accept and decline passed; unauthorized mutation returned 404. | Runtime `03`. | Safe to mention |
| `REQ-F04` | Unfollow | PASS | Relationship removal works and custom post grants are revoked. | Unfollow transition passed. | Runtime `03`; project review `05`. | Safe to mention |
| `REQ-F05` | Prevent duplicate follows/requests | PASS | Database constraints/upsert logic prevent duplicate active relationships. | Duplicate/private request behavior exercised without duplicate state. | Project review `01`, `04`. | Safe to mention |
| `REQ-F06` | Prevent self-follow | PASS | Service and database check reject self-follow. | Runtime returned 400. | Runtime `03`; migration constraints. | Safe to mention |

## Posts and feeds

| ID | Requirement | Final status | Why | Runtime evidence | Source evidence | README impact |
|---|---|---|---|---|---|---|
| `REQ-PO01` | Create text/image posts | PASS | Multipart post creation with content and media is implemented. | Dynamic posts were created for the privacy matrix. | Runtime `04`, `09`; project review `01`. | Safe to mention |
| `REQ-PO02` | Feed | PASS WITH MINOR INTERNAL ISSUE | All/following/friends filters and cursor behavior exist; missing indexes are a scale issue rather than a core failure. | All three filters returned data. | Runtime `04`; `DB-004`. | Safe to mention |
| `REQ-PO03` | Image/GIF media | PASS | JPEG/PNG/GIF/WebP post attachments are validated by content. | Valid and spoofed/oversize uploads tested across upload flows. | Runtime `09`; project review `05`. | Safe to mention |
| `REQ-PO04` | Public visibility | PASS | Public posts were available to every authenticated persona tested. | Five-persona matrix passed. | Runtime `04`. | Safe to mention |
| `REQ-PO05` | Followers-only visibility | PASS | Only owner and approved followers could access direct post/comments. | Five-persona matrix passed. | Runtime `04`. | Safe to mention |
| `REQ-PO06` | Selected-follower/custom visibility authoring | FAIL | Backend enforcement is correct for a non-empty audience, but authoring accepts an empty audience and reports success. | Populated custom audience correctly admitted only the selected follower. Empty audience was not runtime-tested. | `FE-001` static trace and developer TODO; project review `02`. | Mention carefully |
| `REQ-PO07` | Direct API authorization against ID iteration | PASS | Hidden direct reads return 404 rather than exposing the post. | Direct restricted reads/comments returned 404. | Runtime `04`; project review `05`. | Safe to mention |

## Comments

| ID | Requirement | Final status | Why | Runtime evidence | Source evidence | README impact |
|---|---|---|---|---|---|---|
| `REQ-C01` | Create comments | PASS | Authorized users can add comments. | Comment creation returned 201. | Runtime `04`. | Safe to mention |
| `REQ-C02` | List comments | PASS WITH MINOR INTERNAL ISSUE | Listing works and is access-controlled; the query is currently unbounded. | Authorized list/count passed; unauthorized list returned 404. | Runtime `04`; `DB-008`. | Safe to mention |
| `REQ-C03` | Image/GIF comments | PASS | Optional validated media is supported. | Upload policy and comment multipart contract verified. | Runtime `04`, `09`. | Safe to mention |
| `REQ-C04` | Inherit parent-post access | PASS | Read and write paths re-derive the post rule, including group membership. | Unauthorized comment read/write failed. | Runtime `04`; project review `05`. | Safe to mention |

## Groups

| ID | Requirement | Final status | Why | Runtime evidence | Source evidence | README impact |
|---|---|---|---|---|---|---|
| `REQ-G01` | Create public/private groups | PASS | Both privacy modes, creator membership, images/templates, and UI exist. | Public and private groups were created. | Runtime `05`; project review `01`. | Safe to mention |
| `REQ-G02` | Browse/discover groups | PASS | Public groups appear; private groups do not. | Directory comparison passed. | Runtime `05`. | Safe to mention |
| `REQ-G03` | Group details | PASS | Authorized detail view exists and private outsider reads are hidden. | Public outsider read returned 200; private outsider read 404. | Runtime `05`. | Safe to mention |
| `REQ-G04` | Public-request/private-invite membership model | PASS | Public groups use approval requests; private groups reject join requests and use invites. | Both paths and outsider restrictions passed. | Runtime `05`; project review `05`. | Safe to mention |
| `REQ-G05` | Group invitations | PASS | Current requirement is satisfied through creator-managed invite, list, accept/decline, and duplicate handling. | Member invite 403; creator invite 201; invitee accept 200. | Runtime `05`; current source review. | Safe to mention |
| `REQ-G06` | Group join requests | PASS | Submission, duplicate prevention, creator review, and state transition work. | Full workflow passed. | Runtime `05`. | Safe to mention |
| `REQ-G07` | Member restrictions/removal/creator protection | PASS | Only creator removes members and creator cannot be removed; authorization changes immediately. | Removal and post-removal chat denial passed. | Runtime `07`; project review `01`. | Safe to mention |
| `REQ-G08` | Members-only group posts/comments | PASS | Read/create operations require membership independent of post visibility. | Member succeeded; outsider received 403. | Runtime `05`. | Safe to mention |
| `REQ-G09` | Members-only group chat | PASS | History, send, and recipient resolution all use current membership. | Member broadcast/history passed; outsider got no frame and was denied. | Runtime `07`; project review `05`, `06`. | Safe to mention |

## Events

| ID | Requirement | Final status | Why | Runtime evidence | Source evidence | README impact |
|---|---|---|---|---|---|---|
| `REQ-E01` | Create future group events as a member | PASS | Server enforces membership and future time. | Past date 400, outsider 403, member future event 201. | Runtime `05`. | Safe to mention |
| `REQ-E02` | List/view events | PASS WITH MINOR INTERNAL ISSUE | Member-scoped listing/detail works; group event list is unbounded. | Members viewed events; outsiders were denied. | Runtime `05`; `DB-008`. | Safe to mention |
| `REQ-E03` | RSVP going/not going | PASS | Both values are accepted for members and update counts. | `going` and `not_going` passed. | Runtime `05`. | Safe to mention |
| `REQ-E04` | Change RSVP | PASS | Upsert changes the existing response rather than duplicating it. | Going→not-going changed counts. | Runtime `05`. | Safe to mention |
| `REQ-E05` | Restrict non-members | PASS | Non-members cannot view/act on group events. | Event and RSVP outsider requests returned 403. | Runtime `05`. | Safe to mention |

## Private chat

| ID | Requirement | Final status | Why | Runtime evidence | Source evidence | README impact |
|---|---|---|---|---|---|---|
| `REQ-CH01` | WebSocket delivery | PASS | Persisted private messages are pushed to sender and recipient. | Dual delivery within milliseconds passed. | Runtime `06`. | Safe to mention |
| `REQ-CH02` | History/persistence | PASS | Messages persist when recipients are offline and are returned by REST history. | Offline message appeared in history after reconnect. | Runtime `06`. | Safe to mention |
| `REQ-CH03` | Follow-based permission rule | PASS | Either-direction follow relationship permits chat; unrelated users are rejected. | Mutual, one-way, and no-relationship personas passed. | Runtime `06`. | Safe to mention |
| `REQ-CH04` | Text/emoji | PASS | Unicode text is transported and persisted. | Emoji-bearing message delivered. | Runtime `06`. | Safe to mention |
| `REQ-CH05` | Reliable availability across reconnects | PARTIAL | Server persistence works, but the live UI does not automatically re-fetch messages missed during a disconnect. | Persistence/history retrieval passed; automatic UI catch-up not present. | `WS-001`; project review `06`. | Mention carefully |

## Group chat

| ID | Requirement | Final status | Why | Runtime evidence | Source evidence | README impact |
|---|---|---|---|---|---|---|
| `REQ-GC01` | Members-only send/receive | PASS | Fresh database membership gates every message and recipient set. | Outsider and removed-member tests passed. | Runtime `07`. | Safe to mention |
| `REQ-GC02` | WebSocket delivery | PASS | Active members receive broadcasts and sender confirmation. | Multi-member broadcast passed. | Runtime `07`. | Safe to mention |
| `REQ-GC03` | History/persistence | PASS | Group messages persist and history is member-gated. | Member history 200; outsider 403. | Runtime `07`. | Safe to mention |
| `REQ-GC04` | Behavior after member removal | PARTIAL | Security behavior is correct immediately, but the removed client receives no explicit UI state-change event. | Removed socket stopped receiving and was blocked from sending. | Runtime `07`; `WS-002`. | Mention carefully |

## Notifications

| ID | Requirement | Final status | Why | Runtime evidence | Source evidence | README impact |
|---|---|---|---|---|---|---|
| `REQ-N01` | Global in-app visibility | PASS WITH MINOR INTERNAL ISSUE | Provider/inbox/toasts expose notifications across the app; actor deletion can remove historical rows. | Notification inbox/count/toasts paths exercised. | Runtime `08`; `DB-002`. | Safe to mention |
| `REQ-N02` | Follow-request notification | PASS | Trigger is wired and current source contradicts stale docs. | Not isolated in the runtime trigger table, but notification framework and follow flow passed. | Project review `01`, `10`; handoff evidence index. | Safe to mention |
| `REQ-N03` | Group invitation notification | PASS | Invite creation persists and pushes a notification. | Runtime received `group_invitation` event. | Runtime `08`. | Safe to mention |
| `REQ-N04` | Group join-request notification | PASS | Trigger is wired to the creator review flow. | Join-request workflow passed; trigger not separately itemized in runtime notification table. | Project review `01`; source trace. | Safe to mention |
| `REQ-N05` | New group event notification | PASS | Trigger is implemented; stale docs saying otherwise are false. | Event workflow passed; trigger not separately itemized in runtime notification table. | Project review `01`, `10`; handoff evidence index. | Safe to mention |
| `REQ-N06` | Unread/read state and count | PASS | Individual/all-read operations and monotonic merge are correct. | Count changes, ownership, mark-all, and stale REST merge passed. | Runtime `08`; project review `06`. | Safe to mention |
| `REQ-N07` | Realtime push | PASS | Durable notifications are pushed to active sockets and retrieved later if offline. | Like/comment/invite push and offline retrieval passed. | Runtime `08`. | Safe to mention |

## Uploads

| ID | Requirement | Final status | Why | Runtime evidence | Source evidence | README impact |
|---|---|---|---|---|---|---|
| `REQ-U01` | JPEG/PNG/GIF support | PASS | Required formats are content-sniffed and accepted in their supported form targets. | Valid images accepted; spoofed/PDF/oversize files rejected. | Runtime `09`; project review `05`. | Safe to mention |
| `REQ-U02` | Filesystem/path storage behavior | PARTIAL | UUID storage, limits, and safe paths work, but raw files are unauthenticated and directories are browsable. | Direct file and directory index access confirmed. | `SEC-001` / `RT-UPLOAD-001`; runtime `09`. | Mention carefully |

## Database and migrations

| ID | Requirement | Final status | Why | Runtime evidence | Source evidence | README impact |
|---|---|---|---|---|---|---|
| `REQ-D01` | Matching up/down migration files | PARTIAL | Thirty pairs exist, but one down migration fails for valid data created under its up migration. | Up chain passed; failing down case reproduced separately. | `DB-001`; project review `04`. | Mention carefully |
| `REQ-D02` | Migration runner | PASS | Embedded transactional runner, startup migration, and CLI operations exist. | Startup applied all migrations; version command passed. | Runtime executive summary; handoff verification log. | Safe to mention |
| `REQ-D03` | Application/schema consistency | PASS WITH MINOR INTERNAL ISSUE | Application repositories match the live schema; only hand-maintained `schema.dbml` is stale. | All runtime domains operated against the migrated database. | Project review `04`; `DB-007`. | Safe to mention |
| `REQ-D04` | Safe migration additions | PASS | No populated-table `NOT NULL` column was added without a default. | Not a distinct runtime case; migration chain applied. | Static migration review of all 30 pairs. | Safe to mention |

## Supplemental runtime quality expectations

These were not all explicit original feature requirements, but the runtime audit tested them as necessary operational expectations.

| ID | Requirement | Final status | Why | Runtime evidence | Source evidence | README impact |
|---|---|---|---|---|---|---|
| `REQ-R01` | Logout invalidates all authenticated transports | FAIL | Open WebSockets remain usable after REST session revocation. | Direct message after logout was delivered. | `RT-WS-001`. | Do not mention as completed |
| `REQ-R02` | Independent concurrent sessions on multiple browsers/devices | FAIL | Second normal login replaces the first token. | First browser received 401 after second login. | `RT-SESSION-001`; static `DB-005` adds a race caveat. | Do not mention as completed |
| `REQ-R03` | Configurable non-localhost frontend/backend origins | FAIL | Frontend ignores origin config and backend CORS permits only localhost. | Alternate-origin preflight failed. | `DOC-001`, `RT-CONTRACT-001`, `RT-CONTRACT-002`. | Do not mention as completed |
| `REQ-R04` | No authenticated socket retries on public auth pages | FAIL | Provider retries every 1.5 seconds while unauthenticated. | Browser console/network behavior reproduced. | `RT-WS-002`. | Do not mention as completed |
| `REQ-R05` | Restricted media inherits domain authorization | FAIL | Direct upload paths remain public after domain access is lost. | Unauthenticated static file access confirmed. | `SEC-001`; runtime `09`. | Do not mention as completed |
| `REQ-R06` | Upload directories are non-browsable | FAIL | Static file server returns HTML indexes for upload roots/subdirectories. | Runtime `GET /uploads/` returned a directory listing. | `RT-UPLOAD-001`. | Do not mention as completed |
| `REQ-R07` | Automatic chat catch-up after reconnect | PARTIAL | Durable history is available, but current UI does not trigger the catch-up automatically. | Offline persistence passed; code lacks reconnect resync. | `WS-001`; runtime `06`. | Mention carefully |

## Extra features beyond the minimum requirements

| ID | Requirement/feature | Final status | Why | Runtime evidence | Source evidence | README impact |
|---|---|---|---|---|---|---|
| `EXTRA-01` | Likes | EXTRA FEATURE | Idempotent like/unlike, counts, and author notification are integrated. | Like/unlike passed. | Runtime `04`; handoff evidence index. | Safe to mention |
| `EXTRA-02` | Post sharing through chat | EXTRA FEATURE | Posts can be sent into eligible private/group conversations with preview cards. | Not isolated in runtime report; backend tests/build and current source confirm it. | Project review `01`; handoff project history. | Safe to mention |
| `EXTRA-03` | Universal search and recommendations | EXTRA FEATURE | Search, “Who to Follow,” and suggested groups are current frontend/backend features. | Search-specific browser flow not separately reported. | Handoff evidence index; source review. | Safe to mention |
| `EXTRA-04` | Weighted two-tier rate limiting | EXTRA FEATURE | Global/per-endpoint token buckets and WebSocket message costs protect traffic. | Rate-limit headers/costs observed; test/race suites passed. | Runtime `11`; project review `08`. | Safe to mention |
| `EXTRA-05` | Eight-planet 3D theme system | EXTRA FEATURE | Active selectable 3D experience with browser-local preferences and theme variables. | 3D auth screen rendered; registry/assets/build verified. | Project review `07`; handoff history. | Safe to mention |
| `EXTRA-06` | Profile/settings self-service | EXTRA FEATURE | Users can edit biography/avatar/privacy/password and appearance. | Supporting APIs passed; settings screen not fully click-tested. | Handoff evidence index; frontend review. | Safe to mention |
| `EXTRA-07` | Typing indicators and read receipts | EXTRA FEATURE | Private chat transports both in realtime. | Both passed over live sockets. | Runtime `06`. | Safe to mention |

## Historical or superseded requirements/designs

| ID | Requirement/design | Final status | Why | Runtime evidence | Source evidence | README impact |
|---|---|---|---|---|---|---|
| `HIST-01` | Separate `group_posts`, `group_comments`, and media tables | HISTORICAL / NO LONGER APPLICABLE | Current architecture reuses `posts`/`comments` through `posts.group_id`. | Group post/comment flows passed on current schema. | Handoff project history; `DB-007`. | Historical only |
| `HIST-02` | Route-intercepting solar-system/GSAP navigation | HISTORICAL / NO LONGER APPLICABLE | Removed and replaced by nonblocking ambient 3D. | Current routes and 3D auth/app presentation work independently. | Handoff project history; project review `07`. | Historical only |
| `HIST-03` | Black-hole model as an active selectable theme | HISTORICAL / NO LONGER APPLICABLE | It is not in the shipped registry or current public assets. | Registry/disk consistency confirmed without it. | Project review `07`; `DOC-005`. | Historical only |
| `HIST-04` | Group chat/3D are disabled or dormant | HISTORICAL / NO LONGER APPLICABLE | Those statements describe an older milestone and are false for current code. | Current group chat and 3D behavior verified. | `DOC-002`, `DOC-003`; runtime `07`. | Historical only |

## Final requirement conclusion

The core product requirements are broadly satisfied. The public README may present authentication, profiles/followers, posts/comments, groups/events, chat, notifications, uploads, SQLite migrations, Docker-based local setup, and the 3D experience. Careful wording is required around session concurrency/logout, custom-audience validation, reconnect recovery, static media privacy, deployment origins, and down-migration reversibility. None of the supplemental runtime failures should be advertised as completed capabilities.
