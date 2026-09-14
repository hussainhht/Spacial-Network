# Social Network frontend

A Next.js App Router social network with one shared SVG/CSS space background. Page navigation uses ordinary Next.js links. No page depends on a planet or a 3D transition.

From this directory:

```sh
npm ci
npm run dev
```

The Go backend serves the existing API and WebSocket endpoints on `localhost:8080`. The frontend runs on `localhost:3000`.

## Structure

- `src/app`: authentication and social application routes.
- `src/components/layout`: the existing sidebar, navbar, and scrollable AppShell.
- `src/components/space`: shared background and intentionally dormant model renderer/material helpers.
- `src/features`: auth, posts, comments, groups/events, profiles/followers, private chat, and notifications.
- `src/providers`: the shared WebSocket connection.
- `public/models/planets`: preserved optimized GLB assets.

The root layout mounts SpaceBackground and WebSocketProvider. The main layout adds NotificationProvider, GroupStateSync and AppShell. AppShell retains GroupsSearchProvider and composes the full-width navbar, permanent desktop orbital navigation, responsive mobile dock, and route content. Models are not loaded by the running application.

## Validation

```sh
npm run lint
npm run build
npm run test:smoke
```

The smoke test requires Go, Python 3, and Python Playwright with Chromium (`python3 -m pip install playwright` and `python3 -m playwright install chromium`). It refuses to run if ports 3000 or 8080 are occupied, builds the unchanged backend into a temporary directory, starts the production frontend and a fresh SQLite database, and tests real routes, uploads, comments, groups/events, invitations, followers, private messages, notifications, mobile layouts, and reduced motion. It uses the repository's existing webapp-testing server helper. Run `npm run build` first.

Test accounts, uploads, database, screenshots, and results stay under the reported `/tmp/social-cleanup-smoke.*` directory. Servers stop when the test exits. Set `CLEANUP_ARTIFACTS` to choose the output directory for screenshots and results. Group chat remains an existing disabled placeholder.

`package-lock.json` is the primary npm lockfile. `pnpm-lock.yaml` was regenerated from it to remove the previous drift and retain the same dependency versions.

See [CLEANUP_REPORT.md](CLEANUP_REPORT.md) for the audit, deleted-file manifest, limitations, and validation evidence, and [MODEL_ASSETS.md](MODEL_ASSETS.md) for asset sizes and duplicate candidates.
