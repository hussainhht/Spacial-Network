# Backend

> Go APIs, authorization, SQLite, migrations, and realtime infrastructure.

[← Back to project README](../README.md)

## Contents

- [Overview](#overview)
- [Technology Stack](#technology-stack)
- [Architecture](#architecture)
- [API Routes](#api-routes)
- [Authentication and Sessions](#authentication-and-sessions)
- [Privacy and Authorization](#privacy-and-authorization)
- [WebSocket Hub and Realtime](#websocket-hub-and-realtime)
- [Uploads and Media](#uploads-and-media)
- [Database](#database)
- [Migrations](#migrations)
- [Seed Data](#seed-data)
- [Rate Limiting](#rate-limiting)
- [Configuration and Environment Variables](#configuration-and-environment-variables)
- [Testing](#testing)
- [Development Commands](#development-commands)
- [Docker](#docker)
- [Folder Structure](#folder-structure)
- [Adding a New Feature](#adding-a-new-feature)
- [Adding a Migration](#adding-a-migration)
- [Related Documentation](#related-documentation)

## Overview

The backend is a single Go module (`module social`) that serves a JSON REST API under `/api/`, one multiplexed
WebSocket connection at `/api/ws`, and static uploaded files under `/uploads/`. There is no web framework — routing,
middleware, and JSON handling are all built directly on the standard library plus Gorilla WebSocket and
`mattn/go-sqlite3`.

Working directory for every command in this guide is `backend/` unless stated otherwise.

## Technology Stack

| Concern | Choice |
|---|---|
| Language | Go 1.26 |
| HTTP | Standard library `net/http` + `http.ServeMux` (method-prefixed patterns, e.g. `"POST /posts"`) |
| Realtime | `gorilla/websocket` |
| Database | SQLite via `mattn/go-sqlite3`, foreign keys on, WAL mode |
| Password hashing | `golang.org/x/crypto/bcrypt` |
| IDs | `google/uuid` for public identifiers and upload filenames |
| Migrations | Hand-rolled runner over embedded SQL (`embed.FS`), no external migration library |

## Architecture

Every domain lives in its own package under `internal/` — `auth`, `users`, `followers`, `posts`, `comments`,
`likes`, `share`, `groups`, `chat`, `websocket`, `notifications`, `search`, `upload` — and each follows the same
internal shape:

```text
model.go        → request/response and database-row types
validation.go   → input validation (where the domain needs it)
errors.go       → sentinel errors, mapped to HTTP status at the handler
repository.go   → SQL only, no business rules
service.go      → business rules, authorization, orchestration
handler.go      → HTTP in/out only, one method per route
ws.go           → WebSocket entrypoint (only on packages with a live-socket feature)
```

Dependencies always flow one way:

```text
handler.go → service.go → repository.go → SQLite
```

A feature never imports another feature's repository directly. When one domain needs another (for example, posts
needing to send a notification), it declares a small local interface — something that can `Notify(...)`, say — and
the dependency's real service satisfies it without an adapter. Everything is constructed once, in
`internal/router/dependencies.go`'s `setupDependencies`, and wired into `Dependencies.Handlers.<Feature>`.

**Server lifecycle** (`cmd/server/main.go`):

```text
config.Load()
  → sqlite.Open(cfg.DBDir, cfg.DBFile)       // creates data dir, enables foreign keys, pings
  → sqlite.MigrateUp(db)                     // applies any pending embedded migrations
  → router.NewRouter(db, cfg)                // setupDependencies + route registration
  → http.Server{Addr: ":"+cfg.ServerPort}.ListenAndServe()   // in a goroutine
  → waitForShutdown(server)                  // blocks on SIGINT/SIGTERM, then server.Shutdown(ctx) with a 10s grace period
```

**Router** (`internal/router/router.go`) uses two `http.ServeMux` instances: an outer mux that dispatches `/api/*`
to the API mux (via `http.StripPrefix`) and `/uploads/*` to a plain `http.FileServer`, and an inner API mux that
registers every route below. Two middlewares wrap routes:

- `middleware.CORS` wraps the whole API mux — fixed to `http://localhost:3000` (see [Related Documentation](#related-documentation)).
- `middleware.SessionMiddleware` wraps every route except `/login` and `/register` — validates the session cookie,
  slides its expiry forward, and injects the user ID into the request context via `requestctx.WithUserID`.
- `middleware.RateLimit` wraps effectively every route (see [Rate Limiting](#rate-limiting)).

## API Routes

All paths below are relative to `/api`. Every route requires a session cookie unless marked **public**.

<details>
<summary><b>Auth and profile</b></summary>

| Route | Notes |
|---|---|
| `POST /register` | **Public.** Multipart form, optional avatar |
| `GET\|POST /login` | **Public.** `GET` checks an existing session; `POST` authenticates |
| `GET\|POST /logout` | Revokes the session, clears the cookie |
| `GET /users/me` | Current user |
| `PATCH /users/me/profile` | Edit profile fields |
| `PATCH /users/me/avatar` | Replace avatar |
| `PATCH /users/me/password` | Change password |
| `PATCH /users/me/privacy` | Toggle public/private profile |
| `GET /profiles/{username}` | Viewer-aware profile read |
| `GET /users/recommendations` | "Who to follow" |

</details>

<details>
<summary><b>Followers</b></summary>

| Route | Notes |
|---|---|
| `POST\|DELETE /profiles/{username}/follow` | Follow / unfollow (or request, if private) |
| `GET /profiles/{username}/follow-status` | Current relationship |
| `GET /profiles/{username}/followers` \| `/following` | Social lists |
| `GET /follow-requests` | Pending requests for the current user |
| `POST /follow-requests/{requestID}/accept\|decline` | Resolve a request |

</details>

<details>
<summary><b>Posts, comments, likes, sharing</b></summary>

| Route | Notes |
|---|---|
| `POST /posts` | Create (multipart, up to 4 images) |
| `GET /posts` | Feed — `all` / `following` / `friends`, cursor-paginated |
| `GET\|PUT\|PATCH\|DELETE /posts/{id}` | Read / edit / delete |
| `POST /posts/{id}/comments` \| `GET /posts/{id}/comments` \| `.../count` | Comments |
| `DELETE /comments/{commentID}` | Delete a comment |
| `GET\|POST\|DELETE /posts/{id}/likes` | Like status / like / unlike |
| `POST /posts/{id}/share` | Share into a private or group conversation |

</details>

<details>
<summary><b>Groups, events, group content</b></summary>

| Route | Notes |
|---|---|
| `GET\|POST /groups` | List / create |
| `GET /groups/recommendations` \| `/mine` | Suggested / owned+joined groups |
| `GET\|PUT\|DELETE /groups/{id}` | Read / update / delete |
| `GET /groups/{id}/members` \| `/membership` | Membership |
| `DELETE /groups/{id}/members/{memberID}` | Remove a member (creator only) |
| `POST\|DELETE\|GET /groups/{id}/join-requests` | Request / cancel / list (creator) |
| `POST /groups/{id}/join-requests/{requestID}/accept\|reject` | Creator review |
| `POST /groups/{id}/invitations` | Creator-only invite |
| `GET /group-invitations` | Invitations addressed to the current user |
| `POST /group-invitations/{invitationID}/accept\|decline` | Invitee response |
| `POST\|GET /groups/{id}/events` | Create / list events |
| `GET /groups/{id}/events/{eventID}` \| `/responses` | Event detail / attendee list |
| `PUT /groups/{id}/events/{eventID}/response` | RSVP upsert (`going` / `not_going`) |
| `POST\|GET /groups/{id}/posts` | Group-scoped posts (same `posts` table, `group_id` set) |
| `GET /groups/{id}/messages` | Group chat history |

</details>

<details>
<summary><b>Chat, notifications, search, realtime</b></summary>

| Route | Notes |
|---|---|
| `GET /chat/history` \| `/conversations` \| `/eligible-contacts` | Private chat |
| `GET /notifications` \| `/unread-count` | Read |
| `PATCH /notifications/{id}/read` \| `/read-all` | Mark read |
| `GET /search` | Universal search (not rate-limited) |
| `GET /ws` | WebSocket upgrade, session-authenticated |

</details>

## Authentication and Sessions

```text
register (multipart form + optional avatar)
   → validate fields → bcrypt-hash password → insert user row
login (username or email + password)
   → look up credentials → bcrypt.CompareHashAndPassword
   → 32 random bytes, hex-encoded → 64-char session token
   → upsert the user's session row (expires_at = now + 24h)
   → Set-Cookie: session_token, HttpOnly, SameSite=Lax, Secure=false
authenticated request
   → SessionMiddleware reads the cookie → ValidateSession → UpdateSessionExpiry (slides the 24h window)
   → user ID injected into context via requestctx.WithUserID
logout
   → RevokeSession (revoked_at = now) → cookie cleared (MaxAge -1)
```

A background sweep on every server start (`AuthService.CleanupSessions`) deletes expired sessions and revoked
sessions older than 30 days; failure to clean up is logged, not fatal. The WebSocket upgrade is authenticated the
same way, at the handshake — `GET /ws` sits behind the same `SessionMiddleware` as any other route.

## Privacy and Authorization

Authorization lives in the **service** layer, not the handler or the database — see the user-facing rules in the
[root README's Privacy Model](../README.md#privacy-model). A few implementation notes worth knowing as a backend
contributor:

- Nothing is cached for the lifetime of a request beyond the session lookup: group membership and follow
  relationships are re-queried at the moment of each write or history read, so a permission change (a member
  removed, a follow revoked) takes effect on the very next request or socket event.
- Hidden resources return `404`, not `403`, wherever returning `403` would itself leak that the resource exists.
- `search` is the one route not wrapped in `RateLimit`; every other authenticated route is.

## WebSocket Hub and Realtime

`internal/websocket` is a transport-only package — it multiplexes typed JSON frames and has no knowledge of chat,
group, or notification payload shapes:

```json
{ "type": "private_message", "payload": { "...": "..." } }
```

- **Hub** (`hub.go`): connections are tracked as `map[int64]map[*Client]bool` keyed by user ID, guarded by an
  `RWMutex`, so one user can hold several live connections (multiple tabs/devices) at once. `SendToUser`,
  `SendToUsers`, and `Broadcast` push to those maps directly; `GetOnlineUserIDs` / `IsUserOnline` read presence
  straight from hub state rather than a separate table.
- **Client** (`client.go`): each connection owns a buffered outbound channel. A full buffer or a dead connection is
  treated as a slow/gone client and unregistered rather than blocking the sender — nothing waits on a stuck reader.
- **Router** (`router.go` / `events.go`): a single process-wide dispatcher demultiplexes inbound frames by
  `type` and calls the matching domain handler (chat, groups, notifications).

Feature packages (`chat`, `groups`, `notifications`) each contribute their own `ws.go` that registers with this
router and reuses their normal `service.go` — a chat message arriving over the socket runs through the same
authorization and persistence path as if it had arrived over REST. Durable events (chat messages, notifications,
event-RSVP changes) are written to SQLite before the hub pushes them; presence and typing state live only in the
hub. Notification events reuse the exact JSON shape the REST `GET /notifications` endpoint returns, so the two
transports can't drift apart.

## Uploads and Media

`internal/upload` owns filesystem storage for avatars, group photos, event covers, and post/comment media. Every
save follows the same shape regardless of caller:

1. Reject anything over the configured size limit before reading the body.
2. Read the first bytes and detect the real MIME type with `http.DetectContentType` — the client-supplied
   extension is never trusted.
3. Generate a UUID filename, write with `O_EXCL` so an existing file is never silently overwritten.
4. On any later failure (a database insert that fails, for example), the newly written file is removed.

Static files are served back by a plain `http.FileServer` mounted at `/uploads/`, outside of session middleware —
by design, anyone with a URL can load an uploaded file without authenticating, the same way a browser loads any
other static asset.

## Database

SQLite runs with `?_foreign_keys=on` and WAL mode. The connection pool is deliberately capped at one open and one
idle connection (`db.SetMaxOpenConns(1)` / `SetMaxIdleConns(1)`) — early concurrent integration tests hit SQLite's
`database is locked` errors, and pinning the pool to a single connection removed the class of bug entirely rather
than working around it case by case.

For the full entity map, see the [root README's Database and Migrations section](../README.md#database-and-migrations).

## Migrations

Every migration is a timestamped pair under `pkg/db/migrations/sqlite/`:

```text
20260909180000_add_group_id_to_posts.up.sql
20260909180000_add_group_id_to_posts.down.sql
```

The 14-digit `YYYYMMDDHHMMSS` version means migrations authored on parallel branches never collide the way
sequential integers would. Files are compiled into the binary with `//go:embed`, so the running binary never
depends on SQL files existing on disk beside it. A `schema_migrations(version, name, applied_at)` table tracks what
has run; each up or down migration executes inside its own transaction, so a migration and its tracking-row update
commit or roll back together.

```bash
go run ./cmd/migrate up           # apply every pending migration, in order
go run ./cmd/migrate down         # roll back only the most recent migration
go run ./cmd/migrate down-all     # roll back to an empty schema
go run ./cmd/migrate version      # print the highest applied version, or 0
go run ./cmd/migrate create <name>  # scaffold a new timestamped .up.sql / .down.sql pair
```

`cmd/server` calls the equivalent of `migrate up` automatically on every startup, so a fresh checkout is always
brought up to date without a manual step. There are 30 migration pairs in the current schema.

Full guide: [`docs/database/database-migration-guide.md`](../docs/database/database-migration-guide.md).

## Seed Data

```bash
go run ./cmd/seed              # reset + populate a full demo dataset (default: --clean=true)
go run ./cmd/seed --clean=false --bulk 100   # layer 100 extra repeat-safe feed posts onto existing data
```

`cmd/seed` calls `sqlite.MigrateUp` itself first, so it's safe to run against a brand-new database. The default run
creates eight space-themed demo users (password `Password123!` for all of them — printed to the terminal at the
end, along with a full summary of what was created), mutual follows and pending follow requests, five groups (four
public, one private) with memberships/invitations/join-requests, four upcoming events with RSVPs, eleven posts
across all three visibility tiers, comments, private and group chat threads, and notifications.

## Rate Limiting

`internal/ratelimit` implements a two-tier token bucket, applied per user by `middleware.RateLimit` on almost every
route:

| Tier | Capacity | Refill | Penalty once empty |
|---|---:|---:|---:|
| Global (per user, shared across all endpoints) | 30 | 10/s | 30s |
| Per-endpoint (per user + endpoint) | 10 | 3/s | 15s |

A request must pass **both** buckets. Once either empties, further matching requests are rejected with `429` for
the full penalty window — the timeout is a deliberate backoff, not just "wait for the bucket to refill." A handful
of cheap, high-frequency reads (like status, comment counts) are discounted to a fraction of a token so normal feed
scrolling doesn't trip a limiter that's meant to catch abuse. WebSocket chat frames are throttled the same way,
returning a typed error event over the socket instead of an HTTP status.

Design notes: [`internal/ratelimit/README.md`](internal/ratelimit/README.md).

## Configuration and Environment Variables

All configuration is loaded once in `internal/config.Load()`. Only the server port reads from the environment
today — everything else is a Go constant:

| Variable | Default | Purpose |
|---|---|---|
| `SERVER_PORT` | `8080` | HTTP listen port |

| Constant | Value |
|---|---|
| `DBDir` / `DBFile` | `data` / `social-network.db` |
| `SessionCookieName` | `session_token` |
| `SessionLifetime` | 24 hours (sliding) |
| `CookieSecure` | `false` |
| `UploadsDir` | `data/uploads` |
| `MaxAvatarSize` / `MaxMediaSize` | 5 MiB each |

Database and upload paths are relative, so run backend commands from `backend/` — a different working directory
creates or reads a different `data/` folder.

## Testing

```bash
go build ./...
go vet ./...
go test -count=1 ./...
go test -race -count=1 ./...
```

`tests/` holds one black-box integration package per feature (`auth`, `chat`, `comments`, `followers`, `groups`,
`likes`, `notifications`, `posts`, `profile`, `search`, `share`, `upload`, plus a shared `db`/`testutil`/`bucket`
harness) driven against a real SQLite database and real HTTP handlers, including dedicated WebSocket hub
concurrency coverage.

## Development Commands

```bash
go run ./cmd/server              # start the API + WebSocket server on :8080
SERVER_PORT=8081 go run ./cmd/server   # on a different port
go run ./cmd/migrate version     # check the current schema version
go run ./cmd/seed                # load demo data
```

From the Makefile at the repository root: `make server`, `make migrate`, `make seed`, `make test` — see the
[root README's Getting Started](../README.md#getting-started).

Avoid `go run main.go` from inside `cmd/server/` — it compiles only that file and skips `shutdown.go`, so graceful
shutdown won't build. Use `go run ./cmd/server` (or `go run .` from within that directory) instead.

## Docker

`backend/Dockerfile` is a two-stage build: `golang:1.26-bookworm` compiles `social-server` and `social-migrate`,
then a `debian:bookworm-slim` runtime image copies just the binaries. `SERVER_PORT` defaults to `8080`,
`/app/data` is declared as a volume (mapped to the `backend-data` named volume by the root `compose.yaml`), and the
container's entrypoint is `social-server` — migrations still run automatically on that binary's startup, exactly
as they do natively.

## Folder Structure

```text
backend/
├── cmd/
│   ├── server/    # main.go, shutdown.go — HTTP + WebSocket entrypoint
│   ├── migrate/   # migration CLI
│   └── seed/      # demo-data seeder (seed.go, bulk.go)
├── internal/
│   ├── auth/ users/ followers/            # identity and social graph
│   ├── posts/ comments/ likes/ share/     # feed and interactions
│   ├── groups/                            # groups, invitations, join requests, events (event_*.go)
│   ├── chat/ websocket/ notifications/    # realtime layer
│   ├── search/ upload/
│   ├── middleware/ ratelimit/ router/     # cross-cutting concerns and dependency wiring
│   └── config/ validation/ requestctx/
├── pkg/
│   ├── db/migrations/sqlite/   # embedded .up.sql / .down.sql pairs
│   └── db/sqlite/              # connection + migration runner
└── tests/     # one integration package per feature, plus testutil/db/bucket helpers
```

## Adding a New Feature

1. Create `internal/<feature>/` with `model.go`, `repository.go`, `service.go`, `handler.go` (and `validation.go`
   / `errors.go` / `ws.go` as needed).
2. If it needs another feature's behavior, declare a small local interface for it rather than importing that
   feature's repository or service type directly.
3. Add migrations for any new tables (see [Adding a Migration](#adding-a-migration)).
4. Construct the repository → service → handler chain in `internal/router/dependencies.go`, and add the handler to
   `Dependencies.Handlers`.
5. Register routes in `internal/router/router.go`, wrapped in `sessionMiddleware` and `rateLimit` unless the route
   is intentionally public.

## Adding a Migration

```bash
go run ./cmd/migrate create add_something_useful
```

This scaffolds a timestamped `.up.sql` / `.down.sql` pair under `pkg/db/migrations/sqlite/`. Write the schema
change in the `.up.sql` file and its exact inverse in `.down.sql`; both run inside a single transaction when
applied. Restart the server (or run `go run ./cmd/migrate up`) to apply it locally.

## Related Documentation

- [Database migration guide](../docs/database/database-migration-guide.md) and [schema reference](../docs/database/schema.dbml)
- [Rate limiting design](internal/ratelimit/README.md)
- [Root README](../README.md) — product overview, privacy model, and the Docker/Makefile quickstart
