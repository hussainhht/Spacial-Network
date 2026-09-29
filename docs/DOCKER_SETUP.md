# Run Social Network with Docker

All commands in this guide run from the repository root, the directory containing `compose.yaml`.

## Overview

Docker Compose builds and starts two services: the Go `backend` and the Next.js `frontend`. The backend owns the SQLite database, uploads, REST API, and WebSocket endpoint. There is no separate database container.

```text
Browser → http://localhost:3000 (Next.js frontend)
        ├─ HTTP → http://localhost:8080/api/... (Go backend)
        ├─ WebSocket → ws://localhost:8080/api/ws (Go backend)
        └─ uploaded images → http://localhost:8080/uploads/...
                                   ↓
                        /app/data (SQLite + uploads)
                                   ↓
                        backend-data Docker volume
```

These URLs are for a browser on the same computer as Docker. Inside the Compose network, a container could reach the backend at `http://backend:8080`; `localhost` inside a container means that same container. The current browser client uses literal `localhost:8080` HTTP and WebSocket URLs in [`frontend/src/lib/api.ts`](../frontend/src/lib/api.ts). The frontend's `NEXT_PUBLIC_*` build arguments do **not** change those client URLs. This setup therefore assumes the browser runs on the Docker host and uses the configured ports.

## Prerequisites

- Docker Engine or Docker Desktop with a running daemon, and the `docker compose` command (Compose v2 or newer).
- Free host ports **3000** and **8080**.
- Access to download the base images and build dependencies on the first build.

Check Docker from a terminal:

```bash
docker --version
docker compose version
docker info
```

No `.env` file, host Go installation, host Node installation, or manual SQLite installation is required for the checked-in Compose configuration. There is no checked-in `.env.example` for this workflow. The frontend image uses Node 20 and `npm ci` with `frontend/package-lock.json`; the backend image builds with Go 1.26. The additional `frontend/pnpm-lock.yaml` is not used by the Dockerfile.

## First-time setup

1. Obtain the repository using your team's repository URL. From the parent directory of the resulting `social-network` checkout, enter its root:

   ```bash
   cd social-network
   ```

   If you already cloned it elsewhere, enter that checkout's directory containing `compose.yaml`.
2. Build both images and start both services in the background:

   ```bash
   docker compose up --build -d
   ```

   Compose creates the `backend-data` volume on first start. The backend opens SQLite and applies pending migrations automatically before it starts accepting HTTP requests. The frontend build uses the Dockerfile's `npm ci`, `npm run build -- --webpack`, and production `npm run start` commands.
3. Check startup:

   ```bash
   docker compose ps
   docker compose logs --tail=50 backend
   docker compose logs --tail=50 frontend
   ```

   Both services should show as running. The backend log should show `Server running on http://localhost:8080`; the frontend should report that it is ready on port 3000. There are no Compose health checks: `depends_on` starts the backend first but does not wait for its migrations or HTTP readiness. If a request fails immediately, wait for startup and retry.
4. Open **http://localhost:3000** in a browser. For a minimal HTTP check from the Docker host:

   ```bash
   curl -i http://localhost:3000/login
   curl -i http://localhost:8080/api/users/me
   ```

   The login page should return HTTP 200. `/api/users/me` is a real session-protected endpoint, so HTTP 401 without a session confirms that the backend route is responding; it is not a health endpoint. To check the full browser flow, register or log in through the UI, then inspect the browser's Network panel for requests to `localhost:8080/api/` and an authenticated WebSocket connection to `ws://localhost:8080/api/ws`. The WebSocket requires a valid session; an anonymous connection is expected to fail.

## Everyday commands

Run these from the repository root:

| Task                                                                  | Command                                                                   |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Start existing images in the background                               | `docker compose up -d`                                                  |
| Build and start after a fresh clone or source change                  | `docker compose up --build -d`                                          |
| Start with logs attached (Ctrl+C stops this foreground stack)         | `docker compose up --build`                                             |
| Stop containers but retain them and their data                        | `docker compose stop`                                                   |
| See service state and published ports                                 | `docker compose ps`                                                     |
| Show recent logs from both services                                   | `docker compose logs --tail=100`                                        |
| Follow one service's logs                                             | `docker compose logs -f backend` or `docker compose logs -f frontend` |
| Restart one running service                                           | `docker compose restart backend` or `docker compose restart frontend` |
| Rebuild changed images and recreate services as needed                | `docker compose up --build -d`                                          |
| Remove this stack's containers and network, retaining its data volume | `docker compose down`                                                   |

