# 10 — Documentation & Configuration Review

> All claims in this file were verified directly against current source (not inherited from the Gemini handoff) by reading the actual implementation files and grepping for the relevant symbols. Where a claim originated in the Gemini handoff, that is noted, but every item below was independently re-confirmed during this audit.

---

## 1. Configuration Drift: "Configurable" Backend Origin Is Dead Plumbing

**This is the most significant finding in this file** — a real config defect, not just stale prose, and it is evidenced end-to-end across four files.

- `frontend/src/lib/api.ts:1-6` — the file's own doc comment claims: *"Docker and deployed environments can override these with `NEXT_PUBLIC_BACKEND_ORIGIN` and `NEXT_PUBLIC_BACKEND_WS_ORIGIN`."*
- `frontend/src/lib/api.ts:9-11` — `DEFAULT_BACKEND_ORIGIN` and `cleanOrigin()` are defined but **never referenced anywhere else in the file or codebase** (confirmed via `grep -rn "NEXT_PUBLIC_BACKEND_ORIGIN\|NEXT_PUBLIC_BACKEND_WS_ORIGIN" frontend/src/` → zero matches outside this one comment). Confirmed dead code independently by the frontend lint run (`@typescript-eslint/no-unused-vars` on both symbols).
- `frontend/src/lib/api.ts:25-27, 56-58` — `getBackendBaseUrl()` and `getWebSocketUrl()` **unconditionally** return `` `http://localhost:${BACKEND_PORT}` `` / `` `ws://localhost:${BACKEND_PORT}` ``, with `BACKEND_PORT` a hardcoded `const = 8080`. There is no `process.env.NEXT_PUBLIC_BACKEND_ORIGIN` read anywhere in the function bodies.
- `frontend/Dockerfile:12-18, 29-37` — declares `ARG`/`ENV NEXT_PUBLIC_BACKEND_ORIGIN` and `NEXT_PUBLIC_BACKEND_WS_ORIGIN` at both build and runtime stages, threading them through as if the app consumes them.
- `compose.yaml:15-18` — passes `NEXT_PUBLIC_BACKEND_ORIGIN: http://localhost:8080` and `NEXT_PUBLIC_BACKEND_WS_ORIGIN: ws://localhost:8080` as explicit build args.

**Net effect:** the entire Docker build-arg pipeline for backend origin configuration is inert. It happens to produce a working app today only because the hardcoded fallback in `api.ts` coincidentally matches the default build-arg values. If anyone changes `NEXT_PUBLIC_BACKEND_ORIGIN` in `compose.yaml` or at `docker build --build-arg` time (e.g. to deploy the backend on a different host/port, or behind a reverse proxy), the frontend will silently continue calling `http://localhost:8080` from the browser, which will simply fail to connect in that environment — with no error message pointing at the real cause. This also means the **Docker requirement** ("frontend/backend communication" — see `01_REQUIREMENTS_COMPLIANCE.md`) is only verified to work in the single default configuration, not the configurable one the infrastructure implies.

- Companion finding, backend side: `backend/internal/middleware/cors.go:9-10` hardcodes `Access-Control-Allow-Origin: http://localhost:3000` with **no env var read at all** (no `ARG`/`ENV` plumbing even attempted here, unlike the frontend side). `backend/internal/config/config.go` only reads one environment variable (`SERVER_PORT`); every other `Config` field (`DBDir`, `UploadsDir`, `CookieSecure`, all rate-limit tunables) is a Go literal with zero env-var override path, despite the doc comment on `RateLimit*` fields pointing at a "README.md" for tuning guidance that implies runtime configurability.
- This is self-consistent (frontend hardcodes `:8080`, backend hardcodes `:3000` as the only allowed origin, so the default docker-compose topology works), but it means the project is **not actually deployable to a non-localhost topology without a code change**, despite `Dockerfile`/`compose.yaml` presenting build-time configurability as a real feature.

