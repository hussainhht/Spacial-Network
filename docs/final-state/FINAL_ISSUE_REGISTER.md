# Final Issue Register

## Scope and deduplication

This register merges:

- `docs/project-review/11_ISSUE_REGISTER.md`;
- `docs/runtime-review/13_RUNTIME_ISSUE_REGISTER.md`; and
- relevant caveats from `docs/ai-handoff/`.

Runtime evidence has priority where conclusions differ. Duplicate findings share one canonical row and preserve every original ID. The merged register contains **70 canonical tracked findings**: 60 defects/risks and 10 informational observations. There are no Critical issues.

| Severity | Canonical count | Reconciliation note |
|---|---:|---|
| Critical | 0 | None found. |
| High | 6 | Static `DB-005` was promoted and merged with runtime `RT-SESSION-001`. |
| Medium | 23 | Includes the runtime-only unauthenticated WebSocket retry loop. |
| Low | 31 | Includes runtime-only unauthenticated `GET /api/login` behavior. |
| Info | 10 | Five static documentation/type observations plus five runtime API/policy observations. |
| **Total** | **70** | Duplicate source IDs are not double-counted. |

All statuses below are **Confirmed** unless explicitly described as an observation. “README effect” is an internal routing aid, not recommended public copy.

## Canonical duplicate mapping

| Canonical finding | Original IDs retained | Resolution |
|---|---|---|
| Session concurrency/model | `DB-005`, `AUTH-005`, `RT-SESSION-001` | Runtime proves the normal path overwrites the prior token; static analysis also proves a true simultaneous first-login race can create duplicate rows. One root cause: non-atomic, under-constrained session storage. Severity is High because ordinary multi-device use fails. |
| Backend origin/CORS configuration | `DOC-001`, `RT-CONTRACT-001`, `RT-CONTRACT-002` | One cross-stack configuration defect: frontend API/WS origins ignore env vars and backend CORS is hardcoded. Runtime confirmed the non-localhost failure. |
| Upload exposure | `SEC-001`, `RT-UPLOAD-001` | One storage-serving boundary problem with two effects: files bypass content authorization and directory indexes enumerate uploaded UUID paths. |
| Group invitations | Static requirement wording plus `RT-GROUP-002` | Current behavior is creator-only. This is an informational contract observation, not a functional defect. |

## High-severity findings

