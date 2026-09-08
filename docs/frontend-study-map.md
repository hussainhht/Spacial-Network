# Frontend Study TODO Map & Architecture Guide

A complete, systematic study checklist and architectural reference for the entire frontend codebase of the Social Network application. Use this document to navigate, study, and master every source file in a logical, progressive order.

---

# Study Progress

**Total Study Files**: 133  
(127 application source files + 6 root build & configuration files; 1 static binary asset excluded)

### Phase Milestones
- [ ] **Phase 1 Complete**: Application Entry, Route Groups & Page Endpoints (18 files)
- [ ] **Phase 2 Complete**: Shell Architecture & Layout Scaffold (4 files)
- [ ] **Phase 3 Complete**: Core Providers & Realtime / Universe Infrastructure (10 files)
- [ ] **Phase 4 Complete**: Shared Layout Components & Navigation Context (5 files)
- [ ] **Phase 5 Complete**: Space Visuals & 3D WebGL Engine (7 files)
- [ ] **Phase 6 Complete**: Network Client, Error Handling & Upload Sniffing (6 files)
- [ ] **Phase 7 Complete**: Posts Feature — Orbital 3D Experience & Classic Feed (11 files)
- [ ] **Phase 8 Complete**: Comments Feature — Inline Feed & Media Composer (8 files)
- [ ] **Phase 9 Complete**: Groups Feature — Galaxy Orbits, Synchronized Cache, Events & Admin (36 files)
- [ ] **Phase 10 Complete**: Notifications Feature — WebSocket Sync, Dropdown & Inbox (9 files)
- [ ] **Phase 11 Complete**: Profile Feature — Privacy Toggles, Followers & Content (10 files)
- [ ] **Phase 12 Complete**: Direct Messaging & Chat Feature (1 file)
- [ ] **Phase 13 Complete**: Development Tools & 3D Model Lab (3 files)
- [ ] **Phase 14 Complete**: Frontend Configuration & Build System (6 files)

### Summary Breakdown by Domain
- **Routing & Pages**: 18 files (`src/app/**`)
- **Shell & Layout**: 9 files (`src/components/layout/**`, `src/app/(main)/layout.tsx`)
- **Providers & Transitions**: 10 files (`src/providers/**`, `src/features/universe-transition/**`, context providers)
- **Space & 3D Graphics**: 7 files (`src/components/space/**`)
- **Shared Lib & Utilities**: 6 files (`src/lib/**`, `src/components/ImageAttachmentField.tsx`)
- **Posts**: 11 files (`src/features/posts/**`)
- **Comments**: 8 files (`src/features/comments/**`)
- **Groups**: 36 files (`src/features/groups/**`)
- **Notifications**: 9 files (`src/features/notifications/**`)
- **Profile**: 10 files (`src/features/profile/**`)
- **Chat**: 1 file (`src/features/chat/**`)
- **Dev Lab**: 3 files (`src/app/(main)/dev/3d/**`)
- **Build & Config**: 6 files (Root configs)

---

# High-Level Architecture Map

```text
Browser Client
     │
     ▼
Next.js App Router  ── [src/app/layout.tsx]  (RootLayout: HTML/Body, globals.css)
     │
     ▼
WebSocketProvider  ──── [src/providers/WebSocketProvider.tsx]  (Persistent ws://localhost:8080/api/ws connection)
     │
     ├─────────────────────────────────────────────────┐
     │ Route: (auth)                                    │ Route: (main)
     ▼                                                 ▼
[src/app/(auth)/login/page.tsx]               MainLayout [src/app/(main)/layout.tsx]
[src/app/(auth)/register/page.tsx]                     │
                                                       ├─► NotificationProvider [src/features/notifications/context/...]
                                                       │     (Realtime sync + REST unread polling)
                                                       ├─► GroupStateSync [src/features/groups/components/GroupStateSync.tsx]
                                                       │     (Headless event listener: WS -> refreshGroupData())
                                                       │
                                                       ▼
                                              AppShell [src/components/layout/AppShell.tsx]
                                                       │
                                                       ├─► GroupsSearchProvider (Galaxy search bar state context)
                                                       ├─► UniverseTransitionProvider (GSAP route transit coordinator)
                                                       │     ├─► HomeEarth Portal (<canvas> Three.js Earth docked)
                                                       │     └─► UniverseTransitionLayer (Glow & DOM capture overlay)
                                                       │
                                                       ├─► SpaceBackground (Multi-layer SVG starfield & ambient dust)
                                                       ├─► AppSidebar (Desktop navigation links, logout action)
                                                       └─► mainArea
                                                             ├─► TopNavbar (Breadcrumb title, search input, notifications bell, user menu)
                                                             └─► #page-content ({children} = Active Route Page)
                                                                   │
                                                                   ├── "/"            ──► HomeOrbitalFeed (3D orbital canvas + cards)
                                                                   ├── "/posts"       ──► PostFeed (List, cards, comments portal)
                                                                   ├── "/posts/[id]"  ──► PostDetailPage
                                                                   ├── "/groups"      ──► GroupsPageContent -> GroupGalaxy (SVG orbit rings)
                                                                   ├── "/groups/[id]" ──► GroupDetailsContent (Tabs, members, events)
                                                                   ├── "/notifications" ► NotificationInbox (Tabs, filters, actions)
                                                                   ├── "/profile"     ──► ProfilePage (Own profile or /profile/[username])
                                                                   ├── "/chat"        ──► ChatPage (Realtime 1:1 messaging testbed)
                                                                   └── "/dev/3d"      ──► ModelLabPage (Isolated 3D Earth inspect tool)
                                                                         │
                                                                         ▼
                                                               Shared Feature Modules
                                                               (API, Hooks, Types, Components)
                                                                         │
                                                                         ▼
                                                              REST API Client (fetch) & WebSocket Transport
                                                                         │
                                                                         ▼
                                                              Go Backend (http://localhost:8080)
```

---

# Architecture & Relationship Diagrams

### 1. Root & Shell Layout Progression
```text
RootLayout (src/app/layout.tsx)
  │  - Initializes <html> and <body>
  │  - Loads src/app/globals.css
  │  - children: (auth) or (main) route tree
  ▼
WebSocketProvider (src/providers/WebSocketProvider.tsx)
  │  - Establishes ws:// connection to Go backend
  │  - Distributes message, typing, online status, notification payloads
  ▼
MainLayout (src/app/(main)/layout.tsx)
  │  - children: Current route page inside (main)
  ├─► NotificationProvider (Syncs notifications via WS + REST)
  ├─► GroupStateSync (Headless listener: invalidates group cache on WS events)
  └─► AppShell (src/components/layout/AppShell.tsx)
        ├─► GroupsSearchProvider (Shared navbar <-> galaxy search text)
        ├─► UniverseTransitionProvider (GSAP animation & 3D Earth portal coordinator)
        ├─► SpaceBackground (3-layer parallax SVG starfield)
        ├─► AppSidebar (Main navigation links & session logout)
        └─► TopNavbar (Route context title, search bar, notification bell, profile menu)
```

