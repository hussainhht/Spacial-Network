# Social Network — Agent Guidelines & Rules

## 1. Strict Git Restriction

Agents working in this repository are strictly prohibited from modifying git state or repository history.

- **DO NOT RUN**:
  - `git commit`
  - `git push`
  - `git pull`
  - `git merge`
  - `git rebase`
  - `git reset`
  - `git restore`
  - `git checkout`
  - `git switch`
  - `git stash`
  - `git cherry-pick`
- **Permitted Read-Only Git Commands**:
  - `git status`
  - `git diff`

---

## 2. Reusability First (Search Before Building)

Before introducing new components, background systems, or utilities, always search the codebase to reuse existing implementations:

- **3D Universe & Planet Models**: Inspect `frontend/src/components/space/` (`modelsRegistry.ts`, `DevPlanetModel.tsx`, `Earth3D.tsx`, `SpaceBackground.tsx`).
- **Universe Transitions**: Inspect `frontend/src/features/universe-transition/` (`UniverseTransitionProvider.tsx`, `UniverseTransitionLayer.tsx`, `animation.ts`).
- **Layout & Navigation**: Inspect `frontend/src/components/layout/` (`AppShell.tsx`, `TopNavbar.tsx`, `AppSidebar.tsx`).
- **Realtime / Notifications**: Inspect `frontend/src/features/notifications/` and `frontend/src/features/chat/hooks/useChat.ts`.
- **Backend Architecture**: Go backend with SQLite lives in `backend/internal/`. Respect service boundaries.

---

## 3. Project Skills

Specialized skills are available under `.agents/skills/`:

- `universe-architecture`: Rules for the 3D planet navigation experience, transform hierarchy, and Earth-Moon system.
- `threejs-r3f`: Three.js / React Three Fiber scene rules, GLTF handling, zero-allocation render loops, and material lifecycle.
- `gsap-motion`: GSAP, ScrollTrigger horizontal scrubbing, animation lifecycle cleanup (`gsap.context`), and reduced motion.
- `nextjs-transitions`: Next.js App Router persistent transitions, canvas host reparenting, and phased navigation.
- `frontend-space-design`: Premium dark space aesthetic, glassmorphism, subtle UI, typography, and responsive rules.
- `performance-debugging`: Diagnostic checklists for WebGL, 60 FPS profiling, memory leak detection, and jitter resolution.
- `social-network-project`: Comprehensive codebase map, component registry, and workflow boundaries.