| Canonical ID / original IDs | Finding and final conclusion | Evidence retained | Recommended action | README effect |
|---|---|---|---|---|
| `DB-001` | The `pending_group_attempts` down migration recreates a full unique index and fails after a valid declined→new-attempt history. Up migrations and the running schema are unaffected. | Reproduced against scratch SQLite in `project-review/04_DATABASE_MIGRATIONS_REVIEW.md`; full record in static issue register. | Either declare the migration one-way or collapse/disambiguate history before recreating the old unique index. | Do not claim every migration is fully reversible. |
| `WS-001` | Private and group chat persist messages during disconnects but the already-open frontend does not re-fetch missed incoming history after WebSocket reconnection. | Static hook trace in `project-review/06_REALTIME_CHAT_NOTIFICATIONS_REVIEW.md`; runtime `06_PRIVATE_CHAT_E2E.md` confirms persistence/history retrieval but did not exercise automatic UI catch-up. | On `isConnected` false→true, refresh conversations and active history with ID-based merge/deduplication. | Avoid seamless/reliable reconnect-catch-up claims. Core chat remains present. |
| `FE-001` | A `custom` post can be submitted with zero selected followers, producing an author-only post while reporting success. Non-empty selected audiences are enforced correctly. | Static form/service validation trace in `project-review/02_FRONTEND_REVIEW.md`; runtime `04_POSTS_COMMENTS_PRIVACY_E2E.md` confirms correct enforcement for a populated custom audience. | Add client guards to both post forms and server-side validation requiring at least one viewer for `custom`. | Custom visibility may be described as selected-follower visibility, but not as fully guarded against invalid audience selection. |
| `DOC-001` / `RT-CONTRACT-001` / `RT-CONTRACT-002` | The frontend hardcodes `localhost:8080`, ignores origin build/env inputs, and the backend CORS response hardcodes `http://localhost:3000`. Default local topology works; non-localhost browser access fails. | Static cross-file trace in `project-review/10_DOCUMENTATION_CONFIG_REVIEW.md`; runtime CORS and client verification in `runtime-review/11_FRONTEND_BACKEND_INTEGRATION.md`; handoff caveat in `ai-handoff/README_HANDOFF.md`. | Read configured origins with localhost fallbacks and use a configured backend allow-list shared with WebSocket origin checks. | Present Docker only as the default localhost development topology; do not claim deployment flexibility. |
| `DB-005` / `AUTH-005` / `RT-SESSION-001` | A normal second login updates the stored token and invalidates the first browser. The select-then-update/insert sequence also lacks a transaction and `UNIQUE(user_id)`, so a simultaneous empty-state race can create duplicate rows. | Runtime reproduced token overwrite in `runtime-review/02_AUTH_SESSION_E2E.md` and `12_MULTIUSER_MULTITAB_EDGE_CASES.md`; static race/schema evidence in `project-review/04_DATABASE_MIGRATIONS_REVIEW.md`. | Choose explicit semantics: preferably insert independent sessions for multi-device support, or enforce a transactional single-session invariant with clear UX. | Do not claim independent multi-device/browser sessions. |
| `RT-WS-001` | REST logout revokes the database session and cookie, but an already-open WebSocket stays authorized and can continue sending/receiving. | Direct runtime reproduction in `runtime-review/10_WEBSOCKET_RESILIENCE.md` and central runtime issue register. Static audit only established authentication at the upgrade handshake. | Disconnect all user sockets on logout and/or revalidate session state for mutation frames. Add a logout→close regression test. | Do not claim logout immediately revokes every realtime channel or that socket authorization tracks session state continuously. |

## Medium-severity findings