### 2. Universe Transition & 3D Scene Flow
```text
UniverseTransitionProvider (src/features/universe-transition/UniverseTransitionProvider.tsx)
  │  Owns GSAP transitions between "/" (Home) and "/groups" (Galaxy)
  │
  ├── Portals ──► HomeEarth (src/components/space/HomeEarth.tsx)
  │                 └── Earth3D (src/components/space/Earth3D.tsx)
  │                       ├── Canvas (@react-three/fiber)
  │                       ├── EarthModel (GLTF /models/earth-final.glb)
  │                       └── createEarthMaterials (Coastline recoloring + FBM noise + Fresnel atmosphere)
  │
  ├── Controls ──► Home Scene (data-universe-scene="home")
  │                 └── HomeOrbitalFeed (GSAP Flip + ScrollTrigger cards)
  │
  └── Controls ──► Groups Scene (data-universe-scene="groups")
                    └── GroupGalaxy (Orbiting group stars on concentric SVG tracks)
```

### 3. Notification Real-Time Sync Pipeline
```text
Go Backend WebSocket Event ("notification")
     │
     ▼
WebSocketProvider (onmessage)
     │
     ▼ (subscribeNotifications)
useNotificationSync (src/features/notifications/hooks/useNotificationSync.ts)
     │
     ├─► mergeNotifications (Deduplicates by ID, preserves immutable read flags)
     ├─► REST Re-sync (fetchNotifications + fetchUnreadCount for consistency)
     │
     ▼
NotificationProvider (React Context)
     │
     ▼
useNotifications()
     │
     ├─► TopNavbar (Bell icon badge count)
     ├─► NotificationBell / NotificationDropdown (Quick popover preview)
     ├─► NotificationItem (Accept/reject inline group actions)
     └─► NotificationInbox (Full page view with tabs and filters)
```

### 4. Groups Real-Time In-Memory Cache
```text
WebSocket Events ("group_event_response_updated", "group_invitation", "group_join_request")
     │
     ▼
GroupStateSync (src/features/groups/components/GroupStateSync.tsx)
     │
     ▼ calls refreshGroupData(groupId?)
useGroupData (src/features/groups/hooks/useGroupData.ts)
     │
     ▼ (resourceFor key cache invalidation)
useSyncExternalStore Subscribers
     │
     ├─► useGroup(id)
     ├─► useMyGroups(limit, offset, search)
     ├─► useGroupMembers(id)
     ├─► useMembership(id)
     ├─► usePendingInvitations()
     ├─► usePendingJoinRequests(id)
     ├─► useGroupEvents(id)
     └─► useEventResponses(groupId, eventId)
```

---

# Recommended Study Order

Follow this 14-phase study sequence to learn the codebase systematically, starting with foundational entry points, advancing through layout infrastructure, 3D graphics, state management, and ending with complex features and configuration:

1. **Phase 1 — Application Entry, Route Groups & Page Endpoints** (Understand Next.js App Router structure and routing entry points)
2. **Phase 2 — Global Shell & Layout Scaffold** (Understand how pages are structured, wrapped, and visually contained)
3. **Phase 3 — Providers & Realtime / Universe Infrastructure** (Understand WebSocket transport, shared state, and scene coordinators)
4. **Phase 4 — Shared Layout Components & Navigation Context** (Understand sidebars, navigation headers, and responsive icons)
5. **Phase 5 — Space Visuals & 3D WebGL Engine** (Understand Three.js, shaders, materials, and procedural starfields)
6. **Phase 6 — Network Client, Error Handling & Upload Sniffing** (Understand shared fetch abstraction and client-side binary validation)
7. **Phase 7 — Posts Feature** (Understand both the 3D orbital feed and traditional post feeds/forms)
8. **Phase 8 — Comments Feature** (Understand inline comments, floating composers, and media attachments)
9. **Phase 9 — Groups Feature** (Understand galaxy orbit mathematics, in-memory sync cache, and multi-step management flows)
10. **Phase 10 — Notifications Feature** (Understand bidirectional notification synchronization, dropdowns, and response handlers)
11. **Phase 11 — Profile & Relationship Feature** (Understand user profiles, follow relationships, and privacy toggles)
12. **Phase 12 — Direct Messaging & Chat Feature** (Understand 1:1 WebSocket real-time messaging)
13. **Phase 13 — Development Tools & 3D Model Lab** (Understand isolated 3D model testing workspace)
14. **Phase 14 — Frontend Build & Project Configuration** (Understand TypeScript, Next.js build config, Tailwind, and ESLint)

---

# Detailed Study Checklist

## Phase 1 — Application Entry, Route Groups & Page Endpoints

This phase covers how Next.js routes incoming requests, distinguishes between unauthenticated auth pages and authenticated application views, and initializes pages.

### Root Entry
- [ ] `frontend/src/app/layout.tsx`
  - Priority: HIGH
  - **Purpose**: Root Next.js HTML document layout. Sets page `<title>`, injects the global stylesheet, and mounts `WebSocketProvider` at the root level so WebSocket connectivity is accessible across all route groups.
  - **`children`**: Represents the active route tree underneath the root, either from the `(auth)` group or `(main)` group.
- [ ] `frontend/src/app/globals.css`
  - Priority: HIGH
  - **Purpose**: Global application CSS. Defines CSS custom properties (color tokens for the space theme, typography, surfaces, borders, button states, and CSS utility classes). Owned globally.

### Authenticated Route Group Entry
- [ ] `frontend/src/app/(main)/layout.tsx`
  - Priority: HIGH
  - **Purpose**: Primary layout for authenticated routes. Injects `NotificationProvider`, the headless `GroupStateSync` component, and wraps everything in `AppShell`.
  - **`children`**: Represents whichever page inside the `(main)` route group is currently active (e.g., Home, Posts, Groups, Profile, Chat, Notifications).

### Authentication Route Pages
- [ ] `frontend/src/app/(auth)/login/page.tsx`
  - Priority: MEDIUM
  - **Purpose**: Client-side login page. Manages username/password inputs, posts credentials to `/api/login` with cookie credentials, displays errors, and redirects to `/` upon success.
- [ ] `frontend/src/app/(auth)/register/page.tsx`
  - Priority: MEDIUM
  - **Purpose**: User registration page. Captures username, name, email, password, gender, age, and optional profile photo via multipart `FormData`, submitting to `/api/register`.

### Main Application Pages
- [ ] `frontend/src/app/(main)/page.tsx`
  - Priority: HIGH
  - **Purpose**: Application home route (`/`). Hosts the immersive 3D `HomeOrbitalFeed` component within a `data-universe-scene="home"` container.
- [ ] `frontend/src/app/(main)/posts/page.tsx`
  - Priority: MEDIUM
  - **Purpose**: Classic chronological post feed page (`/posts`). Mounts `PostFeed` inside a structured container.
- [ ] `frontend/src/app/(main)/posts/new/page.tsx`
  - Priority: MEDIUM
  - **Purpose**: Post creation page (`/posts/new`). Renders navigation back-link and mounts `NewPostForm`.
- [ ] `frontend/src/app/(main)/posts/new/loading.tsx`
  - Priority: LOW
  - **Purpose**: Next.js App Router streaming loading state for the post creation route.
- [ ] `frontend/src/app/(main)/posts/[id]/page.tsx`
  - Priority: MEDIUM
  - **Purpose**: Post permalink detail view (`/posts/[id]`). Fetches specific post by ID, displays full post content, media, author controls, and mounts `CommentsSection`.
- [ ] `frontend/src/app/(main)/posts/[id]/edit/page.tsx`
  - Priority: MEDIUM
  - **Purpose**: Dedicated post edit page (`/posts/[id]/edit`). Verifies post ownership, pre-populates `PostForm`, and handles updates.
