# 07 — 3D/Space System & Performance Review

> Scope: `frontend/src/components/space/`, `frontend/public/models/`, top-level `3d/` (tooling, not shipped), `frontend/MODEL_ASSETS.md`, `docs/3d-model-optimization-report.md`. Method: full reads of every file in `frontend/src/components/space/`, the planet-preference provider, both shells that mount it, both auth-stage consumers, and the relevant `@react-three/drei` source to confirm cache semantics — not assumptions from library familiarity.

## Overall Assessment

The space/3D layer is **materially better engineered than a typical first pass**: `frameloop="demand"` with a hand-rolled FPS governor that pauses entirely while the tab is hidden, `useFrame` loops that mutate refs (never React state, so the 50fps-capped loop never triggers a React re-render), a full unmount (not CSS-hide) when the 3D setting is off, centralized `localStorage` access, and disposal code that correctly distinguishes shared-cache ownership from per-instance ownership. The real, substantive findings are: (1) the Canvas/Three.js bundle isn't code-split away from every authenticated route, (2) the GLTF cache has no eviction, and (3) the supporting documentation (`MODEL_ASSETS.md`, the optimization report) has drifted from the current working tree in specific, verifiable ways.

**The prior audit's "purged legacy 3D code" claim is confirmed TRUE**, with a caveat about stale supporting docs (see §6).

---

## 1. Model Loading

**No duplicate network loads on planet switch (Info, positive).** `useGLTF` (drei) backs onto a global, path-keyed Suspense cache. `PlanetBackground.tsx` uses a two-stage pattern: `PlanetAssetGate` loads the newly-selected planet's model in the background while the `<Canvas>` keeps rendering the *previously displayed* planet until the new one is confirmed ready, then swaps. Both calls resolve against the same cache key, so the swap is a cache hit, not a second fetch — no pop-in, no flash of an untextured planet. Documented accurately in the component's own README, which matches the code.

**Suspense/fallback is correctly scoped**: the Moon companion has its own nested `<Suspense>` + error boundary, so a Moon load/render failure can't take down the primary planet. `fallback={null}` is intentional (the previous body stays visible during a swap), not an oversight.

### 3D-001 — `PlanetBackground`/`<Canvas>` is not behind `next/dynamic(ssr:false)`; three.js/R3F/drei ship in every authenticated route's bundle

**Severity:** Medium · **Confidence:** High

`(main)/layout.tsx` → `AppShell.tsx` → `PlanetBackground.tsx` statically imports `@react-three/drei`/`@react-three/fiber` (which transitively pull in `three`) at module top level. A repo-wide grep for `next/dynamic` returns **zero hits** anywhere near the space/planet code — there is no `dynamic(() => import(...), { ssr: false })` boundary at all. Because `(main)/layout.tsx` wraps every authenticated route, three.js/R3F/drei ship as part of the JS required to hydrate every one of those routes, including ones with no 3D content of their own (a settings sub-page, a plain message thread). **Mitigating factor:** the actual GLB network fetch is still deferred behind a client-only readiness gate, and `frameloop="demand"` means no wasted render-loop CPU before content is visible — the problem is specifically the *library code*, not the model bytes, in the eagerly-loaded bundle. **Fix:** wrap `PlanetBackground` (and the two `PlanetScene` usages in the login/register planet stages) in `next/dynamic(..., { ssr: false, loading: () => null })` — the component already self-gates on client-readiness, so this is a no-behavior-change fix.

## 2. Memory & Disposal

**Correctly scoped, verified by tracing ownership, not assumed (Info, positive).** Earth's material/texture handling clones two source meshes and builds new material instances, disposing exactly the materials it created on cleanup — but deliberately **not** the underlying textures, which are owned by the shared `useGLTF` cache (disposing them here would corrupt the cache for the next mount; confirmed this is intentional by tracing texture origin). Generic planets follow the identical shared-vs-owned pattern for material clones (Saturn's rings, Jupiter/Sun emissive tuning). `dispose={null}` on the outer `<group>` in both components is the correct drei/R3F idiom for a scene cloned from a shared cache — flagged explicitly here because a less careful audit might (wrongly) read `dispose={null}` itself as evidence of a leak; it is the opposite.

**Event listeners / rAF loops: all cleaned up correctly.** Every rAF loop and `window`/`matchMedia`/scroll listener found in the space directory (hydration rAF, scroll-follow rAF, the render-loop governor, viewport `matchMedia` listeners, reduced-motion listener) has a matching `cancelAnimationFrame`/`removeEventListener` in its effect cleanup. No leaked listeners or orphaned rAF loops found anywhere.

**Tab-hidden / reduced-motion behavior — a standout positive finding.** The render-loop governor calls R3F's `invalidate()` at a capped ~50fps but **skips invalidation entirely while `document.hidden`**, and installs no loop at all when reduced-motion is active (invalidates exactly once). Confirmed by reading the code: the render loop does **not** burn GPU/CPU while the tab is backgrounded, directly answering (and ruling out) the audit brief's stated concern about hidden-tab resource burn.

