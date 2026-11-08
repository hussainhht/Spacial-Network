# Production preparation report

## Scope and architecture

Inspected the backend router, authentication/session middleware, WebSocket hub,
chat/follower/group authorization services, upload storage, SQLite startup and
migrations, frontend API/media/WS helpers, demo separation, Dockerfiles, Compose,
Next configuration and existing tests. Verified Go + mattn SQLite + Gorilla
WebSocket and Next.js + React + TypeScript. This is focused deployment hardening,
not a full penetration test or proof of production reliability under load.

The new production path is Cloudflare → VM cloudflared → loopback-only Nginx →
isolated frontend/backend networks. Only Nginx publishes 127.0.0.1:8088. No data,
secrets, server configuration, Cloudflare accounts or GitHub remotes were modified
outside the repository; nothing was deployed or pushed.

## Findings and fixes

| Finding | Change |
| --- | --- |
| Browser API helper always used localhost and ignored documented environment configuration | Same-origin production API/uploads; WS derives WSS from page HTTPS. Explicit public overrides work at build time. Development preserves direct port 8080. |
| Every WS origin accepted | Per-handler exact configured origin policy, with missing Origin rejected in production; existing session middleware still gates upgrade. |
| Fixed localhost credentialed CORS | Exact allowlist, Vary: Origin, no wildcard/reflection of untrusted origins. |
| Cookie-authenticated writes lacked explicit CSRF checks | Trusted Origin required for production writes including login, plus cross-site fetch rejection. CLI writes require Origin as well as authentication. |
| GET logout changed session state | Logout requires POST; current frontend already uses POST. |
| Production cookies were never Secure | Production forces Secure, retains HttpOnly, Path=/, SameSite=Lax and host-only scope. |
| Unsafe production configuration could start | Configuration validation requires public HTTPS origins and a plain DB filename. |
| Proxy IP confused public-route rate limiting | Opt-in proxy trust accepts Nginx-overwritten X-Real-IP only; isolated backend and loopback ingress define trust boundary. |
| Login and outer API bodies lacked an overall cap | Login capped at 8 KiB; outer API/Nginx at 25 MiB, preserving four 5-MiB post attachments. |
| Upload storage failures exposed filesystem errors | Generic upload failure messages for authentication, profile, group, post and comment upload paths. |
| Upload directories could be listed | Reject directory requests while preserving file URLs. |
| Broad SQLite file permissions | Private database directory creation, database mode 0600, production process umask 077 and non-root UID 10001. SQLite busy timeout added; single connection retained. |
| Root-running containers and broad public service ports | Non-root runtimes; dropped capabilities; no-new-privileges; production read-only roots with bounded tmpfs and persistent data mounts. |
| No production routing/upgrade/persistence setup | Nginx verified route paths, HTTP/1.1 upgrades, forwarded HTTPS headers, timeouts, body caps, security headers, health checks and named volumes. |
| Proxy logs could include URL secrets | Access format omits query strings, cookies, Authorization and bodies; Docker logs rotate. |
| Docker contexts could include credentials/backups | Reused existing ignores and added key/certificate/backup/database patterns. |

Existing upload magic-byte allowlists, random UUID filenames, exclusive creation,
per-file limits, and deletion traversal rejection were retained. Backend service
checks for ownership, post visibility, group membership and follow eligibility
were retained and exercised by existing suites. No production seeder is shipped;
the destructive development seeder and its shared passwords must never be used
against production data.

## Remaining security and operational limits

- Uploaded media is served publicly by URL as in the original application.
  Private post/group visibility does **not** protect the corresponding media
  bytes from someone who knows the URL. Directory listings are blocked, but
  random filenames are not authorization. Treat authenticated media authorization
  as a launch requirement if private-media confidentiality is promised.
- WebSocket session authentication happens at handshake. Revoking/expiring a
  session does not terminate established sockets. Immediate live-socket
  revocation remains hardening work; close/reload logged-out clients.
- No global CSP was added without evaluating the application's inline and 3D
  rendering requirements. No malware scanner, disk quota or distributed DoS
  system was introduced. Monitor disk space and rate limits.