See `DOC-001` in the issue register. **Recommended fix:** either (a) have `getBackendBaseUrl()`/`getWebSocketUrl()` actually read `process.env.NEXT_PUBLIC_BACKEND_ORIGIN`/`NEXT_PUBLIC_BACKEND_WS_ORIGIN` with the existing hardcoded values as fallback (the dead `DEFAULT_BACKEND_ORIGIN`/`cleanOrigin` helpers look like exactly the removed implementation — restoring their use is likely close to a one-line fix), and give `middleware.CORS` the same treatment via `config.Config`, or (b) remove the unused build-arg plumbing and doc comment entirely and document the project honestly as localhost-only by design. Given the existing dead code is clearly a *partial* removal of a working feature (not a never-finished one), option (a) is almost certainly the smaller, safer change.

---

## 2. Root `README.md` Describes a Codebase That Was Never Built This Way

The root `README.md` (333 lines) is largely an early planning scaffold, not documentation of the current system. Confirmed discrepancies (all independently re-verified against current source, not just inherited from the Gemini handoff):

| README Claim | Actual Current State | Evidence |
|---|---|---|
| Backend entrypoint: `backend/cmd/main.go` (implied by `cmd/\n└── main.go` tree at line ~78) | Actual entrypoint is `backend/cmd/server/main.go`; `cmd/` also contains sibling `cmd/migrate/` and `cmd/seed/` binaries not shown in the README's tree at all | `backend/cmd/` directory listing; `Makefile:4` (`cd backend && go run ./cmd/server/`) agrees with reality, **contradicting the README it sits beside** |
| Migration filenames follow a sequential numeric scheme: `000001_create_users_table.up.sql`, `000002_...` | Actual migrations use a `YYYYMMDDHHMMSS_description` timestamp scheme, e.g. `20260827221112_create_users_table.up.sql` through `20260915130001_create_likes_table.up.sql` (30 pairs total) | `backend/pkg/db/migrations/sqlite/` directory listing |
| Backend package list: `auth, users, followers, posts, comments, groups, events, chat (with websocket.go/hub.go inside it), notifications, middleware` | Actual `internal/` has 17 packages including `likes`, `share`, `search`, `upload`, `ratelimit`, `requestctx`, `router`, `validation` — none listed in the README — and `websocket` is its own top-level package (`internal/websocket/`), not nested inside `chat/`; there is no separate `events` package (event logic lives in `internal/groups/event_handler.go`, `event_service.go`) | `backend/internal/` directory listing |
| Frontend structure: `components/ui/{Button,Input,Modal,Avatar,...}.tsx`, `lib/api/client.ts`, `providers/{AuthProvider,WebSocketProvider,NotificationProvider}.tsx`, feature folders each with flat `api/components/hooks/types` | None of the named `components/ui/*` files exist; the actual API layer is a single `lib/api.ts` plus `lib/websocket/`; actual `components/` only has `feedback/`, `layout/`, `space/`; there is no dedicated `AuthProvider.tsx` file matching that name | `frontend/src/` directory listing |

**Assessment:** this reads as a pre-implementation design sketch (consistent with the four `docs/TODO/0N_*.md` person-checklists, which are structured the same way) that was committed early and never updated as the real architecture diverged from the plan — which is normal for a fast-moving team project, but means **the root README cannot currently be trusted for onboarding** and should be rewritten from the actual current tree (a task explicitly out of scope for this audit — see `12_RECOMMENDED_ACTION_PLAN.md`).

---

## 3. `frontend/README.md` Actively Contradicts Current Behavior (Not Just Outdated — Wrong)

This is worse than simple staleness: it makes specific, falsifiable claims that are directly contradicted by working code.

- **Claim:** *"Group chat remains an existing disabled placeholder."* (`frontend/README.md:35`)
  **Reality:** `frontend/src/features/group-chat/` contains 28 files — `GroupChatShell`, `GroupChatComposer`, `GroupChatTimeline`, hooks for connection/messages/members/autoscroll, transport and data adapters — referenced throughout the groups feature (`grep -rln "group-chat\|GroupChat" frontend/src` → 19 files). Backend support is equally real: `backend/pkg/db/migrations/sqlite/20260909190000_create_group_messages_table.up.sql`, and `chat.Service.RegisterWSRoutes` registers `EventGroupMessage` (`backend/internal/chat/service.go:64`). This is fully built, not a placeholder. **Confirmed independently of the Gemini handoff**, which flagged the same line but this audit re-verified by file count and grep rather than trusting the prior claim.
