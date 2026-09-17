# Social Network — Project History & Evolution

This document reconstructs the complete engineering journey of the Social Network project from its initial Git commit on August 20, 2026 to its current state on September 17, 2026. It documents the real development phases, architectural transitions, design reversals, abandoned concepts, and the lessons learned by the engineering team.

---

## 1. History Methodology & Data Sources

The findings below are reconstructed strictly from primary historical sources:

- **Git Commit Log:** 504 commits spanning 52 branches across 4 primary contributors.
- **Git Tags & Merges:** 73 pull request merge commits onto `main`.
- **Master Timeline CSV:** `docs/social_network_master_timeline.csv` (the team's 3-week planning matrix).
- **Team TODO Checklists:** `docs/TODO/01_leader_groups_events.md` through `04_websocket_chat_notifications.md`.
- **Architectural Cleanup Reports:** `frontend/CLEANUP_REPORT.md` and `docs/3d-model-optimization-report.md`.
- **Historical Audit Reports:** `docs/TEST_AUDIT_REPORT.md`.

---

## 2. Team Structure & Feature Ownership

The project was executed by a collaborative 4-person engineering team with clear domain boundaries, coordinated under a 3-day pull-request checkpoint rule:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   TEAM ROLES & CORE FEATURE DOMAINS                    │
├───────────────────┬────────────────────────────────────────────────────┤
│ Person 1 (Leader) │ Groups, Group Events, Settings UI, 3D Planet Stage │
│ (hussainali7)     │ Integration, Multi-Step Auth Wizard                │
├───────────────────┼────────────────────────────────────────────────────┤
│ Person 2          │ Posts, Comments, Media Uploads, Rate Limiting,     │
│ (sayedssharaf)    │ Docker Orchestration, Error Pages                  │
├───────────────────┼────────────────────────────────────────────────────┤
│ Person 3          │ Profiles, Privacy Rules, Followers, Universal      │
│ (Bader Alafoo)    │ Search, Recommendations, Infinite Cursor Feed      │
├───────────────────┼────────────────────────────────────────────────────┤
│ Person 4          │ WebSockets, Realtime Hub, Private & Group Chat,    │
│ (ahmedhasan1)     │ Notifications, Likes & Share Interaction System    │
└───────────────────┴────────────────────────────────────────────────────┘
```

---

## 3. Timeline Overview

```mermaid
timeline
    title Social Network Development Trajectory (2026)
    section Phase 1 : Foundations
        Aug 20 : Repo inception & scaffolding
        Aug 24 : Auth & bcrypt session tokens
        Aug 26 : SQLite migration engine & Clean Architecture
    section Phase 2 : Primitives
        Aug 28 : WebSocket multiplexing core
        Aug 29 : Private messages & Groups schema
    section Phase 3 : Feature Sprints
        Sep 02 : Posts & Comments tables
        Sep 04 : Profile privacy & Group invitations
        Sep 06 : Followers & Group Events tables
    section Phase 4 : Convergence
        Sep 08 : Follow request flows
        Sep 09 : Post visibility (custom viewers) & Group post unification
        Sep 11 : Profile biographical extra fields
    section Phase 5 : Hardening
        Sep 12 : Two-tier token bucket rate limiting
        Sep 13 : Major frontend architectural purge (Solar System removed)
        Sep 14 : Group privacy (public approval vs private invite-only)
    section Phase 6 : Polish & 3D
        Sep 15 : Likes & Share via chat, Infinite feed, 8-Planet registry
        Sep 16 : Notification toasts & Mark All Read, Universal search
        Sep 16 : Multi-step registration & login 3D planet stages
```

---

## 4. Chronological Development Phases

### Phase 1 — Inception & Architecture Foundations (Aug 20 – Aug 27, 2026)

- **Goal:** Establish reliable database migration engine, server scaffolding, secure authentication, and Next.js frontend base.
- **Representative Commits:**
  - `3b65dc6` (_HUSSAIN ALI_): Initial commit `start social-network first day`.
  - `024326f` (_hussainali7_): Add initial backend structure with database migrations and user table schema.
  - `9c880f0` (_ahmedhasan1_): Configured register, login, sessions and cookies, uuid, password hashing (bcrypt), and logout.
  - `cea8938` (_hussainali7_): Initialize frontend with Next.js 16, Tailwind CSS 4, and TypeScript.
  - `6c1a791` (_hussainali7_): Implement SQLite migration system with up/down functionality and schema management.
  - `7472713` (_hussainali7_): Refactor session management into Repository and Service layers.
  - `32c14d3` (_hussainali7_): Add profile photo upload with server-side magic byte sniffing (`http.DetectContentType`).
- **Architectural Significance:**
  The team avoided monolithic Go handlers early on by establishing a strict three-layer architecture (`Handler` -> `Service` -> `Repository`) across all packages. Crucially, the custom SQLite migration runner (`pkg/db/sqlite`) with Go standard `embed.FS` was created here, giving the team transactional database migrations from week one.

### Phase 2 — Realtime Infrastructure & Social Primitives (Aug 28 – Sep 01, 2026)

- **Goal:** Implement the multiplexed WebSocket connection and early schema for private messages and groups.
- **Representative Commits:**
  - `20260829145858`: Migration creating `private_message` table.
  - `20260829174143`: Migration creating `groups` table.
  - `20260829174536`: Migration creating `group_members` table.
- **Architectural Significance:**
  Rather than spinning up separate socket connections per feature, the team decided on a single, long-lived multiplexed WebSocket endpoint (`/api/ws`) managed by a central `Hub`. Inbound frames were routed via a dedicated `websocket.Router`.

### Phase 3 — Core Social Dynamics & Parallel Feature Sprints (Sep 02 – Sep 07, 2026)

- **Goal:** Unblock the primary social feature set: Posts, Comments, Notifications, Followers, and Group Events.
- **Representative Commits:**
  - `20260902120000`: Migration creating `posts` table.
  - `20260903211849`: Migration creating `notifications` table.
  - `20260904135443`: Migration creating `group_invitations` and `group_join_requests` tables.
  - `20260904180906`: Migration adding `is_private` boolean to `users` table.
  - `20260905190457`: Migration creating `comments` table with image attachment support.
  - `20260906173721`: Migration creating `followers` table.
  - `20260906220800`: Migration creating `events` and `event_responses` tables.
  - `20260907012822`: Migration adding `group_photo` to groups.
- **Architectural Significance:**
  All four team members worked simultaneously across their assigned packages. The team adhered to the Master Timeline dependency gates: follower primitives were prioritized to unblock post privacy and messaging permissions.

### Phase 4 — Privacy Refinement & Cross-Feature Convergence (Sep 08 – Sep 11, 2026)

- **Goal:** Resolve cross-boundary dependencies and upgrade privacy semantics from binary public/private to multi-tiered access models.
- **Representative Commits:**
  - `20260908144443`: Migration creating `follow_requests` table.
  - `20260909120000`: Migration upgrading posts table to three-tier visibility (`public`, `followers`, `custom`).
  - `20260909120001`: Migration creating `post_allowed_viewers` table.
  - `20260909180000`: Migration adding `group_id` foreign key to `posts` table (**Major Architectural Decision**).
  - `20260909190000`: Migration creating `group_messages` table.
  - `20260911163505`: Migration adding `nickname`, `about_me`, and `date_of_birth` to `users`.
- **Architectural Significance:**
  Initial planning documents (`schema.dbml`) proposed isolated `group_posts` and `group_comments` tables. In Phase 4, the team discarded this duplicate schema and unified all posts into the main `posts` table using an optional `group_id` nullable foreign key. This allowed feed queries, media storage, comments, and moderation to reuse identical logic.

### Phase 5 — System Hardening, Rate Limiting & 3D Asset Optimization (Sep 12 – Sep 14, 2026)

- **Goal:** Protect the application against abuse, eliminate frontend architectural bloat, optimize 3D assets, and formalize group privacy.
- **Representative Commits:**
  - `20260914203241`: Migration adding `privacy` enum (`public`, `private`) to groups.
  - `d8b7276` (_sayedssharaf_): Implement two-tier token bucket rate limiter for HTTP and WebSockets.
  - `05f4a93` (_Bader Alafoo_): Complete purge of experimental solar-system canvas, universe timelines, and GSAP dependency.
  - Optimization scripts in `3d/`: `optimize-earth.sh`, `optimize-saturn.sh`, `optimize-black-hole.sh`.
- **Architectural Significance:**
  1. **Rate Limiting:** Built completely in-house without third-party Redis or frameworks using Go stdlib. Enforces a global cap (burst 30, refill 10 req/s, 30s penalty) and per-endpoint cap (burst 10, refill 3 req/s, 15s penalty), including WebSocket chat frame throttling.
  2. **Frontend Simplification:** The team audited the frontend and deleted over 60 files belonging to an abandoned "Solar System / Universe Transition" concept that had intercepted page routing and broken standard browser navigation.

### Phase 6 — Interactions, Polish, Modern 3D & Final Integration (Sep 15 – Sep 16, 2026)

- **Goal:** Deliver rich user interactions, social recommendation engines, dynamic planet themes, and polished responsive UI.
- **Representative Commits:**
  - `20260915120000`: Migration creating `post_media` multi-attachment table.
  - `20260915130000`: Migration adding `image_path` to `events`.
  - `20260915130001`: Migration creating `likes` table.
  - `ff3d2d3` (_hussainali7_): Merge branch `feat/likes-&-share`.
  - `6ceca37` (_Bader Alafoo_): Add repeat-safe bulk database seeder (`cmd/seed`).
  - `8a53056` (_Bader Alafoo_): Cursor-based infinite feed pagination with sticky filters.
  - `568084d` (_Bader Alafoo_): Personalized follow recommendations (`WhoToFollow`).
  - `f12311f` (_Bader Alafoo_): Suggested group recommendations (`SuggestedGroups`).
  - `99ba50d` (_hussainali7_): Modern `PlanetSystem` with dynamic lighting, responsive camera compositions, and 8-planet registry.
  - `a1c23c7` (_ahmedhasan1_): Add "Mark all as read" endpoint and dropdown UI action.
  - `624a7d1` (_ahmedhasan1_): Real-time floating notification toasts.
  - `77491a6` (_hussainali7_): Refactor SettingsPage into segmented views (Profile, Privacy/Security, Appearance, Session).
  - `a8bf882` (_hussainali7_): Implement multi-step registration wizard with interactive 3D planet stages.
  - `0fa6276` (_hussainali7_): Implement login page with 3D planet stage.

---

## 5. Major Architectural Decisions & Transitions

### Transition A: Schema Normalization & Group Post Unification

- **Original Plan (`schema.dbml`):** Four separate tables: `group_posts`, `group_post_media`, `group_comments`, and `group_comment_media`.
- **Adopted Implementation:** Added `group_id INTEGER REFERENCES groups(id) ON DELETE CASCADE` directly to the primary `posts` table.
- **Why It Mattered:** Prevented massive code duplication. Likes, comments, media attachments, and feed access rules work transparently across both personal and group posts with single unified services.

### Transition B: 3D Experience — From Route Interception to Decoupled Ambient System

- **Original Concept (`features/solar-system/`, `features/universe-home/`):**
  A 3D solar system canvas that took over page routing. Clicking a navigation item initiated camera fly-through transitions via GSAP timelines, blocking DOM rendering until the animation finished.
- **The Breakdown:**
  High complexity, fragile canvas reparenting, broken deep links, severe mobile performance degradation, and 14 lint errors / state bugs.
- **The Purge (Sep 13, 2026):** Deleted 64 files, removed GSAP from dependencies, and restored standard Next.js App Router navigation.
- **The Rebirth (Sep 15–16, 2026):**
  Re-implemented 3D as a non-blocking background layer (`PlanetBackground.tsx`). Added an 8-planet model registry (`modelsRegistry.ts`), user preference storage in `localStorage`, cross-tab synchronization, responsive scale/offsets, and dynamic CSS variable injection (`--planet-accent`) that re-skins the entire application.

### Transition C: In-App Post Sharing via Chat

- **Design Decision:** Instead of a simple "copy link to clipboard" or an isolated feed re-share table, sharing was integrated directly into the chat system (`share.Service` delegating to `chat.Service`).
- **Mechanism:** Sharing a post sends a private message or group message containing the post URL (`/posts/{id}`) and an optional note. The frontend chat component parses this URL and renders an interactive `PostSharePreview` card directly within the message bubble.

### Transition D: Two-Tier Token Bucket Rate Limiting

- **Original State:** No rate limiting, vulnerable to registration spam, brute force, and WebSocket message flooding.
- **Adopted Implementation:** Custom Go stdlib token-bucket rate limiter.
  - Global hard cap: 30 capacity, 10 tokens/s refill, 30s timeout penalty.
  - Per-endpoint soft cap: 10 capacity, 3 tokens/s refill, 15s timeout penalty.
  - Cheap endpoint discounting: High-frequency feed calls (`GET /posts/{id}/likes`, `GET /posts/{id}/comments/count`) are discounted to 0.2 tokens so feed scrolling does not trigger rate limiting.
  - WebSocket chat frame protection: Inbound `private_message` and `group_message` events are throttled, returning `EventError` over the socket when breached.

---

## 6. Ideas Removed or Abandoned

1. **`schema.dbml` Separate Group Tables:** Abandoned in favor of column-based unification.
2. **GSAP Timeline Engine:** Removed during the September 13 frontend cleanup.
3. **Black Hole Model in UI:** Retained in `3d/black-hole-final.glb` as an experimental asset, but deliberately excluded from `PLANET_REGISTRY` due to theme contrast and aesthetic mismatch.
4. **Draco / Meshopt Geometry Compression:** Ruled out after the 3D asset optimization pass to avoid adding heavy WASM decoders to client bundles.
5. **Lossy Texture Downsampling on Core Planets:** Rejected in favor of container-level lossless pruning (`dedup`, `prune`, `weld`, `reorder`).

---

## 7. Lessons from Git History

1. **Monolithic 3D Canvases Conflict with Web Usability:**
   Attempting to turn an entire social network into an animated 3D video game degraded usability. Re-architecting 3D as an ambient, non-blocking visual backdrop created an aesthetically distinctive experience while maintaining instant web navigation.
2. **Single SQLite Connection in Go Prevents Locking:**
   Early concurrent integration tests suffered from SQLite `database is locked` errors. Setting `db.SetMaxOpenConns(1)` and `db.SetMaxIdleConns(1)` with WAL mode and `_foreign_keys=on` permanently solved SQLite concurrency conflicts.
3. **Monotonic Notification State Prevents UI Jitter:**
   Merging REST polling data and WebSocket pushes caused read notifications to briefly flash unread if REST returned an older snapshot. Implementing monotonic read merging (`isRead: n.isRead || Boolean(previous?.isRead)`) eliminated read state jitter.
4. **Weighted Rate Limiting is Critical for Micro-Endpoints:**
   Applying flat rate limits to REST endpoints broke post feeds when clients fired 20 sub-requests for post likes and comment counts. Adding weighted request costs (0.2 tokens) prevented false-positive 429 errors during normal feed consumption.