- [ ] `frontend/src/app/(main)/groups/page.tsx`
  - Priority: HIGH
  - **Purpose**: Group discovery & galaxy directory page (`/groups`). Mounts `GroupsPageContent`.
- [ ] `frontend/src/app/(main)/groups/create/page.tsx`
  - Priority: MEDIUM
  - **Purpose**: Group creation page (`/groups/create`). Mounts `CreateGroupForm`.
- [ ] `frontend/src/app/(main)/groups/[groupId]/page.tsx`
  - Priority: HIGH
  - **Purpose**: Group detail page (`/groups/[groupId]`). Validates numeric group ID param and mounts `GroupDetailsContent`.
- [ ] `frontend/src/app/(main)/notifications/page.tsx`
  - Priority: MEDIUM
  - **Purpose**: Dedicated notifications inbox page (`/notifications`). Mounts `NotificationInbox`.
- [ ] `frontend/src/app/(main)/profile/page.tsx`
  - Priority: MEDIUM
  - **Purpose**: Current user profile route (`/profile`). Mounts `ProfilePage` without a username argument to load `/users/me`.
- [ ] `frontend/src/app/(main)/profile/[username]/page.tsx`
  - Priority: MEDIUM
  - **Purpose**: Public/target user profile route (`/profile/[username]`). Resolves route params asynchronously and mounts `ProfilePage` with the target username.
- [ ] `frontend/src/app/(main)/chat/page.tsx`
  - Priority: MEDIUM
  - **Purpose**: 1:1 Chat testing and messaging interface (`/chat`). Displays live WebSocket connection status, online user list, recipient selector, and message stream.

### My Notes
- 
- 
- 

---

## Phase 2 — Global Shell & Layout Scaffold

This phase examines the outer frame that houses navigation, global header metadata, and page transitions.

- [ ] `frontend/src/components/layout/AppShell.tsx`
  - Priority: HIGH
  - **Purpose**: Core structural shell for all main routes. Wraps content with `GroupsSearchProvider` and `UniverseTransitionProvider`. Renders `SpaceBackground`, skip-to-content accessibility link, `AppSidebar`, `TopNavbar`, and the main route container.
  - **`children`**: Represents the current page content rendered inside `#page-content`.
- [ ] `frontend/src/components/layout/AppShell.module.css`
  - Priority: MEDIUM
  - **Purpose**: Styling for `AppShell.tsx`, `AppSidebar.tsx`, and general layout layout containers (grid template, sidebar drawer, skip link, main area scroll bounds). Owned by `AppShell`.
- [ ] `frontend/src/components/layout/AppSidebar.tsx`
  - Priority: HIGH
  - **Purpose**: Persistent desktop navigation sidebar. Displays application branding, main navigation links (Home, Posts, Groups, Messages, Profile, and Dev 3D in development mode), active route indicators using hydration-safe `useSyncExternalStore`, and session logout handler.
- [ ] `frontend/src/components/layout/TopNavbar.tsx`
  - Priority: HIGH
  - **Purpose**: Context-aware top navigation header. Computes route context title and eyebrow via `navbarContext.ts`, displays search bar (or group search in groups mode), "New Post" action link, notifications bell with unread badge and dropdown, and user menu dropdown.
- [ ] `frontend/src/components/layout/TopNavbar.module.css`
  - Priority: MEDIUM
  - **Purpose**: CSS styles for `TopNavbar.tsx` (blur backdrops, flex alignments, dropdown menus, notification badge counter). Owned by `TopNavbar`.

### My Notes
- 
- 
- 

---

## Phase 3 — Providers & Realtime / Universe Infrastructure

This phase examines the state containers, WebSocket transport layer, and animation orchestrators that wrap the application.

### WebSocket Transport & Global State
- [ ] `frontend/src/providers/WebSocketProvider.tsx`
  - Priority: HIGH
  - **Provider Scope**: Wraps the entire application inside `RootLayout` (`src/app/layout.tsx`).
  - **Value Provided**: `isConnected`, `onlineUserIDs`, `lastMessage`, `typingStatus`, `errorMessage`, `inviteSearchResults`, `lastNotification`, `lastEventResponseUpdate`, `subscribeNotifications`, `subscribeEventResponses`, and `sendEvent`.
  - **Consumed By**: `useWebSocket()`, consumed across `useChat`, `useNotificationSync`, `GroupStateSync`, `useInviteUserSearch`, `TopNavbar`, and `ChatPage`.
  - **State Ownership**: Maintains the singleton `WebSocket` socket connection to `ws://localhost:8080/api/ws`, automatic reconnection with backoff, message parsing, and listener dispatch sets.
- [ ] `frontend/src/lib/websocket/types.ts`
  - Priority: MEDIUM
  - **Purpose**: TypeScript interfaces for WebSocket transport payloads (`WSEvent`, `MessagePayload`, `TypingPayload`, `UserStatusPayload`, `InviteUserSearchPayload`, `NotificationEventPayload`, `GroupEventResponseUpdatedPayload`, etc.).

### Notification Context & Synchronization
- [ ] `frontend/src/features/notifications/context/NotificationProvider.tsx`
  - Priority: HIGH
  - **Provider Scope**: Wraps `AppShell` and its subtrees in `MainLayout` (`src/app/(main)/layout.tsx`).
  - **Value Provided**: Notification synchronization state (`notifications`, `unreadCount`, `loading`, `error`, `hasMore`, `markAsRead`, `markAllAsRead`, `refresh`, `loadMore`).
  - **Consumed By**: `useNotifications()`, consumed in `TopNavbar`, `NotificationBell`, `NotificationDropdown`, `NotificationInbox`, and `NotificationItem`.
- [ ] `frontend/src/features/groups/components/GroupStateSync.tsx`
  - Priority: HIGH
  - **Purpose**: Headless component mounted inside `MainLayout`. Subscribes to WebSocket notifications and event response updates; automatically triggers `refreshGroupData()` when group invitations, join requests, or event RSVP updates arrive, as well as on window focus and reconnection.

### Groups Search Context
- [ ] `frontend/src/features/groups/context/GroupsSearchProvider.tsx`
  - Priority: MEDIUM
  - **Provider Scope**: Wraps `UniverseTransitionProvider` inside `AppShell` (`src/components/layout/AppShell.tsx`).
  - **Value Provided**: `{ search, setSearch }` string state.
  - **Consumed By**: `useGroupsSearch()`, consumed by `TopNavbar` (search input) and `GroupsPageContent` (galaxy filtering).

### Universe Transition & Scene Coordinator
- [ ] `frontend/src/features/universe-transition/UniverseTransitionProvider.tsx`
  - Priority: HIGH
  - **Provider Scope**: Wraps layout shell elements in `AppShell` (`src/components/layout/AppShell.tsx`).
  - **Value Provided**: `{ isTransitioning, transitionState, navigate, register, homePosition }`.
  - **Consumed By**: `useUniverseTransition()`, consumed in `AppSidebar`, `TopNavbar`, `HomeOrbitalFeed`, and `GroupGalaxy`.
  - **State Ownership**: Manages coordinated GSAP scene transitions between `/` (Home 3D Earth) and `/groups` (Galaxy star system), docking the persistent Three.js Earth canvas via React portals without unmounting WebGL context.