The Compose setup runs a production build of Next.js and a compiled Go binary. It does not mount source directories or provide live reload. Source or frontend build-argument changes need an image rebuild; `docker compose restart` alone keeps the old image. `docker compose down` followed by `docker compose up -d` is safe for the named data volume, but a new clone needs `--build`.

## Configuration reference

The checked-in values in `compose.yaml` are the working single-host setup. Changing them requires understanding the hardcoded browser and CORS values below.

| Setting                           | Configured in                            | Purpose and current value                                                                                                                                  | Applied when                                                                                          |
| --------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `SERVER_PORT`                   | `compose.yaml` backend `environment` | Go HTTP listen port:`8080`. The backend config also defaults to `8080`. The Compose port mapping is separately fixed at `8080:8080`.                 | Backend runtime                                                                                       |
| `NEXT_PUBLIC_BACKEND_ORIGIN`    | `compose.yaml` frontend build arg      | `http://localhost:8080`; configures the allowed backend upload image origin in `frontend/next.config.ts`. The browser API helper currently ignores it. | Frontend build; also copied into the image runtime environment, but not used by the client URL helper |
| `NEXT_PUBLIC_BACKEND_WS_ORIGIN` | `compose.yaml` frontend build arg      | `ws://localhost:8080`; currently ignored by the browser WebSocket URL helper.                                                                            | Frontend build; also copied into the image runtime environment, but not used by the client URL helper |
| `NEXT_IMAGE_UNOPTIMIZED`        | `compose.yaml` frontend build arg      | `true`; disables Next image optimization for this image.                                                                                                 | Frontend build                                                                                        |

`NEXT_PUBLIC_*` values are browser-exposed when used in Next.js client code. They must be valid **browser** addresses, not Compose-only names such as `backend`. Next.js embeds client-used public values during the image build; changing a container's runtime environment would not replace built client JavaScript. In this repository, the API and WebSocket helper currently returns literal `http://localhost:8080` and `ws://localhost:8080` instead.

The backend's CORS middleware allows the exact origin `http://localhost:3000` and credentials. Session requests include cookies; the session cookie is `HttpOnly`, `SameSite=Lax`, and currently `Secure=false` for HTTP localhost. These are Go code constants, not Compose environment variables. Opening the frontend with another hostname, IP address, scheme, or port can break credentialed requests even when the page itself loads. HTTPS and remote-browser access require application/configuration changes; the current client also uses `ws://`, not `wss://`.

## Data and migrations

The backend Dockerfile sets `WORKDIR /app`. SQLite is opened at **`/app/data/social-network.db`** and uploads are written under **`/app/data/uploads/`**. Compose mounts the named volume `backend-data` at `/app/data`. Docker usually names it `social-network_backend-data` for this project, as shown by `docker compose config`. It is a Docker-managed volume, not `backend/data/` in your checkout.

The server applies pending embedded SQL migrations on every startup, before listening on port 8080. No first-run migration command is needed. If it cannot open the database or a migration fails, the backend exits and its logs show `database:` or `migrations:`. After adding migration source files, rebuild the backend image so the new SQL is embedded, then start it again. For migration details, see the [database migration guide](database/database-migration-guide.md).

`docker compose stop`, `docker compose down`, container recreation, and image rebuilds keep the named volume. **Deleting the `backend-data` volume or running `docker compose down -v` erases the SQLite database and all uploaded files in it.** Check and back up data before any volume-removal command. The Docker build contexts exclude local `data/`, uploads, and `.env` files, so a local backend database is not copied into the image.

## Troubleshooting

Start with `docker compose ps` and `docker compose logs --tail=100 backend frontend` from the repository root.

