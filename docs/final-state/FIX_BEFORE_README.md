# Fix Before README

## Conclusion

**No blocking issues found for an accurate public README.**

The application has enough verified, working capability to publish a strong README now. The issues below limit specific claims; they do not require turning the README into a bug report. Either fix them before making the restricted claim or use the wording boundary in the final column.

| Issue | Why it blocks/limits README claim | Recommended action |
|---|---|---|
| `RT-WS-001` — an open WebSocket survives REST logout | Blocks claims that logout immediately revokes all authenticated access or that realtime authorization continuously follows session state. | Disconnect a user's sockets on logout and/or revalidate sessions for mutation frames. Until then, describe cookie authentication and realtime features separately without the stronger revocation claim. |
| `DB-005` / `AUTH-005` / `RT-SESSION-001` — session storage does not support reliable multi-device use | Blocks claims of concurrent sessions across devices/browsers. A normal second login invalidates the first; a true race may create duplicate rows. | Choose and enforce explicit multi-session or single-session semantics. Until then, say only “cookie-based sessions with a 24-hour sliding expiry.” |
| `DOC-001` / `RT-CONTRACT-001` / `RT-CONTRACT-002` — hardcoded frontend/backend origins | Blocks deployment, production-readiness, arbitrary-domain, and configurable-origin claims. It does **not** block the default localhost development setup. | Make frontend API/WS origins and backend CORS allow-list configurable. Until then, document only `localhost:3000` → `localhost:8080`. |
| `WS-001` — chat does not automatically resync missed incoming messages after reconnect | Blocks “seamless reconnect,” “guaranteed live catch-up,” or equivalent reliability claims. Core delivery and persistence still work. | Refresh and deduplicate active chat history when the socket reconnects. Until then, describe persisted history and realtime delivery without reconnect guarantees. |
| `FE-001` — empty custom audiences are accepted | Limits claims that the selected-follower authoring flow rejects every invalid state. Enforcement for a real selected audience is correct. | Require at least one selected follower in both forms and backend validation. Until then, say posts support “selected-follower visibility,” not that invalid audience configuration is fully prevented. |
| `SEC-001` / `RT-UPLOAD-001` — raw uploads are public and directory-browsable | Blocks claims of private media storage, expiring/revocable media access, or authorization-gated files. Upload validation itself is working. | Disable directory indexes and route restricted media through authorization. Until then, say “validated image uploads with local filesystem storage.” |
| `DB-001` — one down migration fails for valid data | Blocks claims that every migration is safely reversible or that `down-all` is reliable for all valid databases. Startup/up migration remains working. | Make the pair reversible or explicitly designate it one-way. Until then, say “embedded transactional migrations with automatic startup application and CLI support.” |
| `TEST-001` — no frontend automated tests and the smoke script is missing | Blocks claims of comprehensive full-stack E2E/frontend test coverage and makes `npm run test:smoke` unsafe to document. | Add the missing test harness/script or remove the dead package script. Until then, list backend tests plus frontend lint, typecheck, and production build only. |

## Issues that do not need to delay the README

Do not hold the README for minor UI clipping, indexing/performance work, stale timers/caches, response-shape cleanup, modal refactoring, 3D bundle/cache optimization, old internal-document cleanup, or other items in `FINAL_ISSUE_REGISTER.md`. Those remain internal engineering work and do not make the approved public feature descriptions false.
