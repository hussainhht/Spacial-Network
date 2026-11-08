# Production deployment review — 2026-11-08

This review covers the source repository and local validation. No Proxmox/VM,
Cloudflare account, production data, persistent Docker volumes or GitHub remote
was accessed or modified. Nothing was deployed or pushed. Earlier preparation
claims have been replaced with the evidence from this review.

## Deployment fixes

| Issue | Focused change |
| --- | --- |
| Docker treated `nosuid` as a mount destination | Quote backend/proxy flow-list tmpfs strings. Quote the already-valid frontend block-list strings consistently. All four mount declarations retain their options and bounds. |
| Nginx duplicate read/send timeouts and conflicting Connection headers | Remove Connection and read/send timeouts from the location include. Put ordinary 60s timeouts in `http`; retain 120s WebSocket timeouts and explicit Upgrade/Connection headers in `/api/ws`. Ordinary requests use Nginx's default Connection behavior. |
| Proxy unreachable through a published port with both bridges internal | Use frontend internal=false, backend internal=true. Retain proxy on both networks, backend/frontend on their respective single networks and only 127.0.0.1:8088 published. |
| Missing `/app/node_modules` during a Docker stage copy | Original stage paths were correct. Explicitly include build dependencies in `npm ci` and fail the deps stage unless `node_modules/next` exists. Clean local installation succeeded; the original builder/cache fault cannot be established from repository evidence. No BuildKit protections disabled. |
| Established sockets outlived revoked sessions | Wire the existing database session validator into each socket. Validate before inbound application dispatch and outbound application events, and every 15s while idle. Validation does not extend expiry and fails closed on database errors. |
| Media could be retained by shared caches | Add `Cache-Control: private, no-store` on uploaded media, including HEAD/errors. This does not implement media authorization or purge existing caches. |

The backend Dockerfile was inspected and left unchanged: its CGO Go builder and
Debian runtime match, migrations are embedded, only server/migrate binaries enter
the runtime, and the process runs as UID 10001. The frontend still copies Next's
standalone server, static assets and public assets into a non-root runtime.
Docker contexts exclude environment files, keys, tunnel credentials, data and
backups. Browser build arguments contain only public configuration.

## Dependency audit

Live npm registry audit, not a cached estimate:

| Scope | Before | After compatible updates |
| --- | --- | --- |
| Full lockfile | 8 moderate, 5 high, 1 critical (14 total) | 8 moderate, 0 high, 0 critical |
| `npm audit --omit=dev` | 2 high, 1 critical (3 total) | 0 findings |

Package counts include propagated advisory findings, not fourteen distinct
exploits. Updated direct dependencies: Next 16.3.2 → 16.4.5 and development
`eslint-config-next` 16.3.2 → 16.4.5. No major upgrade or forced audit fix was used.
The lint configuration retains its exact-version declaration. Lockfile fixes:

| Package | Before → after | Dependency path / scope |
| --- | --- | --- |
| `sharp` | 0.35.3 → 0.35.5 | Next, production optional image tooling |
| `source-map-js` | 1.2.1 → 1.2.2 | Next/PostCSS (also Tailwind), production and build tooling |
| `js-yaml` | 4.3.1 → 4.3.2 | ESLint → eslintrc, development |
| `brace-expansion` | 1.1.18 → 1.1.21; 5.0.9 → 5.0.12 | ESLint/minimatch and typescript-eslint/minimatch, development |
| `zod` | 4.4.3 → 4.6.7 | eslint-config-next → react-hooks lint plugin, development |
| `typescript-eslint` family | 8.68.0 → 8.72.1 | eslint-config-next, development |

