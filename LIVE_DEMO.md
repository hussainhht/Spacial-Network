# Spacial Network interactive demo

The demo runs the existing Next.js frontend with a browser-only data service. It preserves AppShell, navigation, CSS Modules, feature components, notifications, messaging, and the real Three.js planet system. The Go backend is unchanged, and ordinary frontend commands retain full-stack mode. Deployment workflows support the approved `main` and `livedemo` branches.

The live demo is **https://hussainhht.github.io/Spacial-Network/**. The full application, live planet binaries, group navigation, and profile deep-link refresh were verified on 27 October 2026 after [deployment 40549382908](https://github.com/hussainhht/Spacial-Network/actions/runs/40549382908) succeeded.

## Run without Go or SQLite

Use Node.js 22, Git LFS, and the npm lockfile. From the repository root:

```sh
git lfs pull --include="frontend/public/models/planets/*.glb" --exclude=""
cd frontend
npm ci
npm run dev:demo
```

Open http://localhost:3000/Spacial-Network/. Nova Reed enters automatically. The account menu contains **Switch demo identity**, **View full-stack source**, and **Reset Demo**.

The development server is useful for editing. Verify the actual static artifact before publishing:

```sh
npm run typecheck
npm run lint
npm run test:demo
npm run check:demo:assets
npm run build:demo
npm run serve:demo
```

Open the same address. `serve:demo` serves only `out/`; it has no Next.js runtime, API, or SPA fallback. Unknown routes return a real 404. Stop an existing development server before starting the static server on port 3000.

Browser tests start this static server automatically if needed:

```sh
npx playwright install chromium
npm run test:demo:browser
```

Run `build:demo` first. Browser QA targets `/Spacial-Network/`, including refreshes and direct links. Screenshots and failure traces are written to the ignored `frontend/test-results/` directory. The suite uses headless Chromium with software WebGL for environments without a GPU.

## How the demo boundary works

`scripts/demo.mjs` sets `NEXT_PUBLIC_DEMO_MODE=true` and the default `NEXT_PUBLIC_BASE_PATH=/Spacial-Network` for Next.js. Ordinary `npm run dev` and `npm run build -- --webpack` retain full-stack mode. Do not set demo variables globally when testing the original application.

The main modules are:

| File | Responsibility |
| --- | --- |
| `frontend/src/demo/config.ts` | Explicit demo flag, public asset prefix, static-safe post/group URLs |
| `frontend/src/demo/seed.ts` | Deterministic fictional identities and connected domain records |
| `frontend/src/demo/store.ts` | Versioned persistence, stored-data validation, identity selection, reset |
| `frontend/src/demo/api.ts` | API-compatible local reads/writes, audience rules, permissions, local message events |
| `frontend/src/demo/DemoControls.tsx` | Identity picker, source link, scoped reset and storage feedback |
| `frontend/src/lib/api/client.ts` | Selects the local adapter only in demo mode |
| `frontend/src/providers/WebSocketProvider.tsx` | Uses a local event bus in demo mode; never opens a socket |
| `frontend/scripts/normalize-export.mjs` | Normalizes Windows route-segment filenames in the artifact |

The feature APIs retain their existing response envelopes and transformations. Profiles, groups, search, login, registration, and logout use `requestFetch`, a service-level adapter returning a `Response`. It delegates to ordinary fetch in full-stack mode. There is no global fetch override, fake token, service worker, backend session, database, or external AI service.

The local adapter enforces illustrative profile, post audience, membership, and creator rules. **These client-side rules are a product demonstration, not a security boundary or a replacement for backend authorization.**

## Sample data and identities

The initial dataset contains 16 fictional profiles, 32 posts (including group posts), 64 comments, 8 communities, 10 fictional events, 7 private conversation histories, group conversation histories, notifications for each identity, likes, relationships, invitations, join requests, and follow requests.

All profile avatars are original local SVG artwork. Group/event covers reuse the repository's existing local artwork; the original GLB assets are unchanged. No private accounts or production data are imported. Email addresses use `example.invalid`.

Useful perspectives:

