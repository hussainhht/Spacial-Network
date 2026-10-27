# Live demo verification

Verified locally on **27 October 2026**, on `livedemo`. No commit, push, GitHub settings change, or deployment was performed.

## Environment and results

Windows, Node.js 22.19.0, Next.js 16.3.2, React 19.2.8, and Playwright 1.64.1 with headless Chromium 156 and software WebGL.

| Check | Result |
| --- | --- |
| Initial repository inspection | Clean working tree; existing `livedemo` branch selected |
| `npm ci` | Passed with the npm lockfile |
| `npm run typecheck` | Passed; generates Next route types before checking |
| `npm run lint` | Passed with no errors or warnings |
| `npm run test:demo` | **9 passed** |
| `npm run build -- --webpack` with demo disabled | Passed; ordinary full-stack build retained |
| `npm run build:demo` | Passed; **113 HTML files** in `frontend/out/` |
| `npm run test:demo:browser` against the static export | **19 passed**, final complete run approximately 5 minutes |
| Workflow syntax/configuration | YAML parsed; demo-branch conditions and `frontend/out` artifact path checked |
| `git diff --check` | Passed |
| Backend changes | None |

The browser suite uses `scripts/serve-demo.mjs` at `http://127.0.0.1:3000/Spacial-Network/`. This server serves files only and returns 404 for missing paths. No development server or SPA fallback was used as evidence for static hosting compatibility.

## Browser coverage

The final 19 checks cover:

1. Automatic demo entry, populated feed, Following/Friends filters, likes, comments, and reload persistence.
2. Follow/unfollow, private-profile requests, switching identities, accepting a request, and access after approval.
3. Creating, editing, opening, and refreshing a visitor-created post through a query-based detail route.
4. Group discovery, member tabs, events, RSVP changes, and persistent group chat.
5. Persistent private messaging, notification read counts, local search, and no-result states.
6. All eight real planetary models, Earth's Moon, accent variables, stored selection, reduced motion, and the 3D off switch.
7. Network/console inspection across Home, profiles, posts, groups, standalone group settings, chat, notifications, and settings: **no backend requests, WebSocket connections, missing assets, external runtime requests, browser exceptions, or console errors observed**.
8–11. Desktop (1440×1000), laptop (1280×800), tablet (820×1180), and mobile (390×844): no horizontal overflow; navigation links work.
12. Scoped reset, unrelated preference retention, and malformed browser-storage recovery.
13. WebGL-unavailable fallback and usable social content.
14. Missing IDs on query-based detail routes produce explanatory states without browser exceptions.
15. Creator approval of a member request via its deep link, and acceptance of a private-community invitation.
16. Visitor-created community routes, refresh, and creator editing.
17. Profile biography edits, local avatar selection, sharing, and the resulting private-chat post preview.
18. HTTP verification of every seeded profile, post, post edit, group, group settings, standard application route, query-route entry point, `.nojekyll`, and all nine GLB files. All requested files returned 200; GLB headers contain the expected `glTF` magic bytes.
19. Private-account recommendations show **Requested**, retain that state after reload, and agree with the target profile.

The nine data tests independently cover reference integrity, unique notification IDs, stored-data validation, feed scopes, private follows, audience restrictions, likes/comments/post creation, group permissions, invitations, RSVP, message transport, read state, notification/search behavior, reset scope, and group-deletion cascades.

## Visual evidence

The suite saves screenshots to the ignored `frontend/test-results/` directory:

- `demo-desktop.png`, `demo-laptop.png`, `demo-tablet.png`, `demo-mobile.png`
- `planet-earth.png`, `planet-mercury.png`, `planet-venus.png`, `planet-mars.png`, `planet-jupiter.png`, `planet-saturn.png`, `planet-uranus.png`, `planet-sun.png`

Earth, Saturn, Sun, and the mobile layout were visually inspected. The screenshots show real textured models, Saturn's rings, changing accents, and the preserved application interface. Model loading was checked through successful requests and rendered screenshots, in addition to canvas presence. Reduced motion is enabled for settled, repeatable screenshots; earlier interaction runs also used normal motion.

Browser contexts are isolated between tests. Screenshots are regenerated on the next run. Tests emulate viewport sizes in Chromium; physical mobile devices and Safari/Firefox were not tested.

## Important implementation files

| Area | Files |
| --- | --- |
| Demo services and data | `frontend/src/demo/{config,seed,store,api}.ts` |
| Demo controls and entry | `frontend/src/demo/DemoControls.tsx`, its CSS Module, `DemoEntry.tsx` |
| REST/identity boundary | `frontend/src/lib/api/client.ts`, `lib/api.ts`, profile/groups/search/auth feature clients, login/logout clients |
| Local messaging transport | `frontend/src/providers/WebSocketProvider.tsx` |
| Existing UI integration | Navbar, recommendation states, settings explanation, post/group/search/notification URL helpers |
| Static routes | Existing profile/group/settings pages; server wrappers plus `PostDetailClient.tsx` and `PostEditClient.tsx` |
| Asset compatibility | `modelsRegistry.ts`, group/event cover registries, avatar/image helpers, WebGL fallback |
| Local artwork | `frontend/public/demo/avatars/1.svg` through `16.svg` |
| Build and serving | `frontend/next.config.ts`, `package.json`, `package-lock.json`, `frontend/scripts/` |
| Automated QA | `frontend/tests/`, `frontend/playwright.config.ts` |
| Publishing | `.github/workflows/deploy-livedemo.yml` |
| Usage/deployment instructions | `LIVE_DEMO.md`; concise root README addition |

The original AppShell, primary navigation, current-user context, profile/feed/group/chat components, planet preference provider, planet system/model/material implementation, and original model binaries remain in use.

## Remaining publication and maintenance work

- Publication awaits owner approval. Configure Pages to use **GitHub Actions**, restrict the `github-pages` environment to `livedemo`, and then push the reviewed branch. Remote permissions, Actions execution, and the intended public URL have not been verified by a deployment.
- `npm audit` reports **six inherited advisories: five high and one critical**, including Next.js. The installed Next.js version was retained as requested. This audit result is not hidden by the passing build/tests; review dependency remediation separately.
- Messaging, presence/history, privacy rules, and notifications are local simulations. The demo has no real account credentials or remote delivery. Attachments are limited to 1 MB each and localStorage capacity; appearance preferences are retained by Reset Demo. See `LIVE_DEMO.md` for the full limitations and troubleshooting guide.