**Toggling "3D model" off is a genuine unmount, not a CSS-hide fallback** — verified at both mounting sites (`AppShell.tsx`, `GroupSettingsShell.tsx`), both conditionally *render* (not conditionally *style*) the component. No `display:none`/`visibility:hidden` fallback path exists in the stylesheet.

### 3D-002 — No GLTF cache eviction; cycling through planets pins all loaded assets in GPU memory for the session

**Severity:** Medium · **Confidence:** High

`useGLTF.clear()` exists in the installed drei version but a repo-wide grep for `useGLTF.clear`/`useLoader.clear`/`.preload(` returns **zero hits**. Once a planet's GLB is loaded (e.g. by browsing the Settings planet picker, which mounts a live preview per selection), its decoded geometry and GPU-uploaded textures stay resident in the shared cache for the rest of the session, even though only one planet is ever displayed at a time. This is **bounded** (9 GLBs, ~52MB total — see §7), not unbounded, so it does not rise to "leak," but it is a real, avoidable footprint. `docs/3d-model-optimization-report.md` itself already lists this exact fix ("call `useGLTF.clear()` when navigating away") as an unimplemented recommendation — consistent with what the code shows. **Fix:** call `useGLTF.clear(path)` for the previously-displayed planet once a swap completes.

## 3. Registry Consistency — clean, 1:1, no drift (Info, positive)

Full read of the 354-line registry cross-checked against `find frontend/public/models -type f`: exactly 9 files present (8 planets + Moon companion), every registry `modelPath` resolves to a real file, zero dead assets, zero missing files. The "8 planets + Moon" claim is confirmed exactly true (`PLANET_REGISTRY` has exactly 8 keys, `SELECTABLE_PLANETS` lists the same 8, `MOON_MODEL` is a separate non-selectable companion wired only to Earth). No Neptune model or placeholder exists anywhere, consistent with the project's own asset documentation.

## 4. Settings & Persistence

**Storage is correctly centralized** — all raw `localStorage` access happens in exactly one file (`PlanetPreferenceProvider.tsx`, 8 call sites); every consumer goes through the shared context, never touching `localStorage` directly. Cross-tab sync via a `storage` event listener is correctly implemented and cleaned up, including a legacy-value migration path for an older storage scheme.

### 3D-005 — Naming-convention inconsistency across the three localStorage keys

**Severity:** Low · **Confidence:** High

Two keys use a colon-namespaced style (`social-network:planet`, `social-network:planet-model-enabled`); the third uses snake_case with no namespace separator (`social_network_planet_scroll_follow`). Functionally harmless (each is a single well-defined constant used from one place), but suggests the scroll-follow preference was added later without matching the established convention. **Fix:** align to `social-network:planet-scroll-follow` via a one-time migration read of the old key (the codebase already has a working example of exactly this pattern for its `legacyNone` migration).

## 5. Mobile/Responsive Handling

Viewport classification (`desktop|tablet|mobile`) correctly uses `matchMedia` + `useSyncExternalStore`, reactive to runtime resizing, correctly torn down on unmount. Per-planet responsive scaling (`scaleMultiplier`/`positionOffset` per viewport tier) is content-side transform scaling rather than camera repositioning — a sound, simple approach.

### 3D-004 — Inconsistent mobile gating between the main app and the auth onboarding stages

**Severity:** Low · **Confidence:** High

`PlanetBackground` (used by the main authenticated app) has no viewport check at all — it renders the full `<Canvas>` on mobile too, just scaled down. `LoginPlanetStage`/`RegisterPlanetStage` explicitly skip the Canvas on mobile and show a CSS orb fallback instead. This may be a deliberate choice (cheap/fast onboarding vs. a persistent background users have already opted into), but nothing in the code explains the asymmetry, and it means mobile users pay the WebGL context + GLB download cost on every authenticated page that mobile users on `/login`/`/register` are spared. Worth an explicit product/perf decision either way.

## 6. Legacy/Dead Code Verification

**Verdict: the prior audit's "purged legacy 3D code" claim is TRUE**, re-verified against the current working tree rather than trusted. `grep -rn "solar-system\|universe-home"` across `frontend/src` → 0 hits; `find frontend/src/{app,features}` → no `solar-system`/`universe-home` directories exist anywhere. Same for black-hole: 0 references anywhere in `frontend/src`, and `modelsRegistry.ts` has no black-hole entry in any registry list.

**However — a genuine new finding, not a re-confirmation:** the prior audit described `3d/black-hole-final.glb` as tooling output "excluded from the active registry." True of the registry — but `frontend/MODEL_ASSETS.md` currently lists a `public/models/planets/black-hole-final.glb` entry as one of "10 files, 55.74 MiB" of "preserved public models." That file **does not exist** — `frontend/public/models/planets/` has exactly 9 files, not 10. So the asset-inventory doc itself documents a shipped public asset that isn't actually shipped, a distinct drift from the registry question. Likely explanation: an earlier pass copied the file into `public/` and the doc was written against that state; the file was later removed without regenerating the doc. See `DOC-005`.