- **Nova Reed:** public profile, creator of Orbital Observatory, an invitation to Design Orbit, and a pending member request to review under its Members tab. Notification deep links open the relevant group tab.
- **Orion Vale:** creator of Code & Coffee, with a different network and pending group request.
- **Aria Stone:** private profile with pending follow requests. Send Aria a follow request as Nova, switch to Aria to accept it, then switch back to see the newly accessible profile.
- **Other identities:** regular membership and creator perspectives across the seeded communities.

Switching identities reloads the current page, reinitializing feature caches and permissions from the selected identity. All fictional identities share one local dataset, so actions can be reviewed from the other person's perspective. Browser tabs are independent snapshots; refresh another tab to load its latest stored changes.

Edit `seed.ts` to update sample content. Keep route-bearing seed IDs below 1000, maintain valid relationships, and rebuild to generate the corresponding static pages. Visitor-created entities use IDs at or above 1000 (the shared counter starts at 10000). Increment the storage schema/key and validation deliberately when changing the data structure; reset existing browser data when changing seeds during development.

Event dates are fixed illustrative dates in January/February 2027. Their descriptions explicitly label them fictional showcase events; they are not real bookings. Update the seed dates when refreshing the exhibition content.

## Interactive behavior

The original UI supports feed filters, likes/unlikes, post/comment creation and deletion, post editing, sharing into eligible chats, public follows, private follow requests and approvals, profile edits and privacy changes, local image selection, group discovery/creation/editing, creator request review, invitations, member removal/leaving, events and changeable RSVPs, private/group messages, read history, notifications, and local search.

New entities are visible immediately. Seeded dynamic routes use `generateStaticParams`. Created posts use `/posts/demo/?id=...` and created communities use `/groups/demo/?groupId=...`, including corresponding edit/settings routes. URL helpers are shared by cards, search, notifications, sharing previews, and creation workflows. These detail pages have real exported HTML and survive refresh on a static host. Unknown arbitrary IDs are not generated at runtime.

Earth, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, and Sun use the original model registry, materials, animations, theme tokens, and picker. Earth retains its Moon. Model paths and cover images include the repository prefix. The canvas persists across normal application navigation, respects reduced motion, and has a themed visual fallback when WebGL is unavailable.

## Persistence and reset

Social data is stored only in `spacial-demo:v1`. Malformed or incompatible data falls back to a complete seed. Storage writes catch quota/private-browser errors and show feedback in demo controls. Large selections can exhaust localStorage: demo attachments are limited to **1 MB each**, encoded as local data URLs. No files are uploaded.

**Reset Demo → Restore sample data** removes only `spacial-demo:v1`, restores Nova and the original social dataset, and reloads. It retains unrelated storage and existing appearance preferences. Planet preferences continue using the original application keys:

- `social-network:planet`
- `social-network:planet-model-enabled`
- `social_network_planet_scroll_follow`

The controls remain reachable through the account menu. Changes are local to this browser and never delivered to real people. Clearing browser data removes them.

## Static export and GitHub Pages

Demo builds conditionally enable `output: "export"`, `/Spacial-Network`, trailing slashes, and unoptimized Next images. No `next export` command is used. The output is `frontend/out/`, with `.nojekyll` and all nine GLB files.

Next 16.3's Windows export can emit nested folders for dotted route-segment filenames. The postbuild normalization copies equivalent dotted filenames into the artifact. It is a no-op on platforms already producing dotted files. The static server does not conceal this issue with rewrites.

The `.glb` files are tracked by Git LFS. A regular CI checkout can contain small text pointers beginning with `version https://git-lfs.github.com/spec/v1` instead of model binaries. The shared deployment workflow explicitly runs `git lfs pull` for `frontend/public/models/planets/*.glb`; it fetches only the nine shipped models and leaves the larger source assets under `3d/` alone. It then verifies each model's `glTF` header, GLB version, and byte length before installing dependencies or building. `build:demo` checks both the source files and the exported models. Pointer, missing, or truncated files stop the build with a download command; the browser checks remain enabled.