| Canonical ID / original IDs | Finding | Primary evidence | Recommended action | README effect |
|---|---|---|---|---|
| `SEC-001` / `RT-UPLOAD-001` | `/uploads/*` has no authorization layer and `http.FileServer` exposes directory indexes, making all uploaded paths enumerable and retained URLs usable after access revocation. | Static `project-review/05_AUTH_SECURITY_PRIVACY_REVIEW.md`; runtime `runtime-review/09_UPLOADS_MEDIA_E2E.md`. | Disable directory indexes and either proxy restricted media through domain authorization or formally scope all uploads as public. | Do not call media private/access-controlled. |
| `SEC-004` | Selected group mutation/action endpoints reveal a hidden private group's existence through 403-vs-404 differences. No content is exposed. | `project-review/05_AUTH_SECURITY_PRIVACY_REVIEW.md`. | Apply the read path's visibility-first check before mutation authorization. | Internal only; normal private-group description remains reasonable. |
| `BE-001` | Posts, likes, share, and comments handlers omit JSON `Content-Type`, so Go may serve JSON as `text/plain`. | Reproduced in `project-review/03_BACKEND_REVIEW.md`. | Set `Content-Type: application/json` consistently or centralize response writing. | Internal only. |
| `BE-002` | Six genuine upload failure paths return raw filesystem/OS errors to clients. | `project-review/03_BACKEND_REVIEW.md`. | Log internal detail and return a fixed 500 response. | Internal only; avoid broad production-security claims. |
| `BE-003` | Expired-session cleanup runs once at startup and has no periodic sweep. | `project-review/03_BACKEND_REVIEW.md`. | Add a controlled periodic cleanup loop and shutdown path. | Internal only. |
| `DB-002` | `notifications.actor_id ON DELETE CASCADE` deletes another user's notification history when the actor account is removed. | `project-review/04_DATABASE_MIGRATIONS_REVIEW.md`. | Rebuild the table with `ON DELETE SET NULL`. | Internal only. |
| `DB-003` | Many user foreign-key columns lack supporting indexes, forcing full scans during cascading user deletion on the single SQLite connection. | `EXPLAIN QUERY PLAN` evidence in `project-review/04_DATABASE_MIGRATIONS_REVIEW.md`. | Add FK-leading indexes. | Internal scalability issue only. |
| `DB-004` | Main feed query scans `posts` and uses a temporary sort because no suitable `created_at` index exists. | `EXPLAIN QUERY PLAN` evidence in `project-review/04_DATABASE_MIGRATIONS_REVIEW.md`. | Add `(created_at DESC, id DESC)` index and re-check the plan. | Internal scalability issue only. |
| `DB-006` | Text timestamps use mixed formats/offsets; group-post ordering uses raw string ordering rather than normalized SQLite datetime ordering. | Live DB evidence in `project-review/04_DATABASE_MIGRATIONS_REVIEW.md`. | Write UTC consistently and normalize ordering/comparisons. | Internal only. |
| `DB-008` | Followers/following, group members, comments, and group events include unbounded list queries. | `project-review/04_DATABASE_MIGRATIONS_REVIEW.md`. | Add cursor/limit pagination and update callers. | Internal scalability issue only. |
| `WS-002` | Member removal is enforced immediately by the backend, but the removed client's UI gets no explicit removal event and stays stale. | Static `project-review/06_REALTIME_CHAT_NOTIFICATIONS_REVIEW.md`; runtime `07_GROUP_CHAT_E2E.md` confirms zero authorization lag. | Publish `group_member_removed` and invalidate membership/chat state client-side. | Core membership enforcement is safe to present; omit realtime UX guarantees. |
| `WS-003` | Private-chat offset pagination can render a duplicate when a live message shifts the next page; merge lacks ID deduplication. | `project-review/06_REALTIME_CHAT_NOTIFICATIONS_REVIEW.md`. | Port group chat's ID-keyed dedupe or move to cursor pagination. | Internal only. |
| `FE-003` | Remove-member and delete-group dialogs lack the focus containment/restoration used by the shared accessible confirmation dialog. | `project-review/02_FRONTEND_REVIEW.md`. | Reuse `ConfirmDialog`. | Internal accessibility issue; avoid WCAG/conformance claims. |
| `3D-001` | Three/R3F/Drei are statically imported into authenticated layouts rather than code-split behind a client-only dynamic boundary. | `project-review/07_3D_SPACE_PERFORMANCE_REVIEW.md`. | Dynamically import the canvas components with SSR disabled. | Internal performance issue; current 3D feature remains public-safe. |
| `3D-002` | Switching through planets retains all loaded GLTF assets in the shared cache for the session (bounded to the shipped assets). | `project-review/07_3D_SPACE_PERFORMANCE_REVIEW.md`. | Evict the previous asset after a safe swap. | Internal performance issue. |
| `DOC-002` | `frontend/README.md` falsely calls group chat a disabled placeholder and current 3D dormant; it also advertises a missing smoke test. | `project-review/10_DOCUMENTATION_CONFIG_REVIEW.md`. | Rewrite or replace with current architecture facts. | Never reuse these stale claims. |
| `DOC-003` | Detailed backend docs and `docs/TEST_AUDIT_REPORT.md` contain obsolete claims that chat, followers, comments, events, notifications, and Docker are missing/broken. | `project-review/10_DOCUMENTATION_CONFIG_REVIEW.md`; contradicted throughout runtime reports. | Archive with a historical banner or regenerate. | Treat as history only, not README evidence. |
| `DOC-006` | Root `README.md` describes an old planned structure, wrong server entrypoint, wrong migration naming, and nonexistent frontend organization. | `project-review/10_DOCUMENTATION_CONFIG_REVIEW.md`. | Rewrite from `README_SOURCE_OF_TRUTH.md`. | The current README must not be used as evidence. |
| `DX-001` / static cross-ref `DB-012` | Pagination clamping is duplicated and requests above the maximum collapse to a small default rather than the maximum. | `project-review/09_CODE_QUALITY_TECH_DEBT.md`, `04_DATABASE_MIGRATIONS_REVIEW.md`. | Extract one shared clamp helper with explicit max behavior. | Internal only. |
| `DX-002` | Search repository methods duplicate looser hardcoded limits than the service layer. | `project-review/09_CODE_QUALITY_TECH_DEBT.md`. | Centralize one limit definition. | Internal only. |
| `DX-003` | Shared REST and WebSocket JSON boundaries trust TypeScript assertions without runtime schema validation. | `project-review/09_CODE_QUALITY_TECH_DEBT.md`. | Add targeted runtime validation at network boundaries. | Internal only; avoid claiming runtime type safety across the wire. |
| `TEST-001` | The frontend has no automated tests; `npm run test:smoke` targets a missing shell script. | Reproduced in `project-review/08_TESTING_RUNTIME_REVIEW.md`; handoff `VERIFICATION_LOG.md`. | Add a frontend test harness and regressions for custom audiences/reconnect behavior; remove or implement the dead script. | List lint/typecheck/build only; do not claim frontend or full-stack E2E automation. |
| `RT-WS-002` | The root WebSocket provider retries every 1.5 seconds on `/login` and `/register`, producing repeated 401 connections. | Runtime `10_WEBSOCKET_RESILIENCE.md`. | Mount/activate the provider only for authenticated state. | Internal only. |