- [ ] `frontend/src/features/universe-transition/UniverseTransitionLayer.tsx`
  - Priority: MEDIUM
  - **Purpose**: DOM container rendering background portal target layers and atmospheric transition glows during route changes.
- [ ] `frontend/src/features/universe-transition/UniverseTransition.module.css`
  - Priority: LOW
  - **Purpose**: CSS animations and positioning rules for universe transition stages and glows. Owned by `UniverseTransitionProvider`.
- [ ] `frontend/src/features/universe-transition/animation.ts`
  - Priority: MEDIUM
  - **Purpose**: GSAP timeline animation utilities (`enterScene`, `exitScene`, `moveEarth`, `center`) for smooth orbital zooms and coordinate transforms.
- [ ] `frontend/src/features/universe-transition/types.ts`
  - Priority: LOW
  - **Purpose**: Type definitions for scene registration, transition states, and 3D Earth handles (`EarthHandle`, `SceneRegistration`, `UniverseTransitionState`).
- [ ] `frontend/src/features/universe-transition/README.md`
  - Priority: LOW
  - **Purpose**: Architectural documentation explaining the lifecycle, portal docking mechanism, and animation safety timeouts of the Universe Transition engine.

### My Notes
- 
- 
- 

---

## Phase 4 — Shared Layout Components & Navigation Context

This phase covers reusable visual elements and navigational helpers used across the shell.

- [ ] `frontend/src/components/layout/navbarContext.ts`
  - Priority: MEDIUM
  - **Purpose**: Pure route metadata resolver. Maps current `pathname` to header titles, eyebrow captions, search bar mode (`"global"` vs `"groups"`), and primary action button configurations (`"New Post"` or `"Create Group"`).
- [ ] `frontend/src/components/layout/AppIcon.tsx`
  - Priority: MEDIUM
  - **Purpose**: Centralized SVG icon component rendering 20+ custom vector paths (orbit, home, posts, groups, chat, user, bell, plus, search, etc.) with standardized dimensions and accessibility attributes.
- [ ] `frontend/src/components/layout/AppHeader.tsx`
  - Priority: LOW
  - **Purpose**: Alternative / legacy standalone header component with inline search input, connection status dot, and `NotificationBell`. Useful as an architectural reference of earlier layout iterations.

### My Notes
- 
- 
- 

---

## Phase 5 — Space Visuals & 3D WebGL Engine

This phase details how the space aesthetic and Three.js 3D earth model are constructed, rendered, and optimized.

- [ ] `frontend/src/components/space/SpaceBackground.tsx`
  - Priority: HIGH
  - **Purpose**: Background canvas rendering a deep space ambiance. Renders 3 layers of parallax SVG starfields (distant, medium, bright) with twinkling/pulsing animations and cosmic dust haze.
- [ ] `frontend/src/components/space/SpaceBackground.module.css`
  - Priority: MEDIUM
  - **Purpose**: CSS keyframes for drifting dust clouds, star halos, and twinkling brightness animations. Owned by `SpaceBackground`.
- [ ] `frontend/src/components/space/starData.ts`
  - Priority: MEDIUM
  - **Purpose**: Fixed pseudo-random coordinate datasets for distant, medium, and bright focal stars (positions, radii, opacities, twinkle groups, spike flags) ensuring deterministic, hydration-safe rendering.
- [ ] `frontend/src/components/space/HomeEarth.tsx`
  - Priority: HIGH
  - **Purpose**: React component bridging HTML DOM and Three.js WebGL canvas. Dynamically imports `Earth3D` with SSR disabled and wraps it in an error boundary to guard against WebGL failures.
- [ ] `frontend/src/components/space/HomeEarth.module.css`
  - Priority: LOW
  - **Purpose**: Stage sizing and placeholder styling for the 3D Earth container. Owned by `HomeEarth`.
- [ ] `frontend/src/components/space/Earth3D.tsx`
  - Priority: HIGH
  - **Purpose**: Three.js / React Three Fiber canvas component. Loads `/models/earth-final.glb`, clones scene hierarchies to isolate cached textures, applies custom materials, handles auto-rotation, and detects software renderer fallbacks.
- [ ] `frontend/src/components/space/earthMaterials.ts`
  - Priority: HIGH
  - **Purpose**: Custom Three.js materials with embedded GLSL shader chunks. Injects 3D simplex noise (FBM) to recolor raw coastlines, procedurally generates clouds, and builds a Fresnel rim atmosphere shader with directional sun lighting.

### My Notes
- 
- 
- 

---

## Phase 6 — Network Client, Error Handling & Upload Sniffing

This phase covers HTTP client abstractions, structured errors, and client-side binary validation for uploads.

- [ ] `frontend/src/lib/api.ts`
  - Priority: HIGH
  - **Purpose**: Centralized backend port and URL configuration helper (`getBackendBaseUrl`, `getApiUrl`, `getUploadsBaseUrl`, `getWebSocketUrl`, `apiConfig`). Default configured for `http://localhost:8080`.
- [ ] `frontend/src/lib/api/client.ts`
  - Priority: HIGH
  - **Purpose**: Core `apiRequest<T>()` fetch wrapper. Enforces `credentials: "include"`, dynamically attaches `application/json` headers when body is not `FormData`, extracts backend error messages, and returns typed responses.
- [ ] `frontend/src/lib/api/errors.ts`
  - Priority: MEDIUM
  - **Purpose**: Custom `ApiError` class extending `Error`, carrying the HTTP status code for programmatic error handling (e.g., redirecting on 401).
- [ ] `frontend/src/lib/upload.ts`
  - Priority: HIGH
  - **Purpose**: Client-side media upload validator. Reads the first 12 bytes of files to sniff magic bytes (`ffd8ff` for JPEG, `89504e47` for PNG, `47494638` for GIF, `52494646` / `57454250` for WebP), enforcing a 5MB size limit before requests reach the Go server.
- [ ] `frontend/src/components/ImageAttachmentField.tsx`
  - Priority: MEDIUM
  - **Purpose**: Reusable file picker form field with image preview generation (`URL.createObjectURL`), automated cleanup on unmount, client-side validation integration, and removal controls.

### My Notes
- 
- 
- 

---

## Phase 7 — Posts Feature

This phase covers post data models, API clients, standard chronological feeds, and the 3D home orbital experience.

### Core Architecture & API
- [ ] `frontend/src/features/posts/types/post.ts`
  - Priority: HIGH
  - **Purpose**: TypeScript data contracts for posts (`Post`, `PostInput`, `NewPostInput`).
- [ ] `frontend/src/features/posts/api/posts.ts`
  - Priority: HIGH
  - **Purpose**: Posts API client (`listPosts`, `getPost`, `createPost`, `updatePost`, `deletePost`) connecting to `/api/posts`.

### Home 3D Orbital Experience
- [ ] `frontend/src/features/posts/components/home/HomeOrbitalFeed.tsx`
  - Priority: HIGH
  - **Purpose**: Interactive orbital post feed. Uses GSAP `ScrollTrigger` to project post cards along an elliptical orbit around the 3D Earth, with depth-based opacity, scale, and z-index occlusion. Integrates GSAP `Flip` to smoothly expand cards into reading/editing panels.
- [ ] `frontend/src/features/posts/components/home/HomeOrbitalFeed.module.css`
  - Priority: MEDIUM
  - **Purpose**: Layout and positioning rules for orbital cards, scroll tracks, and expanded panel transitions. Owned by `HomeOrbitalFeed`.