- **Claim:** *"one shared SVG/CSS space background and one global Earth scene... No page depends on a planet or a 3D transition"* and `src/components/space` is described as *"intentionally dormant model renderer/material helpers"* (`frontend/README.md:3, 18`)
  **Reality:** the 3D-performance subagent's independent review of `frontend/src/components/space/` (see `07_3D_SPACE_PERFORMANCE_REVIEW.md`) confirms an active, fully wired 8-planet + Moon selectable system with dynamic CSS theme injection, mounted on every authenticated route via `AppShell.tsx` → `PlanetBackground.tsx`, plus a planet-staged registration wizard (`RegisterPlanetStage.tsx`). This is the exact opposite of "dormant" or "no page depends on a planet."
- This README appears to date from the `frontend/CLEANUP_REPORT.md` (2026-09-13) cleanup pass, which explicitly stated intent to keep the 3D system "dormant" with no "scene or selection preference... implemented here" (`CLEANUP_REPORT.md` KEEP/REFACTOR table). The 8-planet selection system was evidently built **after** that cleanup and after this README's prose was written, and neither `frontend/README.md` nor `CLEANUP_REPORT.md` was updated to reflect it.
- Also references `npm run test:smoke` as a real, working validation step with a detailed description of what it tests (Playwright/Chromium, real routes, uploads, mobile layouts) — see `08_TESTING_RUNTIME_REVIEW.md` §3, the script's target file does not exist in the repository.

See `DOC-002` in the issue register.

---

## 4. `docs/backend_docs/` Is Systemically Stale, Not Just One File — A New Finding Beyond the Gemini Audit

The Gemini handoff did not flag `docs/backend_docs/*.md` as stale at all (its caveats list only covers `frontend/README.md`, `docs/TEST_AUDIT_REPORT.md`, and the root `README.md`). This audit found that **the detailed, technical, code-referencing docs in `docs/backend_docs/` are themselves significantly out of date**, which is a more dangerous form of drift than the planning-scaffold READMEs above, because these docs are written in a style (file:line citations, mermaid diagrams, "traced this file against X") that reads as authoritative and current, actively inviting a reader (human or AI) to trust them without re-verification — exactly the failure mode this audit was commissioned to guard against.

Verified concretely:

- **`docs/backend_docs/websocket-system.md` §9** is headed *"⚠️ Known gap: Chat's inbound WebSocket events are never registered"* and states in bold: *"live sending currently does not work end to end."* This audit verified directly against current code that this is **false today**: `backend/internal/router/dependencies.go:175` calls `chatService.RegisterWSRoutes(wsRouter)`, and `backend/internal/chat/service.go:62-67` registers all four chat WS event types (`EventPrivateMessage`, `EventGroupMessage`, `EventTyping`, `EventMarkRead`) on the router. The doc's own §12 "Remaining Work" section additionally claims *"no follow/profile-based check before allowing a private message — anyone can currently message anyone"* — also contradicted by current code, where `chat.NewService(...)` takes a `FollowPermissionChecker` (`followersService`) and a `GroupMembershipChecker` (`groupsService`) as constructor dependencies (`backend/internal/chat/service.go:34-58`, wired at `backend/internal/router/dependencies.go:146`). Also claims *"no `group_messages` table, no send/broadcast/history for group conversations"* — contradicted by the migration and code cited in §3 above.
- **`docs/backend_docs/notifications.md:614, 617`** states the `follow_request` and `group_event` notification types have "nobody yet — Follow Requests feature doesn't exist" / "Group Events feature doesn't exist." Verified false: `backend/internal/followers/service.go:101` triggers `notifications.NotificationFollowRequest`, and `backend/internal/groups/event_service.go:64` triggers `notifications.NotificationGroupEvent` on event creation.
- **`docs/TEST_AUDIT_REPORT.md`** (dated 2026-09-06 per its own header, 11 days before this audit) asserts, among many `NOT IMPLEMENTED` rows: Followers ("entire feature absent"), Comments ("no routes, no backend package"), Group Events, Group Posts/Comments, Group Chat, Nickname/About-Me profile fields, post/comment media upload, and — most strikingly — *"Docker | Any Dockerfile/compose present | NOT IMPLEMENTED | none found anywhere in the repo."* All of these are demonstrably implemented in current code (confirmed elsewhere in this audit, and Docker itself was used to run `docker compose config` successfully in `08_TESTING_RUNTIME_REVIEW.md`). This is the same stale document the Gemini handoff flagged, independently re-confirmed here by grep rather than by trusting the prior claim.

