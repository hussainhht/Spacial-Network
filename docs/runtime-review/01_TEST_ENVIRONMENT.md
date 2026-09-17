# Test Environment & Runtime Configuration

## 1. Source State & Tested Commit

- **Repository Root:** `/home/hussain-hht/Desktop/ss2/social-network`
- **Git Branch:** `feat/auth-regester-page`
- **Git Commit:** `0fa6276fd2daff461a33b47aa599324f0bfa02b0`
- **Audit Timestamp:** 2026-09-17 01:53 UTC
- **Host OS:** Linux (Ubuntu/Debian-based x86_64, kernel 6.x)
- **Node.js Version:** `v24.18.0`
- **npm Version:** `11.16.0`
- **Go Version:** `go1.27.1 linux/amd64`
- **Browser Automation Client:** Playwright `1.63.0` with Headless Chromium, isolated multi-user browser contexts

---

## 2. Service Commands & Execution Modes

### Backend Service
- **Mode:** Native Go Process (`net/http.ServeMux`)
- **Working Directory:** `/home/hussain-hht/Desktop/ss2/social-network/backend`
- **Execution Command:** `go run ./cmd/server` (Note: `go run ./cmd/server/main.go` fails due to package main split across `main.go` and `shutdown.go`)
- **Listen Address:** `http://localhost:8080`
- **WebSocket Upgrade URL:** `ws://localhost:8080/api/ws`
- **Environment Variables:**
  - `SERVER_PORT=8080` (default)
- **Process Supervision:** Antigravity managed background task

### Frontend Service
- **Mode:** Next.js 16.3.2 (Turbopack development server) with React 19.2.8
- **Working Directory:** `/home/hussain-hht/Desktop/ss2/social-network/frontend`
- **Execution Command:** `npm run dev`
- **Listen Address:** `http://localhost:3000` (Network: `http://192.168.100.24:3000`)
- **Process Supervision:** Antigravity managed background task

---

## 3. Database & Data Isolation

- **Engine:** SQLite3 with WAL mode and `PRAGMA foreign_keys = ON;`
- **Storage Location:** `/home/hussain-hht/Desktop/ss2/social-network/backend/data/social-network.db`
- **User Data Protection:**
  - Pre-existing database was fully preserved and backed up to `backend/data/social-network.db.user_bak`.
- **Seed Method:** Executed `go run ./cmd/seed -clean=true` inside `backend/`.
  - Applied all 30 database migrations via embedded migrations (`embed.FS`).
  - Seeded 8 sample accounts (`alice`, `bob`, `charlie`, `diana`, `elena`, `frank`, `grace`, `cosmonaut`) with known roles, mutual follows, groups, events, posts, comments, private messages, and notifications.
  - Dynamically generated temporary disposable accounts are created during tests with unique timestamped prefixes (`rt_user_*`).

---

## 4. Media & Uploads Storage

- **Upload Directory:** `/home/hussain-hht/Desktop/ss2/social-network/backend/data/uploads`
- **Static Serving Route:** `http://localhost:8080/uploads/*`
- **Configured Limits:**
  - Max avatar size: 5 MiB
  - Max media attachment size: 5 MiB per attachment

---

## 5. Known Constraints & Environmental Caveats

1. **Frontend Host Binding:** `frontend/src/lib/api.ts` hardcodes `http://localhost:8080` and `ws://localhost:8080`.
2. **Backend CORS Whitelist:** `backend/internal/middleware/cors.go` hardcodes `Access-Control-Allow-Origin: http://localhost:3000` with `Access-Control-Allow-Credentials: true`. Access via any non-`localhost:3000` origin triggers browser CORS blocking.
3. **Database Concurrency Policy:** SQLite connection pool is configured with `SetMaxOpenConns(1)` and `SetMaxIdleConns(1)` in WAL mode to avoid database locking.
4. **Two-Tier Limiter Active:** The rate limiter enforces a burst capacity of 30 global requests and 10 per-endpoint requests with a 15–30s exhaustion penalty.