`.github/workflows/nextjs.yml` handles pushes to `main` and manual runs. It calls the shared `.github/workflows/deploy-livedemo.yml` pipeline, which also handles pushes to `livedemo` directly:

1. Supports `workflow_dispatch` and `workflow_call` in addition to the direct `livedemo` push trigger. The `main` entry calls this same pipeline, so each push starts one deployment.
2. Allows publishing only from `main` and `livedemo` through job conditions.
3. Installs with `npm ci` under `frontend/`, checks TypeScript, lint and local data tests, builds, and runs browser tests against the static export.
4. Uploads `frontend/out/` with `actions/upload-pages-artifact` and deploys with `actions/deploy-pages` to the `github-pages` environment.

It grants `contents: read`, `pages: write`, and `id-token: write`. See [GitHub's custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

After reviewing and approving publication:

1. In repository **Settings → Pages → Build and deployment**, select **GitHub Actions**.
2. In **Settings → Environments → github-pages**, allow the branch you are publishing from: `main`, `livedemo`, or both approved branches.
3. Ensure Actions are enabled and can use the official actions referenced by the workflow.
4. Commit the reviewed changes and push the approved branch. A push to `main` runs `nextjs.yml`; a push to `livedemo` runs `deploy-livedemo.yml`. Both build the frontend in demo mode and publish the static output only.
5. Inspect the build/deploy run, then verify the URL reported by its deployment job. Check a direct profile/group/post link and a model request at the published subpath.

GitHub may only expose manual dispatch in the UI when a workflow is registered on the default branch. In **Actions → Deploy Next.js site to Pages → Run workflow**, choose `main` or `livedemo` with the corrected files committed on that branch.

GitHub's generic Next.js template checks for a root `package.json`, invokes a plain build, and uploads root `out/`. Those assumptions do not match this repository. The replacement `nextjs.yml` delegates to the shared pipeline, which uses `frontend/`, `npm run build:demo`, and `frontend/out/`. Re-running a failed run from an older commit still uses that commit's old workflow. Publish the fix in a new commit and start a new run to use the corrected configuration.

## Limitations and troubleshooting

- Messaging is a local simulation; presence remains offline, and no remote recipients or automatic AI replies are involved. Stored incoming messages/read indicators are sample history.
- Password changes display an honest explanation: demo identities have no credentials. Registration/login routes offer entry to the demo.
- Private groups require invitations, and public group join requests require creator approval. Switch identities to exercise both sides.
- Browser storage is finite and not durable server storage. Refresh loses unsaved changes if storage is blocked/full. Reset demo data if experimenting with many attachments.
- The original nine models total approximately 52 MiB. They load on demand; Moon adds to Earth's first load. Disable 3D in Appearance on constrained devices.
- If navigation logs missing `__next.*.txt` files on Windows, use `npm run build:demo` so its postbuild normalization runs. Upload all of `out/`, including underscore files and `.nojekyll`.
- If a GLB/image requests `/models/...` at the origin root, check the demo base-path environment and rebuild. Do not prepend the prefix to Next `Link` destinations.
- If a model reports `Unexpected token 'v'` or the asset test receives `vers` instead of `glTF`, Git LFS pointers were published. From the repository root run `git lfs pull --include="frontend/public/models/planets/*.glb" --exclude=""`, then rebuild. On CI, the model-download step must precede the build; if LFS reports unavailable objects or quota errors, resolve that download error before retrying. Do not skip the model tests.
- If deployment is rejected, check Pages source, the environment's branch policy, Actions permissions, and that the workflow ref is one of the approved `main` or `livedemo` branches.
- The inherited dependency audit reports six advisories (five high, one critical), including Next.js. The requested Next.js 16.3.2 version is retained; no blanket `npm audit fix` or framework upgrade is applied. No Next server is deployed, but dependency remediation should be reviewed separately before broader full-stack production use. Run `npm audit` to inspect the current advisory details.

## Verification record

Local validation uses the production static export rather than the development server. Automated coverage lives in `frontend/tests/demo.test.mjs` and `frontend/tests/browser/demo.spec.ts`; see `LIVE_DEMO_QA.md` for the completed run's results and evidence.