**Interpretation:** these documents were clearly written at genuine, distinct milestones early in the project (the websocket doc explicitly says *"the docs are written from reading the current source"* at the time — it was accurate when written) and simply never revisited as the corresponding gaps were closed. None of them carry a "last verified against commit X" marker, so a reader has no signal that they're stale short of independently re-deriving the same conclusions this audit did. See `DOC-003`.

**Recommended fix:** either delete/archive `docs/backend_docs/websocket-system.md` §9/§12, `docs/backend_docs/notifications.md`'s "not yet" rows, and `docs/TEST_AUDIT_REPORT.md` wholesale (labeling it explicitly as a historical snapshot, as the Gemini handoff already suggested), or add a prominent "STALE — see PR #N for the fix" banner. Given how detailed and otherwise well-written these docs are, deleting the stale sections and refreshing them against current code is likely higher-value than discarding them outright.

---

## 5. Missing `.env.example`

`.gitignore` (root) explicitly carves out an exception for it (`!.env.example` under both the root and would-be backend env-ignore blocks), implying one was intended to exist, but `find . -iname ".env*"` returns **zero files** anywhere in the repository. Given `backend/internal/config/config.go` only actually reads one env var (`SERVER_PORT`) and hardcodes everything else (see §1), an `.env.example` would currently be nearly empty and low-value — but its complete absence, combined with the `.gitignore` carve-out, is itself a small signal of drift between intent and reality. Low severity; see `DOC-004`.

## 6. Makefile vs README Consistency

`Makefile` targets (`server`, `migrate`, `seed`, `test`, `frontend`) are accurate and match current entrypoints (`cd backend && go run ./cmd/server/`, matching the real `cmd/server/main.go` path) — the Makefile is **not** stale, only the root `README.md` around it is. This is worth noting positively: a future fix pass can trust the Makefile as ground truth while rewriting the README.

## 7. `docs/` Meta-Documentation Is Healthy

`docs/docs.md` (explaining the purpose of the `docs/` folder itself) and `docs/git-docs/{BRANCHING_STRATEGY,CONVENTIONAL_COMMITS}.md` are process documentation, not implementation claims, and were not evaluated for drift (nothing to drift against). No issues raised against these.

## 8. Root `TODO.md` — A Direct, Reliable Signal Root-Caused Elsewhere In This Audit

Unlike the stale docs above, `TODO.md` at the repo root is a live, informally-written developer task list (with visible typos: "sarch", "anmation", "notfcation") that is the **most reliable, first-party signal** in the repository of known-incomplete work, precisely because it was clearly written by the project's own developer for their own tracking, not generated retrospectively. Two unchecked items are direct corroboration of independently-discovered findings elsewhere in this audit:
- `"privet post is not work there is not selct people so i can add them"` — matches the custom-post-audience-picker defect investigated in `02_FRONTEND_REVIEW.md` / `11_ISSUE_REGISTER.md` (`FE-` series).
- `"remove saction info from the stings"` (likely "session" info from settings) — an explicit, still-open cleanup item; see `09_CODE_QUALITY_TECH_DEBT.md`.
- `"make anmation to change planit"` — confirms the planet-switch transition is known-unfinished/unpolished by the developer's own admission, corroborating (not contradicting) the 3D review's findings.

This file should be treated as ground truth for "known, developer-acknowledged gaps" ahead of any of the stale docs above.