- [ ] `frontend/src/features/posts/components/home/OrbitalPost.tsx`
  - Priority: MEDIUM
  - **Purpose**: Positioned orbit slot wrapper holding placeholder markers and the `ExpandedPost` surface.
- [ ] `frontend/src/features/posts/components/home/ExpandedPost.tsx`
  - Priority: HIGH
  - **Purpose**: Expanded post reading and editing surface. Manages toolbar actions, inline edit mode via `PostForm`, comments dock portal target, and keyboard navigation.

### Feed & Forms (Core & Supporting)
- [ ] `frontend/src/features/posts/components/PostCard.tsx`
  - Priority: HIGH
  - **Purpose**: Reusable post card component. Displays author info, timestamp, title, text content, image attachments, privacy badges, and action dropdown menu (Edit/Delete).
- [ ] `frontend/src/features/posts/components/PostCard.module.css`
  - Priority: LOW
  - **Purpose**: Styles for standard post cards (borders, avatars, badges, typography). Owned by `PostCard`.
- [ ] `frontend/src/features/posts/components/PostFeed.tsx`
  - Priority: MEDIUM
  - **Purpose**: Standard vertical feed list component. Fetches posts via `listPosts()`, handles loading/empty states, error alerts, and post deletion state updates.
- [ ] `frontend/src/features/posts/components/PostForm.tsx`
  - Priority: MEDIUM
  - **Purpose**: Reusable form for creating and updating posts (title input, content textarea, private checkbox, optional image attachment field).
- [ ] `frontend/src/features/posts/components/NewPostForm.tsx`
  - Priority: MEDIUM
  - **Purpose**: Wrapper around `PostForm` that invokes `createPost()` and redirects to `/posts`.

### My Notes
- 
- 
- 

---

## Phase 8 — Comments Feature

This phase covers social comment feeds, creation forms with media attachments, and deletion handling.

- [ ] `frontend/src/features/comments/types/comment.ts`
  - Priority: HIGH
  - **Purpose**: TypeScript interface for comments (`Comment`).
- [ ] `frontend/src/features/comments/api/comments.ts`
  - Priority: HIGH
  - **Purpose**: Comments REST API client (`listComments`, `createComment`, `deleteComment`) connecting to `/api/posts/:id/comments` and `/api/comments/:id`.
- [ ] `frontend/src/features/comments/components/CommentsSection.tsx`
  - Priority: HIGH
  - **Purpose**: Central comments container. Fetches comments for a post, tracks optimistic counts, handles creation/deletion, and portals the composer into target docks when requested.
- [ ] `frontend/src/features/comments/components/CommentsSection.module.css`
  - Priority: LOW
  - **Purpose**: Styles for comment container dividers, header counts, and sticky composer docks. Owned by `CommentsSection`.
- [ ] `frontend/src/features/comments/components/CommentForm.tsx`
  - Priority: MEDIUM
  - **Purpose**: Comment creation form. Includes auto-resizing textarea, Enter-to-submit keybindings, image/GIF attachment popup menu, and preview dismiss buttons.
- [ ] `frontend/src/features/comments/components/CommentForm.module.css`
  - Priority: LOW
  - **Purpose**: Styling for the comment composer bar and attachment dropdown menu. Owned by `CommentForm`.
- [ ] `frontend/src/features/comments/components/CommentList.tsx`
  - Priority: MEDIUM
  - **Purpose**: Renders the list of comments, author avatars, relative timestamps, attached images, and owner deletion buttons.
- [ ] `frontend/src/features/comments/components/CommentList.module.css`
  - Priority: LOW
  - **Purpose**: Styling for individual comment list items, avatar alignment, and media previews. Owned by `CommentList`.

### My Notes
- 
- 
- 

---

## Phase 9 — Groups Feature

This phase explores the most comprehensive feature module: galaxy orbit visualization, in-memory synchronized queries, events RSVP, and group administration.

### Core Data, API & State Cache
- [ ] `frontend/src/features/groups/types/group.ts`
  - Priority: HIGH
  - **Purpose**: Frontend data interfaces (`Group`, `GroupMember`, `Membership`, `GroupInvitation`, `GroupJoinRequest`, `GroupEvent`, `EventResponseUser`, etc.).
- [ ] `frontend/src/features/groups/types/api.ts`
  - Priority: MEDIUM
  - **Purpose**: Raw backend API snake_case response interfaces (`ApiGroup`, `ApiGroupMember`, `ApiEvent`, etc.).
- [ ] `frontend/src/features/groups/api/groups.ts`
  - Priority: HIGH
  - **Purpose**: Groups API client. Implements `groupRequest<T>()` with `{success, message}` envelope handling, providing endpoints for groups, members, join requests, invitations, and events.
- [ ] `frontend/src/features/groups/hooks/useGroupData.ts`
  - Priority: HIGH
  - **Purpose**: Central in-memory reactive cache layer built on `useSyncExternalStore`. Exports `useGroup`, `useMyGroups`, `useGroupMembers`, `useMembership`, `usePendingInvitations`, `usePendingJoinRequests`, `useGroupEvents`, `useEventResponses`, and cache invalidators `refreshGroupData` and `updateGroupEvent`.
  - **State Ownership**: Maintains shared query resource records, manages deduplicated subscriptions, and broadcasts updates across active subscribers.
- [ ] `frontend/src/features/groups/hooks/useGroupAction.ts`
  - Priority: HIGH
  - **Purpose**: Coordinated mutation hook for group actions (joining, leaving, RSVPing). Prevents duplicate in-flight mutations, tracks busy labels, and triggers `refreshGroupData(groupId)` upon completion.
- [ ] `frontend/src/features/groups/hooks/useGroupInvitation.ts`
  - Priority: MEDIUM
  - **Purpose**: Hook managing the invitation state machine (`handleInvite`), tracking pending user IDs and row errors.
- [ ] `frontend/src/features/groups/hooks/useGroupJoinRequest.ts`
  - Priority: MEDIUM
  - **Purpose**: Hook computing whether the current user can request group membership and executing join requests via `useGroupAction`.
- [ ] `frontend/src/features/groups/hooks/useDebouncedValue.ts`
  - Priority: LOW
  - **Purpose**: Generic debounce hook delaying state reflection until input pauses for a given duration.
- [ ] `frontend/src/features/groups/hooks/useInviteUserSearch.ts`
  - Priority: HIGH
  - **Purpose**: Real-time user invitation search hook. Sends `invite_user_search` over WebSocket via `sendEvent()` and receives matching candidates filtered by group membership.

### Galaxy Visualization & Orbits
- [ ] `frontend/src/features/groups/utils/orbitLayout.ts`
  - Priority: HIGH
  - **Purpose**: Mathematical layout generator distributing groups across 3 concentric orbital rings with counter-rotating speed presets.
- [ ] `frontend/src/features/groups/components/galaxy/GroupGalaxy.tsx`
  - Priority: HIGH
  - **Purpose**: 2D/3D orbital galaxy visualization. Animates concentric SVG orbits with GSAP, positions `GroupStar` nodes, handles selection shifts, and docks `GroupPreviewPanel`.
- [ ] `frontend/src/features/groups/components/galaxy/GroupGalaxy.module.css`
  - Priority: MEDIUM
  - **Purpose**: CSS styles for the galaxy view, orbit rings, star nodes, and floating preview panel. Owned by `GroupGalaxy`.