| Symptom                                                          | Likely cause                                                                                          | Safe next step                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docker info` cannot reach the daemon, or permission is denied | Docker is stopped or your account cannot use its socket                                               | Start Docker Desktop/Engine; use your platform's documented Docker access setup, then rerun`docker info`.                                                                                                                                               |
| Bind error for port 3000 or 8080                                 | Another process owns a fixed host port                                                                | Check`docker compose ps` and your other local services; stop the conflicting process only if it is yours. Both the browser URLs and backend CORS assume the current ports.                                                                              |
| Frontend build fails during`npm ci`                            | `package.json` and `package-lock.json` disagree, or dependency download failed                    | Read the failing build step. The Dockerfile uses npm and the npm lockfile, even though a pnpm lockfile also exists. Repair the lockfile mismatch in the normal development workflow, then rebuild; do not switch package managers in the Compose command. |
| Backend exits with`database:` or `migrations:`               | Volume access problem, SQLite error, or failed embedded migration                                     | Read`docker compose logs backend`. Check volume existence with `docker volume ls`; fix the reported permission/schema issue without deleting the volume. Rebuild if new migration SQL was added.                                                      |
| Page loads but API calls fail                                    | Browser cannot reach`localhost:8080`, or page origin differs from the fixed CORS origin             | Confirm`docker compose ps`, then try `curl -i http://localhost:8080/api/users/me` on the Docker host. Open exactly `http://localhost:3000` and inspect the browser Network panel.                                                                   |
| Login does not persist                                           | Cookie blocked or credentialed CORS request rejected                                                  | Use`http://localhost:3000`; inspect the login response, cookie, and subsequent request in browser developer tools. The backend allows only that origin and sets a Lax, HTTP localhost cookie.                                                           |
| WebSocket fails                                                  | Backend not ready, missing session, or wrong scheme/host                                              | Log in first and inspect the request to`ws://localhost:8080/api/ws`. An anonymous request is rejected; an HTTPS page would require `wss://` and code/config changes.                                                                                  |
| New schema or code does not appear                               | Running image predates source changes                                                                 | Run`docker compose up --build -d`; `restart` does not compile changed Go, SQL, or Next.js files.                                                                                                                                                      |
| Changed environment value has no effect                          | Compose value is overridden by hardcoded client URL or Go constant, or frontend image was not rebuilt | Compare`compose.yaml` with `frontend/src/lib/api.ts`, `frontend/next.config.ts`, and `backend/internal/middleware/cors.go`. Rebuild for supported frontend build settings; the hardcoded URLs/CORS require code changes.                          |

There is no dedicated health endpoint or Compose health check, so use status, logs, and the HTTP checks above to diagnose readiness.

## FAQ and technical notes

- **Do I need Go or Node on my host?** No. Docker builds and runs both services.
- **Which URL do I open?** `http://localhost:3000` on the same computer running Docker. The backend API is at `http://localhost:8080/api`.
- **When do I use `--build`?** On first start and after changing source, migrations, dependencies, Dockerfiles, or frontend build arguments.
- **Where is SQLite kept?** In `/app/data/social-network.db` inside the backend container, backed by the Compose `backend-data` named volume. Uploads share that volume.
- **Does stopping Docker delete data?** `stop` and `down` keep the named volume. Removing the volume deletes both database and uploads.
- **What are host and container ports?** `3000:3000` and `8080:8080` map a host port (left) to a container port (right). The browser uses the host ports; Compose containers can use service names on their internal network.

## Validation status

- **Read from current files:** `compose.yaml`, both Dockerfiles and `.dockerignore` files, root and service READMEs, Next.js API/image configuration, backend startup/routes/CORS/session/SQLite/migration code, and ignore rules.
- **Executed:** `docker --version`, `docker compose version`, `docker compose -f compose.yaml config`, and a check for existing containers/listeners on ports 3000 and 8080. This project's stack and both ports were free before the smoke test. `docker compose up --build -d` built both images and started both services. `docker compose ps` showed both running, and the logs showed backend startup and Next.js readiness. `docker compose exec -T backend social-migrate version` returned migration version `20260915130001`.
- **HTTP smoke test:** `GET /login` on port 3000 returned **200**. Unauthenticated `GET /api/users/me` and `GET /api/ws` on port 8080 both returned **401**, as expected for session-protected routes.
- **Still manual:** Browser registration/login, credentialed API calls, and an authenticated WebSocket upgrade were not tested. An anonymous 401 confirms the WebSocket route exists but does not test a successful upgrade. After the test, `docker compose down` removed only the two test containers and their network; `docker volume inspect social-network_backend-data` confirmed the data volume remained.