## Low-severity findings

| ID | Summary | Evidence source | README routing |
|---|---|---|---|
| `AUTH-001` | Username uniqueness is case-sensitive while email normalization is not. | Project review `05` | Internal only. |
| `AUTH-002` | Registration conflicts reveal whether username or email already exists. | Project review `05` | Internal only; avoid overclaiming anti-enumeration. |
| `AUTH-003` | Cookie `Secure` is hardcoded false with no production override. | Project review `05` | Keep setup/local HTTP scoped. |
| `AUTH-004` | GET logout performs a state change and permits logout-CSRF through top-level navigation. | Project review `05` | Internal only. |
| `SEC-002` | WebSocket upgrader accepts any `Origin`, inconsistent with REST CORS. | Project review `05` | Avoid production-security claims. |
| `SEC-003` | Post/comment mutation endpoints expose existence through 403-vs-404 differences. | Project review `05` | Internal only. |
| `BE-004` | The groups package contains oversized, multi-domain files. | Project review `03`, `09` | Internal maintainability. |
| `BE-005` | Method checks are duplicated; many are dead behind method-aware `ServeMux` routes. | Project review `03` | Internal maintainability. |
| `BE-006` | Shared JSON response helper has no adopters. | Project review `03`, `09` | Internal maintainability. |
| `BE-007` | Three incompatible API error response shapes coexist. | Project review `03` | Internal contract cleanup. |
| `BE-008` | JSON encoder errors are discarded across handlers. | Project review `03` | Internal error handling. |
| `BE-009` | No panic recovery protects server/WebSocket goroutines from an unexpected panic. | Project review `09` | Avoid uptime/production-hardening claims. |
| `DB-009` | Legacy `posts.image_path` remains beside `post_media`; downgrade loses extra images. | Project review `04` | Internal migration/design note. |
| `DB-010` | `posts.group_id` index does not cover group post ordering. | Project review `04` | Internal performance. |
| `DB-011` | Follow-request uniqueness overwrites decline history rather than preserving attempts. | Project review `04` | Internal product/history design. |
| `DB-013` | Followers queries use `SELECT *` from explicitly shaped CTEs. | Project review `04` | Internal style. |
| `DB-014` | Narrow like/create read-back race can return not-found after a concurrent unlike. | Project review `04` | Internal edge case. |
| `WS-004` | Live chat timestamps use seconds while REST history can include finer precision. | Project review `06` | Internal contract consistency. |
| `WS-005` | Loading older private history redundantly broadcasts a read-receipt event. | Project review `06` | Internal traffic cleanup. |
| `WS-006` | Chat typing timer is not cleared on component unmount. | Project review `06` | Internal only. |
| `FE-004` | Several modal implementations duplicate the stronger shared dialog. | Project review `02` | Internal maintainability/accessibility. |
| `FE-005` | Module-level group cache is not explicitly cleared on auth lifecycle changes. | Project review `02` | Internal only. |
| `FE-006` | Group member name ellipsis lacks `white-space: nowrap`. | Project review `02` | Internal visual polish. |
| `FE-007` | Login/register cross-links use plain anchors instead of Next links. | Project review `02` | Internal UX/performance. |
| `3D-003` | Moon GLB is approximately 11 MB, above the audit's 10 MB flag threshold. | Project review `07` | Internal documented tradeoff. |
| `3D-004` | Main app renders 3D on mobile while auth stages use a CSS fallback. | Project review `07` | Internal product/performance decision. |
| `3D-005` | Planet preferences use two localStorage naming conventions. | Project review `07` | Internal only. |
| `DX-004` | Avatar/photo size constant is redeclared instead of using the shared helper. | Project review `09` | Internal maintainability. |
| `DX-005` | Session cookie construction is duplicated beside an unused helper. | Project review `09` | Internal maintainability. |
| `TEST-002` | Search tests cover only one of four result domains. | Project review `09` | Internal test depth. |
| `RT-AUTH-001` | Unauthenticated `GET /api/login` returns 405 rather than an unauthenticated-state response. | Runtime `02`, runtime issue register | Internal contract detail. |