- [ ] `frontend/src/features/groups/components/galaxy/GroupStar.tsx`
  - Priority: MEDIUM
  - **Purpose**: Interactive star node rendered along an orbit ring representing an individual group.

### Page Containers & Display Components
- [ ] `frontend/src/features/groups/components/GroupsPageContent.tsx`
  - Priority: HIGH
  - **Purpose**: Main container for `/groups`. Handles tab filtering ("My Groups" vs "Discover"), debounced search queries, pagination, and mounts `GroupGalaxy`.
- [ ] `frontend/src/features/groups/components/GroupsFilterTabs.tsx`
  - Priority: MEDIUM
  - **Purpose**: Accessible tab switcher between "My Groups" and "Discover All".
- [ ] `frontend/src/features/groups/components/GroupSearchInput.tsx`
  - Priority: MEDIUM
  - **Purpose**: Reusable search input component styled for the group directory.
- [ ] `frontend/src/features/groups/components/GroupCard.tsx`
  - Priority: MEDIUM
  - **Purpose**: Standard group card displaying avatar, member count, title, description, and membership status badge.
- [ ] `frontend/src/features/groups/components/GroupAvatar.tsx`
  - Priority: LOW
  - **Purpose**: Group avatar image renderer with deterministic fallback gradients.
- [ ] `frontend/src/features/groups/components/GroupDetailsContent.tsx`
  - Priority: HIGH
  - **Purpose**: Detail view for `/groups/[groupId]`. Orchestrates group header, tab switching (Events, Members, Manage), and sub-panel rendering.
- [ ] `frontend/src/features/groups/components/GroupTabs.tsx`
  - Priority: MEDIUM
  - **Purpose**: Tab bar for group detail views (Events, Members, Management).
- [ ] `frontend/src/features/groups/components/GroupPanels.tsx`
  - Priority: HIGH
  - **Purpose**: Core group sub-panels: `MembersPanel`, `MembershipPanel`, `InvitationsPanel`, and `MembershipBadge`.
- [ ] `frontend/src/features/groups/components/GroupPreviewPanel.tsx`
  - Priority: MEDIUM
  - **Purpose**: Floating preview card displayed when selecting a star in `GroupGalaxy`.
- [ ] `frontend/src/features/groups/components/GroupJoinButton.tsx`
  - Priority: MEDIUM
  - **Purpose**: Join/leave action button reflecting pending requests and membership state.
- [ ] `frontend/src/features/groups/components/GroupResponseActions.tsx`
  - Priority: MEDIUM
  - **Purpose**: Button groups for accepting/rejecting invitations and join requests.

### Events Sub-Feature
- [ ] `frontend/src/features/groups/components/events/GroupEvents.tsx`
  - Priority: HIGH
  - **Purpose**: Primary events tab container for a group. Lists upcoming events, RSVP status, and mounts `CreateEventModal`.
- [ ] `frontend/src/features/groups/components/events/EventCard.tsx`
  - Priority: HIGH
  - **Purpose**: Event card component displaying date/time, countdown, description, Going/Not Going buttons, and attendee accordion.
- [ ] `frontend/src/features/groups/components/events/EventAttendees.tsx`
  - Priority: MEDIUM
  - **Purpose**: Attendees modal or list showing user avatars and RSVP responses.
- [ ] `frontend/src/features/groups/components/events/EventCountdown.tsx`
  - Priority: LOW
  - **Purpose**: Live countdown ticker showing days/hours/minutes until event start.
- [ ] `frontend/src/features/groups/components/events/CreateEventModal.tsx`
  - Priority: MEDIUM
  - **Purpose**: Modal form for creating a new group event.

### Management & Invite Sub-Components
- [ ] `frontend/src/features/groups/components/management/CreateGroupForm.tsx`
  - Priority: MEDIUM
  - **Purpose**: Form for creating a new group with title, description, and avatar upload.
- [ ] `frontend/src/features/groups/components/management/EditGroupForm.tsx`
  - Priority: MEDIUM
  - **Purpose**: Form for editing existing group details.
- [ ] `frontend/src/features/groups/components/management/GroupDangerZone.tsx`
  - Priority: LOW
  - **Purpose**: Creator-only section for deleting groups or transferring ownership.
- [ ] `frontend/src/features/groups/components/management/GroupInviteModal.tsx`
  - Priority: MEDIUM
  - **Purpose**: Dialog modal containing candidate search and invite dispatching.
- [ ] `frontend/src/features/groups/components/management/GroupInviteSearch.tsx`
  - Priority: MEDIUM
  - **Purpose**: Search interface for finding users to invite to a group.
- [ ] `frontend/src/features/groups/components/management/InviteUserSearch.tsx`
  - Priority: MEDIUM
  - **Purpose**: Specialized search input connected to `useInviteUserSearch`.
- [ ] `frontend/src/features/groups/components/management/SelectedInviteList.tsx`
  - Priority: LOW
  - **Purpose**: List of selected users pending batch invitation dispatch.

### My Notes
- 
- 
- 

---

## Phase 10 — Notifications Feature

This phase covers notification models, REST API polling, WebSocket push events, dropdown previews, and full-page inbox management.

- [ ] `frontend/src/features/notifications/types/notification.ts`
  - Priority: HIGH
  - **Purpose**: Notification type contracts (`Notification`, `SupportedNotificationType`, `GroupNotificationData`, `RawNotification`), type guards (`isSupportedNotificationType`), and adapters (`toNotification`).
- [ ] `frontend/src/features/notifications/api/notifications.ts`
  - Priority: HIGH
  - **Purpose**: Notifications REST client (`fetchNotifications`, `fetchUnreadCount`, `markNotificationRead`, `markAllNotificationsRead`).
- [ ] `frontend/src/features/notifications/hooks/useNotificationSync.ts`
  - Priority: HIGH
  - **Purpose**: Central notification synchronization engine. Combines initial REST fetch, WebSocket push events, window focus triggers, pagination, and optimistic read updates.
  - **State Ownership**: Owns `notifications`, `unreadCount`, `loading`, and page offsets.
- [ ] `frontend/src/features/notifications/hooks/useNotificationNavigate.ts`
  - Priority: MEDIUM
  - **Purpose**: Navigation dispatcher resolving notification types (invitations, join requests) to their appropriate route destinations with hash anchors.
- [ ] `frontend/src/features/notifications/utils/mergeNotifications.ts`
  - Priority: MEDIUM
  - **Purpose**: Immutable merger function combining existing and incoming notifications, deduplicating by ID and ensuring read states cannot be accidentally reverted.
- [ ] `frontend/src/features/notifications/components/NotificationBell.tsx`
  - Priority: MEDIUM
  - **Purpose**: Bell button in `TopNavbar` showing the unread count badge and toggling `NotificationDropdown`.
- [ ] `frontend/src/features/notifications/components/NotificationDropdown.tsx`
  - Priority: MEDIUM
  - **Purpose**: Quick popover preview showing the 5 most recent notifications and a link to view all.
- [ ] `frontend/src/features/notifications/components/NotificationInbox.tsx`
  - Priority: HIGH
  - **Purpose**: Full-page inbox on `/notifications`. Provides "All" vs "Unread" tabs, "Mark all as read" button, and infinite scroll pagination.