Next advisories included Windows-hosted RCE (not applicable to Debian), image
optimization/sharp issues (production explicitly disables optimization), and
`next/og`, `use cache`, Server Actions and cache/metadata issues. No application
`ImageResponse`, `use cache`, Server Actions or Draft Mode usage was found during
source inspection. These reduce particular attack paths, but do not justify
leaving a vulnerable framework installed; it was updated regardless. See the
[Next image optimization advisory](https://github.com/advisories/GHSA-2464-fhr4-w9xw),
[Next cache RCE advisory](https://github.com/advisories/GHSA-673q-mjm6-r5xr),
[sharp advisory](https://github.com/advisories/GHSA-wq5f-xc86-pv6w), and
[source-map-js advisory](https://github.com/advisories/GHSA-68fv-2mgg-jv7q).

The remaining eight moderate findings all trace to one
[minimatch amplification advisory](https://github.com/advisories/GHSA-g3hv-75wg-m249):
`minimatch@10.2.6` under `@typescript-eslint/typescript-estree`, propagated through
parser, utils, type-utils, eslint-plugin, typescript-eslint and eslint-config-next.
They affect linting/build-host processing of hostile patterns, not request
handling in this standalone production app. They are absent from the production
npm graph. npm proposes downgrading the lint configuration to 15.5.29; that
breaking downgrade was rejected. A minimatch 11 override would also cross its
parent's major-version constraint, so no untested override was imposed. Recheck
when typescript-eslint supports a patched compatible dependency. ESLint 9 also
reports end of support; a future supported-major migration needs its own review.

Audit success is not a complete image/OS/Go vulnerability scan. No Linux image
was available to inspect its traced dependency set or OS packages here.

## Production security assessment

- **HTTPS/cookies:** public TLS terminates at Cloudflare. Host cloudflared sends
  HTTP to IPv4 loopback Nginx; Nginx overwrites forwarded HTTPS/port headers.
  Production enforces Secure, HttpOnly, host-only, SameSite=Lax cookies. Local TLS
  integration tests verify these flags; public TLS was not contacted.
- **Authentication/authorization:** session middleware gates API/WS access;
  ownership, post visibility, follow/chat eligibility and group membership checks
  remain in the existing services. Their existing tests pass. No auth bypass or
  production seeder was introduced. Password changes retain the existing policy
  and do not themselves revoke sessions.
- **CORS/CSRF/origins:** exact trusted-origin allowlist, Vary: Origin, credentialed
  CORS only for allowed origins; production writes and WS handshakes require an
  Origin. Cross-site fetch writes/WS are rejected. Logout remains POST. No wildcard
  CORS or origin relaxation was introduced.
- **Live socket revocation:** application traffic checks its captured session
  token against SQLite, including user identity. Idle sockets close on the next
  15s check (plus database scheduling/latency). An in-flight event can race a
  revocation; this is bounded revalidation, not an atomic revocation guarantee.
  Extra reads per event/socket need load testing for large populations.
- **Media privacy remains unresolved:** any known uploaded-file URL is still
  publicly readable, even for private posts/groups. Random filenames and blocked
  directory listings are not access control. New no-store headers reduce cache
  retention only. Full authorization must resolve the file's owning avatar,
  post, comment, group or event and apply that object's visibility. A blanket
  login gate would preserve neither public avatars nor private-object isolation.
  Do not promise private-media confidentiality until this is implemented. Do not
  override `/uploads/*` cache rules at Cloudflare; existing cached copies are not
  purged by this repository change.
- **Uploads:** MIME magic-byte allowlists, random filenames, exclusive creation,
  per-file/body limits and removal traversal checks remain. No SVG/HTML upload
  acceptance was added. No disk quota/malware scanner or CSP was introduced.
- **Isolation/secrets/data:** normal services retain non-root users, read-only
  roots, no-new-privileges and all capabilities dropped. Backend has an internal
  network and no host ports; frontend/proxy's ordinary bridge permits egress.
  Docker administrators/VM-local processes remain trusted. Named SQLite and
  uploads volumes are unchanged; migration up runs at startup. Back up together
  with writes stopped; keep one backend replica and retain original volumes.
- **Proxy headers/logs:** Cloudflare client IP replaces untrusted forwarded IP
  headers, backend proxy trust remains opt-in, and access logs omit query strings,
  cookies and request bodies. This requires host cloudflared to be the exclusive
  loopback caller. Health checks do not prove full user-flow correctness.

## Validation evidence

Environment: macOS ARM64, Node 26.3.0/npm 11.16.0, Go 1.26.5, Compose 5.5.0.
Docker CLI is installed but its configured daemon socket does not exist.

| Check | Result this review |
| --- | --- |
| `docker compose --env-file .env.production.example -f compose.prod.yaml config --quiet` | Passed after fixes. |
| Normalized Compose JSON | Backend/proxy each have one `/tmp` option string; frontend has two tmpfs mounts; only proxy publishes 127.0.0.1:8088 → 8080/tcp; backend internal=true, frontend not internal; both named persistent mounts retained. |
| `bash scripts/validate-production.sh --static` | Passed; valid baseline and eight mutation cases reject split mounts, lost noexec, public proxy/backend ports, wrong isolation, lost data and browser localhost. |
| `bash scripts/validate-production.sh --full` | Attempted; stopped at `docker info` because daemon socket is missing. No test services started. |
| Clean `npm ci --include=dev` | Passed; installed 417 packages and created node_modules/next. Local npm warns about unapproved unrs-resolver lifecycle scripts; no protections disabled. Docker/CI use Node 22's npm and remain to be verified. |
| Frontend `npm test`, `npm run lint` | Passed; 41 tests, no ESLint errors. |
| Production `npm run build -- --webpack` | Passed on Next 16.4.5 with empty HTTP/WS origins, unoptimized images, SITE_URL=https://social.l3acler.com; TypeScript and standalone generation passed. |
| Browser artifact scan | 54 compiled browser JS assets checked; no HTTP/WS loopback URLs found. Standalone server, static and public copy inputs exist. |
| Backend `go test -race ./...` | Passed, including existing permissions/auth/upload/migration suites and new live-session checks. Loopback tests required leaving the sandbox; no server was contacted. |
| Changed router/WebSocket tests | Passed after final test changes, including real logout, invalid inbound/outbound events, actual 15s idle timer, media GET/HEAD no-store and existing secure-cookie/origin checks. |
| Backend native server/migrate builds and `go vet ./...` | Passed. Native builds do not verify Debian/CGO image execution. |
| Validation shell and workflow YAML syntax | Bash syntax and workflow YAML parse passed; workflow has not run on GitHub. |

**Not verified here:** either Docker image build, container `nginx -t`, effective
live Docker port bindings/network reachability/tmpfs, named-volume ownership or
container persistence, Node 22/Linux runtime, Cloudflare ingress/WebSocket traffic,
public TLS, VM backup/restore or a multiuser production browser session. The new
CI workflow executes Docker builds and these container checks on an isolated
runner; its full suite must pass before release. Manual tunnel and restore checks
remain in DEPLOYMENT.md. The original historical build failure's root cause is
unconfirmed; local clean npm/build success is not proof of a Docker builder fix.

## Manual application and future GHCR

On the Debian VM, after reviewing/receiving the changes: back up SQLite/uploads,
keep the existing origin, validate the production Compose file, rebuild both
images and recreate services using DEPLOYMENT.md. The network flag change may
require stopping the stack and recreating its networks with `down` **without -v**
before `up`; this preserves volumes but causes downtime. Inspect effective ports,
run `nginx -t`, loopback health/login, then the public HTTPS/WS checks. No Cloudflare
account change is needed when the existing host tunnel already targets loopback
8088. Never delete volumes or reset databases to resolve a deployment failure.

The repository is prepared for a Buildx/GHCR workflow: build contexts, lockfile,
standalone copies and public configuration are in place; validation uses a
`docker-container` builder. Release blockers are the unexecuted Linux container
checks above, and media authorization if confidential attachments are required.
GHCR publishing itself is intentionally not implemented. Later choose image
names/tags/digests and add scoped package publishing permission/authentication;
no deployment automation, SSH credentials or server access is needed.

## Files changed in this review

- `.env.production.example`
- `compose.prod.yaml`
- `deploy/nginx/nginx.conf`
- `deploy/nginx/proxy.conf`
- `frontend/Dockerfile`
- `frontend/package.json`
- `frontend/package-lock.json`
- `backend/internal/router/dependencies.go`
- `backend/internal/router/router.go`
- `backend/internal/router/production_test.go`
- `backend/internal/websocket/client.go`
- `backend/internal/websocket/handler.go`
- `backend/internal/websocket/session_test.go`
- `scripts/check_production_config.py`
- `scripts/test-production-config.py`
- `scripts/validate-production.sh`
- `.github/workflows/production-validation.yml`
- `DEPLOYMENT.md`
- `SECURITY-REVIEW.md`