## Informational findings and contract observations

| ID | Observation | Evidence source | README routing |
|---|---|---|---|
| `BE-010` | Hub and limiter have no explicit shutdown method. | Project review `03` | Internal operations note. |
| `DB-007` | `docs/database/schema.dbml` has 14 confirmed drifts from migrations/current schema. | Project review `04` | Do not use DBML for README facts. |
| `WS-007` | Frontend notification `read_at` type allows `null`; backend omits the field when unset. | Project review `06` | Internal type-doc note. |
| `DOC-004` | No `.env.example` exists despite `.gitignore` making an exception for one. | Project review `10` | Do not promise an env template. |
| `DOC-005` | Model docs contain a phantom asset, removed dev route, and stale sizes. | Project review `07`, `10` | Use verified eight-planets-plus-Moon facts only. |
| `RT-POST-001` | Feed returns a bare JSON array rather than a wrapper object. | Runtime issue register | API documentation detail only. |
| `RT-GROUP-001` | Invitation creation expects JSON key `invited_user_id`. | Runtime issue register | API documentation detail only. |
| `RT-GROUP-002` | Invitations are restricted to the group creator. | Runtime issue register | Public wording must say creator-managed invitations. |
| `RT-CHAT-001` | Private history query expects `user_id`. | Runtime issue register | API documentation detail only. |
| `RT-UPLOAD-002` | WebP is accepted for post/comment/event media but not avatars/group photos. | Runtime issue register | Avoid “WebP everywhere”; format table may be documented. |

## Runtime observations not promoted to canonical issues

The per-domain runtime reports also assigned informational labels that the central runtime issue register deliberately excluded. They are retained here without increasing issue counts:

- `RT-FOLLOW-001`: a non-owner receives 404 when trying to mutate another user's follow request. This is the desired anti-enumeration behavior.
- `RT-NOTIF-001`: a user receives 404 when trying to mark another user's notification read. This is the desired ownership scoping.
- `RT-GCHAT-001`: group broadcast resolves members with a database lookup per frame. This is the mechanism that produced zero authorization lag in testing; it is only a future scale consideration.

## Positive controls that must not regress

- Direct reads of hidden posts/private groups collapse absence and lack of access appropriately.
- Comments inherit the parent post's access rule.
- Group chat membership is freshly checked at history, send, and delivery time.
- Notification state uses an ID-keyed union and monotonic read merge.
- WebSocket writes use a single writer per connection and the full Go race suite passed.
- Uploads use magic-byte allow-listing, UUID filenames, and size limits.
- Multi-statement domain writes that need atomicity are transaction-wrapped.
- The application repositories match the actual migrated schema.
- 3D asset registry and shipped planet files are consistent; render/listener cleanup is sound.

## README isolation rule

Most findings above are internal only. The README source should surface only the claim boundaries already encoded in `README_SOURCE_OF_TRUTH.md`: local-only deployment wording, no private-media promise, no multi-device-session promise, no seamless reconnect promise, no universal migration-reversibility promise, and no frontend automated-test claim.