- Docker administrators and VM-local processes are trusted. Never expose Nginx's
  loopback ingress directly or connect arbitrary workloads to its backend network.
- Nginx upstream names resolve at startup. Restart proxy after replacing upstream
  containers; the documented update procedure includes this step.
- Image release tags float. Record tested image IDs/digests for controlled
  deployments and rebuild regularly for security updates.
- Cloudflare cache overrides can defeat privacy expectations: do not cache API
  responses or authenticated HTML. The API sets Cache-Control: no-store.

## Verification performed locally

| Check | Result |
| --- | --- |
| Backend `go test ./...` | Passed, including existing auth, authorization, chat, groups, notifications, upload and migration tests. |
| New production router integration | Passed using a local TLS server: login cookie flags; authenticated WSS upgrade and initial real-time event; unauthenticated 401; untrusted-origin 403; authenticated user API; health; blocked upload directory listing. |
| New persistence regression | Passed: write database, close, reopen, retain data, verify mode 0600. |
| New origin/proxy tests | Passed: missing/null/foreign Origin rejection, trusted Origin acceptance, opt-in proxy identity. |
| Backend compilation and `go vet ./...` | Passed (native macOS ARM64 build). Linux image build not run. |
| Frontend ESLint | Passed. |
| Frontend `npm test` | 41 tests passed, including new same-origin/WSS and existing demo, calendar, drafts and notification tests. |
| Next production build | Passed with the exact production settings: empty public origins, unoptimized images, SITE_URL=https://social.example.com. Includes TypeScript checking and standalone output. |
| Production bundle scan | No localhost:8080 or ws://localhost backend URLs in browser JS. |
| Local standalone HTTP smoke | Login, registration and home HTML returned 200. This is an HTML smoke check, not a browser end-to-end test. |
| Compose production validation | `docker compose --env-file .env.production.example -f compose.prod.yaml config --quiet` passed. Reviewed only proxy port publishing, network isolation and persistent volume mounts. |
| Deployment shell blocks | All 13 shell blocks passed `bash -n`; VM/cloud commands were not executed. |
| Whitespace validation | `git diff --check` passed. |

Dependency installation initially hit sandbox DNS restrictions and was retried
successfully with network access. The new loopback integration test and local
frontend also required running outside the network sandbox; both then passed.
Go's build cache was redirected to /tmp to respect filesystem restrictions.

**Not verified:** Docker image builds/running container stack, `nginx -t`, volume
mount ownership inside Docker, VM backup/restore execution, remote browser login,
real multiuser chat/reconnect through Cloudflare, tunnel connectivity or public
TLS. Docker CLI is installed but its daemon is unavailable; no Nginx binary is
installed. Existing Playwright tests target the separate static demo and were not
run as production end-to-end tests. Run DEPLOYMENT.md's post-launch checks before
calling the actual server operational. No existing SQLite data was deleted/reset.

## Changed files

- `.env.production.example`
- `.gitignore`
- `DEPLOYMENT.md`
- `README.md`
- `SECURITY-REVIEW.md`
- `backend/.dockerignore`
- `backend/Dockerfile`
- `backend/cmd/server/main.go`
- `backend/internal/auth/handler.go`
- `backend/internal/comments/handler.go`
- `backend/internal/config/config.go`
- `backend/internal/config/config_test.go`
- `backend/internal/groups/handler.go`
- `backend/internal/middleware/cors.go`
- `backend/internal/middleware/proxy.go`
- `backend/internal/middleware/security_test.go`
- `backend/internal/posts/handler.go`
- `backend/internal/router/dependencies.go`
- `backend/internal/router/production_test.go`
- `backend/internal/router/router.go`
- `backend/internal/users/handler.go`
- `backend/internal/websocket/client.go`
- `backend/internal/websocket/handler.go`
- `backend/internal/websocket/origin_test.go`
- `backend/pkg/db/sqlite/sqlite.go`
- `compose.prod.yaml`
- `deploy/nginx/nginx.conf`
- `deploy/nginx/proxy.conf`
- `frontend/.dockerignore`
- `frontend/Dockerfile`
- `frontend/next.config.ts`
- `frontend/package.json`
- `frontend/src/lib/api.ts`
- `frontend/tests/api-config.test.mjs`