**Second, related doc-drift finding:** `docs/3d-model-optimization-report.md` references a `frontend/src/app/(main)/dev/3d/` route that does not exist in the current tree — either an undocumented later cleanup, or the report describes a branch/state not reflected in current code. Another instance of a support doc no longer matching the working tree. See `DOC-005`.

**Trivial:** `3d/plnt` (not `3d/plant`) is an empty, zero-byte directory alongside the real `3d/plant/` — almost certainly a typo artifact from directory creation. Zero performance impact.

## 7. Asset Sizes

```
du -sh frontend/public/models   → 52M   (shipped to browsers)
du -sh 3d                       → 491M  (tooling/staging assets, NOT shipped)
```

Per-file breakdown of what's actually served: `earth-final.glb` 3.8MB, `jupiter-final.glb` 9.3MB, `mars-final.glb` 5.3MB, `mercury-final.glb` 5.6MB, **`moon-final.glb` 11MB**, `saturn-final.glb` 2.8MB, `sun-final.glb` 2.0MB, `uranus-final.glb` 6.2MB, `venus-final.glb` 6.1MB.

### 3D-003 — `moon-final.glb` (11MB) is the one shipped asset over the 10MB flag threshold

**Severity:** Low · **Confidence:** High

Flagged per this audit's explicit threshold, but this is a **known, documented tradeoff**, not an overlooked regression: the Moon is a companion asset that only loads when Earth is selected, loads through the same Suspense/error-boundary-isolated path as everything else (a slow Moon load never blocks Earth), and `docs/3d-model-optimization-report.md` already documents why it's this large (a prior mesh-simplification pass to 179,976 triangles, texture resolution preserved by design) and explicitly lists further mesh-decimation as out of scope. Jupiter (9.3MB) is the runner-up, worth watching if it grows further.

### DOC-005 — Doc-vs-disk size drift on `MODEL_ASSETS.md`

**Severity:** Info · **Confidence:** High

`MODEL_ASSETS.md` claims `earth-final.glb` is 5.96 MiB and `saturn-final.glb` is 2.91 MiB; actual current sizes are 3.8MB and 2.8MB respectively (all other 7 files match the doc exactly). Earth was evidently re-optimized/replaced after the doc was last generated (a *good* outcome — smaller asset — just undocumented). Combined with the phantom black-hole entry (§6), `MODEL_ASSETS.md` should not be cited for exact figures without re-verifying against `du`/`ls` first. See `10_DOCUMENTATION_CONFIG_REVIEW.md`.

**`3d/` (491MB, not shipped)** is dominated by raw/uncompressed source exports (`3d/plant/`, 367MB) plus several large standalone originals. None of it reaches the browser (confirmed: only `frontend/public/models/planets/*.glb` exists under the served `public/` tree) — a `git`-repo-size/hygiene concern, not a page-load performance concern. `MODEL_ASSETS.md` already documents exact-duplicate groups within it worth deleting, with the deletion decision explicitly deferred to the asset owner as of its last revision.

## 8. General Perf Smells (quick pass, beyond the main frontend review's scope)

**Context memoization — correct, not a smell (Info, positive).** `PlanetPreferenceProvider`'s context value is built with a complete, correct `useMemo` dependency array, and every setter is `useCallback`-stabilized — the value object is not recreated on every render, so its four consumers (`AppShell`, `GroupSettingsShell`, `AppearanceSettings`, both auth stages) only re-render on genuine preference changes, not every animation frame. Verified this matters here specifically since a naive unmemoized context value would have caused app-wide re-renders on every provider re-render.

**No React state touched inside any `useFrame` callback** anywhere in the motion-control code — all four motion components mutate `group.position`/`group.rotation`/refs directly; scroll rotation is threaded as a plain ref, never state. This is exactly right — it's what keeps the 50fps-capped render loop from ever triggering a React re-render.

The starfield background (`SpaceBackground`) is pure SVG+CSS, star geometry computed once at module load and batched into ≤50 SVG path nodes (not thousands of individual elements), no WebGL context, no per-frame JS. Both `SpaceBackground` and `PlanetBackground` are wrapped in `memo()`.

---

## Summary Table

| ID | Finding | Severity |
|---|---|---|
| 3D-001 | `PlanetBackground`/Canvas not behind `next/dynamic(ssr:false)`; three.js/R3F/drei ship on every authenticated route | Medium |
| 3D-002 | No `useGLTF.clear()`/eviction; cycling planets pins all loaded assets in GPU memory (bounded, ~52MB) | Medium |
| 3D-003 | `moon-final.glb` (11MB) exceeds the 10MB flag threshold — documented, deliberate tradeoff | Low |
| 3D-004 | Main app renders 3D Canvas on mobile; auth stages skip it — undocumented inconsistency | Low |
| 3D-005 | Three localStorage keys use two different naming conventions | Low |
| DOC-005 | `MODEL_ASSETS.md`/optimization report reference a phantom asset, a removed dev route, and stale sizes | Info |
| — | "Purged legacy 3D code" (solar-system/universe-home/black-hole) — **confirmed TRUE**, registry↔disk 100% consistent (9/9) | Info (positive) |
| — | Disposal, listener cleanup, tab-hidden/reduced-motion render pausing, context memoization — all verified correct | Info (positive) |