- [ ] `frontend/src/features/notifications/components/NotificationItem.tsx`
  - Priority: HIGH
  - **Purpose**: Individual notification row item with relative timestamp formatting, mark-as-read trigger, navigation handler, and embedded group action buttons (`InvitationActions`, `JoinRequestActions`).

### My Notes
- 
- 
- 

---

## Phase 11 — Profile & Relationship Feature

This phase examines user profile viewing, follower/following relationships, and account privacy configuration.

- [ ] `frontend/src/features/profile/types/profile.ts`
  - Priority: HIGH
  - **Purpose**: TypeScript interfaces for user profiles (`Profile`, `ProfileTab`, `ProfileUserSummary`).
- [ ] `frontend/src/features/profile/api/profiles.ts`
  - Priority: HIGH
  - **Purpose**: Profile and social graph API client (`getProfileByUsername`, `getMyProfile`, `followUser`, `unfollowUser`, `getFollowStatus`, `getFollowers`, `getFollowing`, `updateMyProfilePrivacy`).
- [ ] `frontend/src/features/profile/components/ProfilePage.tsx`
  - Priority: HIGH
  - **Purpose**: Main profile orchestrator component. Determines if viewing own profile vs another user, loads profile data, posts, follower counts, follow status, and coordinates privacy toggles.
- [ ] `frontend/src/features/profile/components/ProfileHeader.tsx`
  - Priority: HIGH
  - **Purpose**: Profile header section. Displays avatar, full name, username, bio/metadata, post/follower/following metrics, and Follow/Unfollow or Edit buttons.
- [ ] `frontend/src/features/profile/components/ProfileContent.tsx`
  - Priority: HIGH
  - **Purpose**: Profile body container. Handles "Posts" vs "About" tabs, lists user posts, follower user cards, and privacy settings.
- [ ] `frontend/src/features/profile/components/Profile.module.css`
  - Priority: MEDIUM
  - **Purpose**: Styles for profile layout, header badges, stat counters, and privacy toggle cards. Owned by `ProfilePage`.
- [ ] `frontend/src/features/profile/components/ProfilePrivacy.tsx`
  - Priority: MEDIUM
  - **Purpose**: Interactive card allowing account owners to switch between Public and Private account visibility.
- [ ] `frontend/src/features/profile/components/ProfilePrivacyCard.tsx`
  - Priority: LOW
  - **Purpose**: Alternative variant of the profile privacy settings card with extended helper descriptions.
- [ ] `frontend/src/features/profile/components/ProfileState.tsx`
  - Priority: LOW
  - **Purpose**: Loading, error, and locked private account placeholder states (`ProfileLoadingState`, `ProfileErrorState`, `PrivateProfileState`).
- [ ] `frontend/src/features/profile/components/ProfileUserList.tsx`
  - Priority: MEDIUM
  - **Purpose**: User list card rendering followers and following summaries with links to their profiles.

### My Notes
- 
- 
- 

---

## Phase 12 — Direct Messaging & Chat Feature

This phase covers real-time 1:1 chat hooks and messaging infrastructure.

- [ ] `frontend/src/features/chat/hooks/useChat.ts`
  - Priority: HIGH
  - **Purpose**: Hook managing 1:1 direct messaging for a given recipient ID.
  - **State Ownership & Operations**:
    - Reads `onlineUserIDs`, `lastMessage`, and `typingStatus` from `useWebSocket()`.
    - Dispatches `"private_message"` events via `sendMessage(content)`.
    - Dispatches `"typing"` events via `sendTyping(isTyping)`.
    - Filters incoming messages matching the active conversation via `isMessageForThisChat()`.
    - Consumed by chat interfaces (e.g., `ChatPage`).

### My Notes
- 
- 
- 

---

## Phase 13 — Development Tools & 3D Model Lab

This phase covers developer-only workspaces used for testing WebGL performance and isolated 3D asset inspection.

- [ ] `frontend/src/app/(main)/dev/3d/page.tsx`
  - Priority: LOW
  - **Purpose**: Developer-only route (`/dev/3d`) that returns `notFound()` in production. Hosts the model inspection workspace.
- [ ] `frontend/src/app/(main)/dev/3d/page.module.css`
  - Priority: LOW
  - **Purpose**: Styling for the 3D model testing workspace and parameter definition list.
- [ ] `frontend/src/app/(main)/dev/3d/ModelPreview.tsx`
  - Priority: LOW
  - **Purpose**: Standalone client component rendering `Earth3D` with interactive orbit controls, zoom capabilities, and a reload error boundary.

### My Notes
- 
- 
- 

---

## Phase 14 — Frontend Build & Project Configuration

This phase covers root build files, compiler settings, stylesheets, and lint configurations.

- [ ] `frontend/package.json`
  - Priority: HIGH
  - **Purpose**: Project dependencies (Next.js 16, React 19, Three.js, React Three Fiber, React Three Drei, GSAP, Tailwind CSS) and build scripts (`dev`, `build`, `start`, `lint`).
- [ ] `frontend/tsconfig.json`
  - Priority: HIGH
  - **Purpose**: TypeScript configuration. Enforces strict mode, ES2017 target, bundler module resolution, and path alias mapping `@/* -> ./src/*`.
- [ ] `frontend/next.config.ts`
  - Priority: HIGH
  - **Purpose**: Next.js server configuration. Configures `remotePatterns` to allow loading uploaded media from `http://localhost:8080/uploads/**` with `dangerouslyAllowLocalIP: true`.
- [ ] `frontend/eslint.config.mjs`
  - Priority: MEDIUM
  - **Purpose**: Modern flat ESLint configuration incorporating `eslint-config-next/core-web-vitals` and TypeScript rules, ignoring `.next/`, `out/`, and `build/`.
- [ ] `frontend/postcss.config.mjs`
  - Priority: LOW
  - **Purpose**: PostCSS configuration loading `@tailwindcss/postcss` for Tailwind CSS v4 processing.
- [ ] `frontend/next-env.d.ts`
  - Priority: LOW
  - **Purpose**: Next.js auto-generated ambient type declarations for TypeScript support.

### My Notes
- 
- 
- 

---

# Frontend File Tree

Below is the complete, current file tree of `frontend/src/` alongside root configuration files:

```text
frontend/
├── eslint.config.mjs
├── next.config.ts
├── next-env.d.ts
├── package.json
├── postcss.config.mjs
├── tsconfig.json
└── src/
    ├── app/
    │   ├── (auth)/
    │   │   ├── login/
    │   │   │   └── page.tsx
    │   │   └── register/
    │   │       └── page.tsx
    │   ├── (main)/
    │   │   ├── chat/
    │   │   │   └── page.tsx
    │   │   ├── dev/
    │   │   │   └── 3d/
    │   │   │       ├── ModelPreview.tsx
    │   │   │       ├── page.module.css
    │   │   │       └── page.tsx
    │   │   ├── groups/
    │   │   │   ├── [groupId]/
    │   │   │   │   └── page.tsx
    │   │   │   ├── create/
    │   │   │   │   └── page.tsx
    │   │   │   └── page.tsx
    │   │   ├── notifications/
    │   │   │   └── page.tsx
    │   │   ├── posts/
    │   │   │   ├── [id]/
    │   │   │   │   ├── edit/
    │   │   │   │   │   └── page.tsx
    │   │   │   │   └── page.tsx
    │   │   │   ├── new/
    │   │   │   │   ├── loading.tsx
    │   │   │   │   └── page.tsx
    │   │   │   └── page.tsx
    │   │   ├── profile/
    │   │   │   ├── [username]/
    │   │   │   │   └── page.tsx
    │   │   │   └── page.tsx
    │   │   ├── layout.tsx
    │   │   └── page.tsx
    │   ├── globals.css
    │   └── layout.tsx
    │
    ├── components/
    │   ├── layout/
    │   │   ├── AppHeader.tsx
    │   │   ├── AppIcon.tsx
    │   │   ├── AppShell.module.css
    │   │   ├── AppShell.tsx
    │   │   ├── AppSidebar.tsx
    │   │   ├── navbarContext.ts
    │   │   ├── TopNavbar.module.css
    │   │   └── TopNavbar.tsx
    │   ├── space/
    │   │   ├── Earth3D.tsx
    │   │   ├── earthMaterials.ts
    │   │   ├── HomeEarth.module.css
    │   │   ├── HomeEarth.tsx
    │   │   ├── SpaceBackground.module.css
    │   │   ├── SpaceBackground.tsx
    │   │   └── starData.ts
    │   └── ImageAttachmentField.tsx
    │
    ├── features/
    │   ├── chat/
    │   │   └── hooks/
    │   │       └── useChat.ts
    │   ├── comments/
    │   │   ├── api/
    │   │   │   └── comments.ts
    │   │   ├── components/
    │   │   │   ├── CommentForm.module.css
    │   │   │   ├── CommentForm.tsx
    │   │   │   ├── CommentList.module.css
    │   │   │   ├── CommentList.tsx
    │   │   │   ├── CommentsSection.module.css
    │   │   │   └── CommentsSection.tsx
    │   │   └── types/
    │   │       └── comment.ts
    │   ├── groups/
    │   │   ├── api/
    │   │   │   └── groups.ts
    │   │   ├── components/
    │   │   │   ├── events/
    │   │   │   │   ├── CreateEventModal.tsx
    │   │   │   │   ├── EventAttendees.tsx
    │   │   │   │   ├── EventCard.tsx
    │   │   │   │   ├── EventCountdown.tsx
    │   │   │   │   └── GroupEvents.tsx
    │   │   │   ├── galaxy/
    │   │   │   │   ├── GroupGalaxy.module.css
    │   │   │   │   ├── GroupGalaxy.tsx
    │   │   │   │   └── GroupStar.tsx
    │   │   │   ├── management/
    │   │   │   │   ├── CreateGroupForm.tsx
    │   │   │   │   ├── EditGroupForm.tsx
    │   │   │   │   ├── GroupDangerZone.tsx
    │   │   │   │   ├── GroupInviteModal.tsx
    │   │   │   │   ├── GroupInviteSearch.tsx
    │   │   │   │   ├── InviteUserSearch.tsx
    │   │   │   │   └── SelectedInviteList.tsx
    │   │   │   ├── GroupAvatar.tsx
    │   │   │   ├── GroupCard.tsx
    │   │   │   ├── GroupDetailsContent.tsx
    │   │   │   ├── GroupJoinButton.tsx
    │   │   │   ├── GroupPanels.tsx
    │   │   │   ├── GroupPreviewPanel.tsx
    │   │   │   ├── GroupResponseActions.tsx
    │   │   │   ├── GroupSearchInput.tsx
    │   │   │   ├── GroupsFilterTabs.tsx
    │   │   │   ├── GroupsPageContent.tsx
    │   │   │   ├── GroupStateSync.tsx
    │   │   │   └── GroupTabs.tsx
    │   │   ├── context/
    │   │   │   └── GroupsSearchProvider.tsx
    │   │   ├── hooks/
    │   │   │   ├── useDebouncedValue.ts
    │   │   │   ├── useGroupAction.ts
    │   │   │   ├── useGroupData.ts
    │   │   │   ├── useGroupInvitation.ts
    │   │   │   ├── useGroupJoinRequest.ts
    │   │   │   └── useInviteUserSearch.ts
    │   │   ├── types/
    │   │   │   ├── api.ts
    │   │   │   └── group.ts
    │   │   └── utils/
    │   │       └── orbitLayout.ts
    │   ├── notifications/
    │   │   ├── api/
    │   │   │   └── notifications.ts
    │   │   ├── components/
    │   │   │   ├── NotificationBell.tsx
    │   │   │   ├── NotificationDropdown.tsx
    │   │   │   ├── NotificationInbox.tsx
    │   │   │   └── NotificationItem.tsx
    │   │   ├── context/
    │   │   │   └── NotificationProvider.tsx
    │   │   ├── hooks/
    │   │   │   ├── useNotificationNavigate.ts
    │   │   │   └── useNotificationSync.ts
    │   │   ├── types/
    │   │   │   └── notification.ts
    │   │   └── utils/
    │   │       └── mergeNotifications.ts
    │   ├── posts/
    │   │   ├── api/
    │   │   │   └── posts.ts
    │   │   ├── components/
    │   │   │   ├── home/
    │   │   │   │   ├── ExpandedPost.tsx
    │   │   │   │   ├── HomeOrbitalFeed.module.css
    │   │   │   │   ├── HomeOrbitalFeed.tsx
    │   │   │   │   └── OrbitalPost.tsx
    │   │   │   ├── NewPostForm.tsx
    │   │   │   ├── PostCard.module.css
    │   │   │   ├── PostCard.tsx
    │   │   │   ├── PostFeed.tsx
    │   │   │   └── PostForm.tsx
    │   │   └── types/
    │   │       └── post.ts
    │   ├── profile/
    │   │   ├── api/
    │   │   │   └── profiles.ts
    │   │   ├── components/
    │   │   │   ├── Profile.module.css
    │   │   │   ├── ProfileContent.tsx
    │   │   │   ├── ProfileHeader.tsx
    │   │   │   ├── ProfilePage.tsx
    │   │   │   ├── ProfilePrivacy.tsx
    │   │   │   ├── ProfilePrivacyCard.tsx
    │   │   │   ├── ProfileState.tsx
    │   │   │   └── ProfileUserList.tsx
    │   │   └── types/
    │   │       └── profile.ts
    │   └── universe-transition/
    │       ├── animation.ts
    │       ├── README.md
    │       ├── types.ts
    │       ├── UniverseTransition.module.css
    │       ├── UniverseTransitionLayer.tsx
    │       └── UniverseTransitionProvider.tsx
    │
    ├── lib/
    │   ├── api/
    │   │   ├── client.ts
    │   │   └── errors.ts
    │   ├── websocket/
    │   │   └── types.ts
    │   ├── api.ts
    │   └── upload.ts
    │
    └── providers/
        └── WebSocketProvider.tsx
```

---

# Excluded Files Reference

Per instructions, the following items were intentionally excluded from source checklist tracking:
1. `src/app/favicon.ico`: Static binary asset (icon), not source code.
2. `public/models/earth-final.glb`: Static binary 3D asset model loaded at runtime by `Earth3D.tsx`.
3. `public/*.svg`: Static SVG icon files (`globe.svg`, `window.svg`, `file.svg`, `next.svg`, `vercel.svg`).
4. `node_modules/`, `.next/`, `build/`, `dist/`: Generated build outputs and external npm packages.
5. `pnpm-lock.yaml`, `package-lock.json`: Dependency lockfiles.
6. `tsconfig.tsbuildinfo`: TypeScript incremental build cache.

