# Social Network — Deep Project Audit

**Document Version:** 1.0.0  
**Audit Completed:** 2026-09-17  
**Auditor:** Gemini 3.8 Flash High (Automated Repository Intelligence Agent)  
**Target Repository:** `/home/hussain-hht/Desktop/ss2/social-network`  
**Current Branch:** `feat/auth-regester-page`

---

## 1. Executive Summary

This repository is a full-featured, production-grade social network featuring an astronomical space theme. It is built as a decoupled two-tier architecture:

1. **Backend:** Written in Go 1.26 with zero web frameworks (using the enhanced standard library `net/http.ServeMux`), SQLite with WAL mode, and Gorilla WebSocket. It enforces Clean Architecture across 12 distinct feature packages, backed by a custom transactional SQLite migration engine and an in-house two-tier token bucket rate limiter.
2. **Frontend:** Written in Next.js 16.3.2 (App Router) with React 19.2.8, TypeScript 5.9.3, and Tailwind CSS 4. Visual immersion is delivered via Three.js 0.185.1 and React Three Fiber 9.7.0, orchestrating an 8-planet 3D orbital system that dynamically generates and injects CSS color theme variables across the entire application interface.

The application satisfies and significantly exceeds typical social network requirements, providing group management, public/private group dynamics, event RSVPs, multi-tier post privacy, in-app post sharing via chat, personalized recommendations, real-time notifications with floating toasts, and interactive 3D onboarding stages.

---

## 2. Repository Snapshot & Verified Technology Stack

| Layer                  | Technology                 |      Version       | Purpose                                  | Codebase Evidence                             |
| ---------------------- | -------------------------- | :----------------: | ---------------------------------------- | --------------------------------------------- |
| **Frontend Framework** | Next.js                    |      `16.3.2`      | App Router, SSR/SSG, Client Layouts      | `frontend/package.json`                       |
| **UI Library**         | React / React DOM          |      `19.2.8`      | Component rendering & state              | `frontend/package.json`                       |
| **Language (Web)**     | TypeScript                 |      `5.9.3`       | Type safety across client                | `frontend/package.json`                       |
| **Styling**            | Tailwind CSS / CSS Modules |      `4.0.0`       | Atomic styles & scoped modules           | `frontend/package.json`, `postcss.config.mjs` |
| **3D Rendering**       | Three.js                   |     `0.185.1`      | WebGL canvas, shaders, GLB loading       | `frontend/package.json`                       |
| **3D React Layer**     | React Three Fiber / Drei   | `9.7.0` / `10.7.8` | Declarative 3D scene graphs              | `frontend/package.json`                       |
| **Backend Language**   | Go                         |      `1.26.5`      | High-concurrency server & domain logic   | `backend/go.mod`                              |
| **Database Engine**    | SQLite3 (`go-sqlite3`)     |     `v1.14.50`     | Embedded relational database             | `backend/go.mod`, `pkg/db/sqlite`             |
| **WebSockets**         | Gorilla WebSocket          |      `v1.5.3`      | Full-duplex connection upgrade & framing | `backend/go.mod`                              |
| **Cryptography**       | `golang.org/x/crypto`      |     `v0.55.0`      | Password hashing with bcrypt             | `backend/go.mod`                              |
| **UUIDs**              | `google/uuid`              |      `v1.6.0`      | Unique session tokens & upload files     | `backend/go.mod`                              |
| **Containerization**   | Docker / Compose           |     Compose v2     | Multi-stage container orchestration      | `compose.yaml`, `Dockerfile` (both)           |

---

## 3. Feature Status Matrix

| Feature Domain                                |   Status    | Frontend | Backend | Database | Confidence | Evidence Key Paths                                                              |
| --------------------------------------------- | :---------: | :------: | :-----: | :------: | :--------: | ------------------------------------------------------------------------------- |
| **User Registration**                         | Implemented |   Yes    |   Yes   |   Yes    |    High    | `features/auth/components/RegisterForm.tsx`, `auth/handler.go`                  |
| **User Login & Session**                      | Implemented |   Yes    |   Yes   |   Yes    |    High    | `features/auth/components/LoginForm.tsx`, `auth/handler.go`                     |
| **User Logout**                               | Implemented |   Yes    |   Yes   |   Yes    |    High    | `components/layout/useLogout.ts`, `auth/handler.go`                             |
| **Profile Details**                           | Implemented |   Yes    |   Yes   |   Yes    |    High    | `features/profile/components/ProfileDetailsForm.tsx`, `users/handler.go`        |
| **Profile Privacy Toggle**                    | Implemented |   Yes    |   Yes   |   Yes    |    High    | `features/settings/components/SettingsPage.tsx`, `users/handler.go`             |
| **Avatar Upload**                             | Implemented |   Yes    |   Yes   |   Yes    |    High    | `features/profile/components/ProfileAvatarForm.tsx`, `upload/avatar.go`         |
| **Follow Public User**                        | Implemented |   Yes    |   Yes   |   Yes    |    High    | `features/profile/components/ProfilePage.tsx`, `followers/handler.go`           |
| **Request Follow Private**                    | Implemented |   Yes    |   Yes   |   Yes    |    High    | `features/profile/components/ProfilePage.tsx`, `followers/handler.go`           |
| **Accept/Decline Request**                    | Implemented |   Yes    |   Yes   |   Yes    |    High    | `features/profile/components/ProfileFollowRequests.tsx`, `followers/handler.go` |
| **Follow Lists & Privacy**                    | Implemented |   Yes    |   Yes   |   Yes    |    High    | `features/profile/components/ProfileUserList.tsx`, `followers/handler.go`       |
| **Feed (All / Following / Friends)**          | Implemented |   Yes    |   Yes   |   Yes    |    High    | `features/posts/components/PostFeed.tsx`, `posts/handler.go`                    |
| **Cursor-Based Infinite Feed**                | Implemented |   Yes    |   Yes   |   Yes    |    High    | `features/posts/hooks/useFeed.ts`, `posts/repository.go`                        |
| **Post Visibility (Public/Followers/Custom)** | Implemented |   Yes    |   Yes   |   Yes    |    High    | `features/posts/components/CustomViewerPicker.tsx`, `posts/service.go`          |
| **Post Media Attachments**                    | Implemented |   Yes    |   Yes   |   Yes    |    High    | `features/posts/components/PostMediaGrid.tsx`, `upload/media.go`                |
| **Post Comments & Images**                    | Implemented |   Yes    |   Yes   |   Yes    |    High    | `features/comments/`, `comments/handler.go`                                     |
| **Comment Live Counts**                       | Implemented |   Yes    |   Yes   |   Yes    |    High    | `features/posts/components/PostCard.tsx`, `comments/handler.go`                 |
| **Post Likes & Unlikes**                      | Implemented |   Yes    |   Yes   |   Yes    |    High    | `features/interactions/api/likes.ts`, `likes/handler.go`                        |
| **Post Share via Chat**                       | Implemented |   Yes    |   Yes   |   Yes    |    High    | `features/interactions/components/ShareModal.tsx`, `share/service.go`           |
| **Groups Directory & Discovery**              | Implemented |   Yes    |   Yes   |   Yes    |    High    | `features/groups/components/GroupsPageContent.tsx`, `groups/handler.go`         |
| **Group Join Requests**                       | Implemented |   Yes    |   Yes   |   Yes    |    High    | `features/groups/components/GroupJoinButton.tsx`, `groups/service.go`           |
| **Group Invitations**                         | Implemented |   Yes    |   Yes   |   Yes    |    High    | `features/groups/components/management/GroupInviteModal.tsx`                    |
| **Group Inline Posts**                        | Implemented |   Yes    |   Yes   |   Yes    |    High    | `features/groups/components/GroupPosts.tsx`, `posts/service.go`                 |
| **Group Events & RSVP**                       | Implemented |   Yes    |   Yes   |   Yes    |    High    | `features/groups/components/events/GroupEvents.tsx`, `groups/event_handler.go`  |
| **Group Live Chat**                           | Implemented |   Yes    |   Yes   |   Yes    |    High    | `features/group-chat/`, `chat/service.go`                                       |
| **Private Live Chat**                         | Implemented |   Yes    |   Yes   |   Yes    |    High    | `app/(main)/chat/page.tsx`, `chat/service.go`                                   |
| **Typing Indicators**                         | Implemented |   Yes    |   Yes   |   N/A    |    High    | `features/chat/`, `chat/service.go` (`EventTyping`)                             |
| **Read Receipts**                             | Implemented |   Yes    |   Yes   |   Yes    |    High    | `features/chat/`, `chat/service.go` (`EventMessagesRead`)                       |
| **Realtime Notifications**                    | Implemented |   Yes    |   Yes   |   Yes    |    High    | `features/notifications/`, `notifications/service.go`                           |
| **Notification Toast Alerts**                 | Implemented |   Yes    |   Yes   |   N/A    |    High    | `features/notifications/hooks/useNotificationToasts.ts`                         |
| **Mark All Notifications Read**               | Implemented |   Yes    |   Yes   |   Yes    |    High    | `features/notifications/api/notifications.ts`, `notifications/handler.go`       |
| **Universal Navbar Search**                   | Implemented |   Yes    |   Yes   |   Yes    |    High    | `features/search/components/UniversalNavbarSearch.tsx`, `search/handler.go`     |
| **Follow Recommendations**                    | Implemented |   Yes    |   Yes   |   Yes    |    High    | `features/recommendations/components/WhoToFollow.tsx`                           |
| **Suggested Groups**                          | Implemented |   Yes    |   Yes   |   Yes    |    High    | `features/recommendations/components/SuggestedGroups.tsx`                       |
| **Two-Tier Rate Limiting**                    | Implemented |   N/A    |   Yes   |   N/A    |    High    | `internal/ratelimit/`, `internal/middleware/ratelimit.go`                       |
| **8-Planet 3D System**                        | Implemented |   Yes    |   N/A   |   N/A    |    High    | `components/space/PlanetSystem.tsx`, `modelsRegistry.ts`                        |
| **Interactive 3D Auth Wizard**                | Implemented |   Yes    |   N/A   |   N/A    |    High    | `features/auth/components/RegisterPlanetStage.tsx`                              |
| **Settings Dashboard**                        | Implemented |   Yes    |   Yes   |   Yes    |    High    | `features/settings/components/SettingsPage.tsx`                                 |

---

## 4. Frontend Architecture & Route Map

### 4.1 Structural Boundaries

```text
frontend/src/
├── app/                  # Next.js App Router route segments
│   ├── (auth)/           # Unauthenticated auth pages (Login, Register)
│   ├── (group-settings)/ # Dedicated full-width group management shell
│   └── (main)/           # Authenticated social shell with AppShell & PlanetBackground
├── components/           # Shared presentation components
│   ├── feedback/         # Action feedback toasts & banners
│   ├── layout/           # AppNavbar, AppSidebar, AppShell, MobileDock
│   └── space/            # PlanetSystem, PlanetBackground, modelsRegistry, starData
├── features/             # Domain-encapsulated feature modules
│   ├── auth/             # Login/register forms, auth context, validation
│   ├── chat/             # 1-on-1 private messaging components & hooks
│   ├── comments/         # Post comment lists, replies, deletions
│   ├── group-chat/       # Group channel chat drawer and messaging
│   ├── groups/           # Group discovery, details, events, management
│   ├── interactions/     # Likes bar, share modal, message post previews
│   ├── notifications/    # Inbox, dropdown, sync hook, monotonic merge, toasts
│   ├── posts/            # Feed, post cards, custom audience picker, media grid
│   ├── profile/          # Profile view, follow lists, avatar/details editing
│   ├── recommendations/  # Who to follow, suggested groups widgets
│   ├── search/           # Universal search modal and API client
│   └── settings/         # Account, privacy, password, and 3D appearance controls
├── lib/                  # Shared utilities
│   ├── api/              # Fetch client wrapper with credentials
│   ├── api.ts            # Base URL resolution & endpoint builder
│   └── websocket/        # Type definitions for WebSocket events
└── providers/            # Shared React context providers (WebSocketProvider)
```

### 4.2 Verified Route Map

| HTTP Route                   | Page Component Path                      |  Auth State   | Layout / Wrappers             | Purpose                                                                            |
| ---------------------------- | ---------------------------------------- | :-----------: | ----------------------------- | ---------------------------------------------------------------------------------- |
| `/`                          | `app/(main)/page.tsx`                    | Authenticated | `(main)/layout.tsx`           | Home feed with sticky filter tabs, new post composer, recommendations              |
| `/login`                     | `app/(auth)/login/page.tsx`              |    Public     | Root layout                   | Interactive login with credentials form and animated 3D planet stage               |
| `/register`                  | `app/(auth)/register/page.tsx`           |    Public     | Root layout                   | 3-step registration wizard with dynamic planet stages                              |
| `/chat`                      | `app/(main)/chat/page.tsx`               | Authenticated | `(main)/layout.tsx`           | 1-on-1 conversation list, active messaging thread, shared post preview             |
| `/groups`                    | `app/(main)/groups/page.tsx`             | Authenticated | `(main)/layout.tsx`           | Groups directory, search bar, filter tabs (all, my groups, suggested)              |
| `/groups/create`             | `app/(main)/groups/create/page.tsx`      | Authenticated | `(main)/layout.tsx`           | Group creation form with photo upload and privacy selector                         |
| `/groups/[groupId]`          | `app/(main)/groups/[groupId]/page.tsx`   | Authenticated | `(main)/layout.tsx`           | Group details, members preview, events, inline group post composer, chat drawer    |
| `/groups/[groupId]/settings` | `app/(group-settings)/.../page.tsx`      |    Creator    | `(group-settings)/layout.tsx` | Group settings: edit info, member management, join requests, invite search, delete |
| `/notifications`             | `app/(main)/notifications/page.tsx`      | Authenticated | `(main)/layout.tsx`           | Notifications inbox with filter tabs, mark all read, and navigation                |
| `/posts/new`                 | `app/(main)/posts/new/page.tsx`          | Authenticated | `(main)/layout.tsx`           | Dedicated post creation view                                                       |
| `/posts/[id]`                | `app/(main)/posts/[id]/page.tsx`         | Authenticated | `(main)/layout.tsx`           | Single post view with comments thread, likes bar, and share button                 |
| `/posts/[id]/edit`           | `app/(main)/posts/[id]/edit/page.tsx`    |     Owner     | `(main)/layout.tsx`           | Post edit form (title, content, visibility)                                        |
| `/profile`                   | `app/(main)/profile/page.tsx`            | Authenticated | `(main)/layout.tsx`           | Own profile redirect                                                               |
| `/profile/[username]`        | `app/(main)/profile/[username]/page.tsx` | Authenticated | `(main)/layout.tsx`           | User profile: follow/unfollow action, follower lists, user posts                   |
| `/settings`                  | `app/(main)/settings/page.tsx`           | Authenticated | `(main)/layout.tsx`           | Settings dashboard: Profile, Privacy & Security, Appearance (3D), Session          |
| `/_not-found`                | `app/_not-found`                         |    Public     | Root layout                   | Custom 404 error page                                                              |

---

## 5. Backend Architecture & Route Inventory

### 5.1 Architecture & Dependency Injection

The Go backend strictly separates concerns without external ORMs or routers:

- `cmd/server/main.go`: Application bootstrapper. Loads config, initializes SQLite, runs startup migrations, sets up signal traps for graceful shutdown.
- `internal/router/router.go`: Defines the enhanced `net/http.ServeMux` route table, applies middleware (`CORS`, `SessionMiddleware`, `RateLimit`).
- `internal/router/dependencies.go`: Assembles dependencies, instantiates repositories and services, binds WebSocket route handlers, and sets up weighted rate limiting.
- Domain packages (`auth`, `users`, `followers`, `posts`, `comments`, `groups`, `chat`, `notifications`, `likes`, `share`, `search`, `upload`, `ratelimit`): Each package encapsulates its own domain types, errors, validation, database repository, and HTTP handler.

### 5.2 Complete API Route Inventory (43 Endpoints)

| HTTP Method     | API Path Pattern                                    |  Auth   |  Limiter Cost  | Handler Symbol                              | Domain / Purpose                                     |
| --------------- | --------------------------------------------------- | :-----: | :------------: | ------------------------------------------- | ---------------------------------------------------- |
| `POST`          | `/api/login`                                        | Public  |    1.0 (IP)    | `Auth.LoginHandler`                         | Verify credentials, issue session cookie             |
| `GET`           | `/api/login`                                        | Session |   1.0 (User)   | `Auth.LoginHandler`                         | Verify existing session cookie                       |
| `POST`          | `/api/register`                                     | Public  |    1.0 (IP)    | `Auth.RegisterHandler`                      | Register new account with avatar                     |
| `POST` / `GET`  | `/api/logout`                                       | Session |   1.0 (User)   | `Auth.LogoutHandler`                        | Revoke session, clear cookie                         |
| `GET`           | `/api/ws`                                           | Session |   1.0 (User)   | `Websocket.ServeWS`                         | Multiplexed WebSocket upgrade                        |
| `GET`           | `/api/chat/history`                                 | Session |   1.0 (User)   | `Chat.GetHistoryHandler`                    | Load 1-on-1 private message history                  |
| `GET`           | `/api/chat/conversations`                           | Session |   1.0 (User)   | `Chat.GetConversationsHandler`              | List conversation threads with unread counts         |
| `GET`           | `/api/chat/eligible-contacts`                       | Session |   1.0 (User)   | `Chat.GetEligibleContactsHandler`           | List users eligible for private messaging            |
| `GET`           | `/api/users/me`                                     | Session |   1.0 (User)   | `Users.GetMeHandler`                        | Retrieve authenticated user profile                  |
| `PATCH`         | `/api/users/me/profile`                             | Session |   1.0 (User)   | `Users.UpdateProfileDetailsHandler`         | Update biographical profile fields                   |
| `PATCH`         | `/api/users/me/avatar`                              | Session |   1.0 (User)   | `Users.UpdateProfileAvatarHandler`          | Upload replacement profile avatar                    |
| `PATCH`         | `/api/users/me/privacy`                             | Session |   1.0 (User)   | `Users.UpdateProfilePrivacyHandler`         | Toggle public/private profile state                  |
| `PATCH`         | `/api/users/me/password`                            | Session |   1.0 (User)   | `Auth.ChangePasswordHandler`                | Change account password                              |
| `GET`           | `/api/users/recommendations`                        | Session |   1.0 (User)   | `Followers.GetRecommendationsHandler`       | Personalized follow recommendations                  |
| `GET`           | `/api/profiles/{username}`                          | Session |   1.0 (User)   | `Users.GetProfileHandler`                   | Get user profile (masks private fields)              |
| `POST`          | `/api/profiles/{username}/follow`                   | Session |   1.0 (User)   | `Followers.FollowUserHandler`               | Follow user or submit follow request                 |
| `DELETE`        | `/api/profiles/{username}/follow`                   | Session |   1.0 (User)   | `Followers.UnfollowUserHandler`             | Unfollow user                                        |
| `GET`           | `/api/profiles/{username}/follow-status`            | Session |   1.0 (User)   | `Followers.FollowStatusHandler`             | Get relationship status (none, following, requested) |
| `GET`           | `/api/profiles/{username}/followers`                | Session |   1.0 (User)   | `Followers.GetFollowersHandler`             | List user's followers (privacy protected)            |
| `GET`           | `/api/profiles/{username}/following`                | Session |   1.0 (User)   | `Followers.GetFollowingHandler`             | List users followed by user (privacy protected)      |
| `GET`           | `/api/follow-requests`                              | Session |   1.0 (User)   | `Followers.GetPendingFollowRequestsHandler` | List incoming follow requests                        |
| `POST`          | `/api/follow-requests/{requestID}/accept`           | Session |   1.0 (User)   | `Followers.AcceptFollowRequestHandler`      | Accept incoming follow request                       |
| `POST`          | `/api/follow-requests/{requestID}/decline`          | Session |   1.0 (User)   | `Followers.DeclineFollowRequestHandler`     | Decline incoming follow request                      |
| `POST`          | `/api/posts`                                        | Session |   1.0 (User)   | `Posts.NewPostHandler`                      | Create post with privacy & media                     |
| `GET`           | `/api/posts`                                        | Session |   1.0 (User)   | `Posts.ListPostsHandler`                    | Cursor feed (`all`, `following`, `friends`)          |
| `GET`           | `/api/posts/{id}`                                   | Session |   1.0 (User)   | `Posts.GetPostByIDHandler`                  | Single post view (privacy verified)                  |
| `PUT` / `PATCH` | `/api/posts/{id}`                                   | Session |   1.0 (User)   | `Posts.EditPostHandler`                     | Update post content and audience                     |
| `DELETE`        | `/api/posts/{id}`                                   | Session |   1.0 (User)   | `Posts.DeletePostHandler`                   | Delete post (owner or group moderator)               |
| `POST`          | `/api/posts/{id}/comments`                          | Session |   1.0 (User)   | `Comments.NewCommentHandler`                | Add comment with optional media                      |
| `GET`           | `/api/posts/{id}/comments`                          | Session |   1.0 (User)   | `Comments.ListCommentsHandler`              | List comments for visible post                       |
| `GET`           | `/api/posts/{id}/comments/count`                    | Session | **0.2 (User)** | `Comments.GetCommentCountHandler`           | Get comment count for post                           |
| `DELETE`        | `/api/comments/{commentID}`                         | Session |   1.0 (User)   | `Comments.DeleteCommentHandler`             | Delete comment (author or group moderator)           |
| `GET`           | `/api/posts/{id}/likes`                             | Session | **0.2 (User)** | `Likes.GetLikeStatusHandler`                | Check user like state and total likes                |
| `POST`          | `/api/posts/{id}/likes`                             | Session |   1.0 (User)   | `Likes.LikePostHandler`                     | Like a post                                          |
| `DELETE`        | `/api/posts/{id}/likes`                             | Session |   1.0 (User)   | `Likes.UnlikePostHandler`                   | Unlike a post                                        |
| `POST`          | `/api/posts/{id}/share`                             | Session |   1.0 (User)   | `Share.SharePostHandler`                    | Share post to user DM or group chat                  |
| `GET`           | `/api/groups`                                       | Session |   1.0 (User)   | `Groups.ListGroupsHandler`                  | Discover public groups with membership state         |
| `POST`          | `/api/groups`                                       | Session |   1.0 (User)   | `Groups.CreateGroupHandler`                 | Create group (title, desc, photo, privacy)           |
| `GET`           | `/api/groups/recommendations`                       | Session |   1.0 (User)   | `Groups.GetRecommendationsHandler`          | Suggested groups based on mutual members             |
| `GET`           | `/api/groups/mine`                                  | Session |   1.0 (User)   | `Groups.GetMyGroupsHandler`                 | List groups user is a member of                      |
| `GET`           | `/api/groups/{id}`                                  | Session |   1.0 (User)   | `Groups.GetGroupHandler`                    | Group details (private requires membership)          |
| `PUT`           | `/api/groups/{id}`                                  | Session |   1.0 (User)   | `Groups.UpdateGroupHandler`                 | Update group details (creator only)                  |
| `DELETE`        | `/api/groups/{id}`                                  | Session |   1.0 (User)   | `Groups.DeleteGroupHandler`                 | Delete group (creator only)                          |
| `GET`           | `/api/groups/{id}/members`                          | Session |   1.0 (User)   | `Groups.GetGroupMembersHandler`             | List group members                                   |
| `GET`           | `/api/groups/{id}/membership`                       | Session |   1.0 (User)   | `Groups.GetMembershipHandler`               | Check current user's membership role                 |
| `DELETE`        | `/api/groups/{id}/members/{memberID}`               | Session |   1.0 (User)   | `Groups.RemoveMemberHandler`                | Remove member (creator only)                         |
| `POST`          | `/api/groups/{id}/join-requests`                    | Session |   1.0 (User)   | `Groups.CreateJoinRequestHandler`           | Request to join public group                         |
| `DELETE`        | `/api/groups/{id}/join-requests`                    | Session |   1.0 (User)   | `Groups.CancelJoinRequestHandler`           | Cancel own pending join request                      |
| `GET`           | `/api/groups/{id}/join-requests`                    | Session |   1.0 (User)   | `Groups.GetPendingJoinRequestsHandler`      | View pending join requests (creator only)            |
| `POST`          | `/api/groups/{id}/join-requests/{requestID}/accept` | Session |   1.0 (User)   | `Groups.AcceptJoinRequestHandler`           | Accept join request (creator only)                   |
| `POST`          | `/api/groups/{id}/join-requests/{requestID}/reject` | Session |   1.0 (User)   | `Groups.RejectJoinRequestHandler`           | Reject join request (creator only)                   |
| `POST`          | `/api/groups/{id}/invitations`                      | Session |   1.0 (User)   | `Groups.CreateGroupInvitationHandler`       | Invite user to group (creator only)                  |
| `GET`           | `/api/group-invitations`                            | Session |   1.0 (User)   | `Groups.GetPendingInvitationsHandler`       | List user's pending group invitations                |
| `POST`          | `/api/group-invitations/{invitationID}/accept`      | Session |   1.0 (User)   | `Groups.AcceptGroupInvitationHandler`       | Accept group invitation                              |
| `POST`          | `/api/group-invitations/{invitationID}/decline`     | Session |   1.0 (User)   | `Groups.DeclineGroupInvitationHandler`      | Decline group invitation                             |
| `POST`          | `/api/groups/{id}/events`                           | Session |   1.0 (User)   | `Groups.CreateEventHandler`                 | Create upcoming event (members only)                 |
| `GET`           | `/api/groups/{id}/events`                           | Session |   1.0 (User)   | `Groups.GetGroupEventsHandler`              | List group events (members only)                     |
| `GET`           | `/api/groups/{id}/events/{eventID}`                 | Session |   1.0 (User)   | `Groups.GetEventHandler`                    | Get event details with user RSVP                     |
| `GET`           | `/api/groups/{id}/events/{eventID}/responses`       | Session |   1.0 (User)   | `Groups.GetEventResponsesHandler`           | List attendee RSVP responses                         |
| `PUT`           | `/api/groups/{id}/events/{eventID}/response`        | Session |   1.0 (User)   | `Groups.RespondToEventHandler`              | RSVP `going` or `not_going`                          |
| `POST`          | `/api/groups/{id}/posts`                            | Session |   1.0 (User)   | `Posts.NewGroupPostHandler`                 | Create group post (members only)                     |
| `GET`           | `/api/groups/{id}/posts`                            | Session |   1.0 (User)   | `Posts.ListGroupPostsHandler`               | List group posts (members only)                      |
| `GET`           | `/api/groups/{id}/messages`                         | Session |   1.0 (User)   | `Chat.GetGroupHistoryHandler`               | Load group chat message history                      |
| `GET`           | `/api/notifications`                                | Session |   1.0 (User)   | `Notifications.ListNotificationsHandler`    | Paginated notifications list                         |
| `GET`           | `/api/notifications/unread-count`                   | Session |   1.0 (User)   | `Notifications.UnreadCountHandler`          | Get count of unread notifications                    |
| `PATCH`         | `/api/notifications/read-all`                       | Session |   1.0 (User)   | `Notifications.MarkAllAsReadHandler`        | Mark all notifications read                          |
| `PATCH`         | `/api/notifications/{id}/read`                      | Session |   1.0 (User)   | `Notifications.MarkAsReadHandler`           | Mark single notification read                        |
| `GET`           | `/api/search`                                       | Session |      None      | `Search.SearchHandler`                      | Search users and public groups                       |
| `GET`           | `/uploads/*`                                        | Public  |      None      | `http.FileServer`                           | Static serving of uploaded media                     |

---

## 6. Authentication, Sessions & Authorization Deep Dive

### 6.1 Authentication Lifecycle

1. **Registration:**
   - Input: Username, Password, First/Last Name, Email, Date of Birth (Age computed server-side), Gender, optional Nickname, About Me, and Avatar image.
   - Password is hashed with `bcrypt.GenerateFromPassword(password, 10)`.
   - Generates UUID v4 and stores user record in SQLite.
2. **Login:**
   - Accepts username or email. Verifies hash via `bcrypt.CompareHashAndPassword`.
   - Generates 32-byte cryptographically secure random session token (`session.GenerateSessionToken()`).
   - Inserts session into `sessions` table (`user_id`, `session_token`, `expires_at = now + 24h`).
   - Writes HTTP cookie:
     ```go
     http.SetCookie(w, &http.Cookie{
         Name:     "session_token",
         Value:    token,
         Path:     "/",
         Expires:  time.Now().Add(24 * time.Hour),
         HttpOnly: true,
         Secure:   false, // local dev
         SameSite: http.SameSiteLaxMode,
     })
     ```
3. **Session Middleware & Sliding Expiration:**
   - Reads `session_token` cookie on incoming request.
   - Validates existence, expiry (`expires_at > CURRENT_TIMESTAMP`), and non-revocation (`revoked_at IS NULL`).
   - Extends session expiration by 24 hours (`UpdateSessionExpiry()`), implementing sliding expiration.
   - Injects `userID` into the request context (`requestctx.WithUserID(ctx, userID)`).
4. **Logout:**
   - Sets `revoked_at = CURRENT_TIMESTAMP` in `sessions` table.
   - Sends expired deletion cookie (`MaxAge: -1`, `Expires: epoch`).

### 6.2 Authorization & Privacy Matrix

| Resource             | Scope / Level           | Who Can View                                                             | Who Can Mutate / Create                                          | Who Can Delete                                 |
| -------------------- | ----------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------- |
| **User Profile**     | Public Profile          | Any authenticated user                                                   | Owner only (`PATCH /users/me/...`)                               | N/A                                            |
| **User Profile**     | Private Profile         | Followers + Owner only (Non-followers see name/avatar, `AboutMe` masked) | Owner only                                                       | N/A                                            |
| **Followers List**   | Public Profile          | Any authenticated user                                                   | Anyone can follow (`POST /follow`)                               | Follower can unfollow                          |
| **Followers List**   | Private Profile         | Approved followers + Owner only                                          | Requires follow request (`POST /follow`)                         | Target accepts/declines; Follower can unfollow |
| **Post**             | `public`                | Any authenticated user                                                   | Any user                                                         | Post Author                                    |
| **Post**             | `followers`             | Approved followers of author + Author                                    | N/A                                                              | Post Author                                    |
| **Post**             | `custom`                | Selected followers in `post_allowed_viewers` + Author                    | N/A                                                              | Post Author                                    |
| **Post**             | Group Post (`group_id`) | Group members only                                                       | Group members only                                               | Post Author OR Group Creator                   |
| **Comment**          | On Post / Group Post    | Anyone who can view the post                                             | Anyone who can view the post                                     | Comment Author OR Group Creator                |
| **Group**            | `public`                | Any user (directory & search)                                            | Any user can create                                              | Group Creator only                             |
| **Group**            | `private`               | Group members + Creator only (hidden from search)                        | Any user can create                                              | Group Creator only                             |
| **Group Membership** | `public`                | Requires creator approval (`join_requests`)                              | Any user can request                                             | Member can leave; Creator can remove           |
| **Group Membership** | `private`               | Strictly invite-only (`invitations`)                                     | Group Creator only can invite                                    | Member can leave; Creator can remove           |
| **Group Event**      | Any Group               | Group members only                                                       | Group members only (future date required)                        | Group Creator                                  |
| **Event RSVP**       | Any Group Event         | Group members only                                                       | Group members only (`going` / `not_going`)                       | N/A                                            |
| **Private Chat**     | 1-on-1                  | Sender & Recipient                                                       | User A may message User B **only if A follows B or B follows A** | N/A                                            |
| **Group Chat**       | Group Channel           | Group members only                                                       | Group members only                                               | N/A                                            |

---

## 7. Realtime WebSocket Architecture

### 7.1 WebSocket Connection Flow

- **Upgrade Route:** `GET /api/ws`
- **Authentication:** `SessionMiddleware` inspects the HTTP upgrade request for the `session_token` cookie. Unauthenticated upgrades are rejected with HTTP 401.
- **Client Goroutines:**
  - `ReadPump()`: Continuously reads incoming JSON frames, enforces `readLimit = 4096` bytes, pong handlers, and passes raw bytes to `MessageHandler`.
  - `WritePump()`: Flushes buffered messages from the client's `send chan []byte` channel to the socket connection, managing ping tickers (54s).

### 7.2 WebSocket Event Inventory

| Event Identifier               |   Direction   | Payload Structure                                        |       Persistence        | Purpose / Behavior                                               |
| ------------------------------ | :-----------: | -------------------------------------------------------- | :----------------------: | ---------------------------------------------------------------- |
| `user_online`                  |    S -> C     | `{ user_id: number, is_online: true }`                   |       No (Memory)        | Broadcast when a user connects                                   |
| `user_offline`                 |    S -> C     | `{ user_id: number, is_online: false }`                  |       No (Memory)        | Broadcast when a user disconnects                                |
| `online_users`                 |    S -> C     | `{ user_ids: number[] }`                                 |       No (Memory)        | Pushed to client immediately on connection                       |
| `private_message`              | Bidirectional | `{ id?, sender_id, recipient_id, content, created_at? }` | Yes (`private_messages`) | 1-on-1 messaging; rate limited; pushed to sender & receiver      |
| `group_message`                | Bidirectional | `{ id?, group_id, user_id, content, created_at? }`       |  Yes (`group_messages`)  | Group channel chat; rate limited; broadcast to all group members |
| `typing`                       | Bidirectional | `{ sender_id, recipient_id, is_typing: boolean }`        |      No (Ephemeral)      | Ephemeral typing indicator routed to chat partner                |
| `mark_read`                    |    C -> S     | `{ sender_id: number }`                                  | Yes (Updates `read_at`)  | Client signals messages from sender have been viewed             |
| `messages_read`                |    S -> C     | `{ reader_id, sender_id, read_at }`                      |            No            | Read receipt pushed to original message sender                   |
| `notification`                 |    S -> C     | Full `Notification` JSON struct                          |  Yes (`notifications`)   | Real-time push for all 15 notification types                     |
| `group_event_response_updated` |    S -> C     | `{ group_id, event_id, user_id, response }`              |            No            | Ephemeral event card sync broadcast to group members             |
| `follow_removed`               |    S -> C     | `{ actor_id: number, reason: "unfollowed"\|"declined" }` |            No            | Silent UI sync pushed to affected user                           |
| `invite_user_search`           |    C -> S     | `{ request_id, group_id, query, limit? }`                |            No            | Real-time user search query for group invite modal               |
| `invite_user_search_results`   |    S -> C     | `{ request_id, group_id, users: Candidate[] }`           |            No            | Search results returned over WebSocket                           |
| `error`                        |    S -> C     | `{ message: string }`                                    |            No            | Throttling/permission error alerts                               |

---

## 8. Space & 3D System Architecture

### 8.1 Active Planetary Registry (`modelsRegistry.ts`)

The 3D system manages 8 active celestial bodies, plus 1 natural satellite:

| Planet ID               | Model File Path                     | Scale | Ambient / Dir Light |     Base Accent Color      |   Orbiting Satellite    |
| ----------------------- | ----------------------------------- | :---: | :-----------------: | :------------------------: | :---------------------: |
| **`earth`** _(Default)_ | `/models/planets/earth-final.glb`   | 2.20  |     0.12 / 3.00     |    `#69aef0` (Sky Blue)    | Moon (`moon-final.glb`) |
| **`mercury`**           | `/models/planets/mercury-final.glb` | 1.48  |     0.14 / 3.10     |  `#b7c0ca` (Silver Gray)   |          None           |
| **`venus`**             | `/models/planets/venus-final.glb`   | 1.38  |     0.13 / 2.80     |   `#dfb46a` (Warm Amber)   |          None           |
| **`mars`**              | `/models/planets/mars-final.glb`    | 1.42  |     0.12 / 3.00     |  `#d8794e` (Rust Orange)   |          None           |
| **`jupiter`**           | `/models/planets/jupiter-final.glb` | 1.23  |     0.10 / 2.60     |   `#c7a27c` (Sand Ochre)   |          None           |
| **`saturn`**            | `/models/planets/saturn-final.glb`  | 1.54  |     0.14 / 2.90     | `#d8c188` (Champagne Gold) |  None (Authored rings)  |
| **`uranus`**            | `/models/planets/uranus-final.glb`  | 1.34  |     0.14 / 2.65     |   `#6fcfd3` (Cyan Teal)    |          None           |
| **`sun`**               | `/models/planets/sun-final.glb`     | 1.20  |     0.06 / 0.75     |   `#e5a13c` (Solar Gold)   |          None           |

### 8.2 Architectural Classification of 3D Assets

- **ACTIVE:** The 8 planets above and `moon-final.glb`, loaded dynamically based on user selection in `PlanetPreferenceProvider.tsx`.
- **OPTIONAL / USER CONTROLLABLE:** Users can toggle 3D model rendering off entirely via `SettingsPage.tsx` (`social-network:planet-model-enabled = false`). When disabled, a lightweight SVG/CSS starfield renders instead.
- **LEGACY / REMOVED:** `features/solar-system/` and `features/universe-home/` (camera trajectory navigation, GSAP timelines) were completely purged on September 13, 2026.
- **HISTORICAL / UNUSED:** `3d/black-hole-final.glb` exists in the `3d/` tool directory as an optimized asset, but is excluded from the active registry.

### 8.3 Dynamic Theme Injection

Selecting a planet does not merely change a 3D model; it injects CSS custom properties into the DOM root via `PlanetPreferenceProvider.tsx`:

```css
:root {
  --planet-accent: #69aef0;
  --planet-accent-hover: #86c3f7;
  --planet-accent-active: #285f96;
  --planet-accent-soft: rgba(82, 157, 224, 0.1);
  --planet-border: rgba(103, 178, 239, 0.18);
  --planet-border-strong: rgba(103, 178, 239, 0.34);
  --planet-glow: rgba(66, 145, 218, 0.14);
  --planet-surface-tint: rgba(50, 114, 178, 0.045);
  --planet-focus-ring: #78b6ef;
}
```

All buttons, borders, badges, and focus outlines dynamically synchronize with the selected celestial body.

---

## 9. Two-Tier Rate Limiting Architecture

The rate limiting engine (`backend/internal/ratelimit`) protects against abuse without requiring external services like Redis.

### 9.1 Mechanics & Dual Buckets

Every HTTP and WebSocket request must pass two independent token buckets:

1. **Global Cap (Hard Cap):** Keyed by User ID (or IP for unauthenticated routes). Burst capacity: 30 tokens, refill rate: 10 tokens/s, exhaustion penalty: 30 seconds.
2. **Endpoint Cap (Soft Cap):** Keyed by `(User ID, Route Pattern)`. Burst capacity: 10 tokens, refill rate: 3 tokens/s, exhaustion penalty: 15 seconds.

### 9.2 Request Costing & Discounting

High-frequency read sub-requests from feed posts (`GET /posts/{id}/likes`, `GET /posts/{id}/comments/count`) have their cost discounted to `0.2` tokens (`rateLimitRequestCost()` in `dependencies.go`). This prevents standard feed scrolling from exhausting the endpoint bucket while keeping mutation routes strictly throttled at cost `1.0`.

### 9.3 WebSocket Rate Limiting

Inbound `private_message` and `group_message` WebSocket frames are intercepted by `shouldRateLimitWebSocketEvent()`. When throttled, an `EventError` is returned over the socket with a calculated `RetryAfter` message.

---

## 10. Database Schema & Migration Analysis

### 10.1 Schema Overview (Actual SQLite Tables)

- `users`: Core identity, password hash, privacy status (`is_private`), biographical fields.
- `sessions`: Session tokens with foreign key to `users`, `expires_at`, and `revoked_at`.
- `followers`: Directional relationships `(follower_id, followed_id)`.
- `follow_requests`: Pending follow approvals `(requester_id, target_id, status)`.
- `posts`: Unified post storage for user feeds and groups (`group_id` nullable FK), visibility (`public`, `followers`, `custom`).
- `post_allowed_viewers`: Explicit allowed audience for `custom` visibility posts.
- `post_media`: Multiple media attachments per post with sort orders and media types (`image`, `gif`).
- `comments`: Threaded comments with image paths.
- `likes`: Post likes with unique `(post_id, user_id)` constraint.
- `groups`: Group records with creator ID and privacy (`public`, `private`).
- `group_members`: Memberships with roles (`creator`, `member`).
- `group_invitations`: Invites issued by group creators.
- `group_join_requests`: User join requests for public groups.
- `events`: Upcoming group events with mandatory future `event_time`.
- `event_responses`: Attendee RSVPs (`going`, `not_going`).
- `private_messages`: 1-on-1 chat history with read timestamps.
- `group_messages`: Group channel chat history.
- `notifications`: Notifications table with actor, receiver, type, entity, and read status.
- `schema_migrations`: Migration version tracking.

### 10.2 Discrepancies Between `schema.dbml` and Actual Migrations

1. **Unified Posts vs Separate Tables:** `schema.dbml` defined separate `group_posts`, `group_post_media`, `group_comments`, and `group_comment_media` tables. The actual implementation unifies group posts into `posts` via `group_id`.
2. **Likes Table:** `schema.dbml` completely omits the `likes` table. The actual implementation includes `likes` (`20260915130001_create_likes_table.up.sql`).
3. **Followers Column Naming:** `schema.dbml` defines `(follower_id, following_id)`. Actual SQLite schema uses `(follower_id, followed_id)`.
4. **Post Visibility:** `schema.dbml` lists `privacy: public | followers | private`. Actual schema uses `visibility: public | followers | custom` and links to `post_allowed_viewers`.

---

## 11. Known Caveats & README Risks

| Issue / Caveat                                | Real Code Impact                                                                                                                        | Codebase Evidence                                                     | README Guidance                                                                           |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| **Hardcoded Localhost in Frontend API**       | Browser client hardcodes `http://localhost:8080` and `ws://localhost:8080`, ignoring `NEXT_PUBLIC_BACKEND_ORIGIN` in production builds. | `frontend/src/lib/api.ts:25-27, 56-58`                                | Document clearly as an architectural note; instruct users to access via `localhost:3000`. |
| **Hardcoded CORS Origin in Backend**          | Go backend hardcodes `Access-Control-Allow-Origin: http://localhost:3000`. Running frontend on any other port causes CORS blocks.       | `backend/internal/middleware/cors.go:9-11`                            | Emphasize that frontend must run on port 3000.                                            |
| **Missing Smoke Test Script**                 | `npm run test:smoke` is defined in `package.json`, but `tests/run-smoke.sh` does not exist in the repository.                           | `frontend/package.json:10`                                            | Do NOT list `npm run test:smoke` in the final README verification steps.                  |
| **Stale `frontend/README.md`**                | Claims group chat is a disabled placeholder and 3D is dormant. Both are fully active in current code.                                   | `frontend/README.md:3, 36`                                            | Overwrite these misconceptions in the root README.                                        |
| **Stale `TEST_AUDIT_REPORT.md`**              | Claims followers and comments are not implemented. Both are 100% implemented with passing tests.                                        | `docs/TEST_AUDIT_REPORT.md:336`                                       | Clarify this as a historical mid-development checkpoint.                                  |
| **Root README Path Error**                    | Claims server entrypoint is `backend/cmd/main.go`. The actual path is `backend/cmd/server/main.go`.                                     | `README.md:78`                                                        | Ensure final README uses `go run ./cmd/server/`.                                          |
| **Custom Post Visibility Requires Followers** | If a user with 0 followers attempts to create a custom-visibility post, `CustomViewerPicker` displays an empty state.                   | `frontend/src/features/posts/components/CustomViewerPicker.tsx:32-38` | Clarify in feature docs that custom post audience requires at least one follower.         |

---

## 12. Engineering Challenges & Solutions

### Challenge 1: Single Connection SQLite Contention in Go

- **Problem:** When multiple concurrent HTTP requests and WebSocket goroutines executed writes simultaneously, SQLite returned `database is locked (5)` errors.
- **Solution:** Configured `db.SetMaxOpenConns(1)` and `db.SetMaxIdleConns(1)` in `pkg/db/sqlite/sqlite.go`, with WAL mode enabled. Go's `database/sql` connection pool serializes database access into a single thread-safe queue without failing transactions.

### Challenge 2: Decoupling 3D Graphics from App Routing

- **Problem:** Early implementations bound Three.js camera animations to Next.js page transitions via GSAP. When transitions lagged or errored, user navigation froze completely.
- **Solution:** Decoupled 3D into an independent background layer (`PlanetBackground.tsx`). Next.js App Router handles navigation natively, while 3D smoothly transitions orbital angles and colors asynchronously.

### Challenge 3: Eliminating Read-State Race Conditions in Notifications

- **Problem:** Polling `/api/notifications` periodically while receiving WebSocket pushes caused race conditions: an outdated REST response would overwrite a recently read notification and mark it unread again.
- **Solution:** Implemented `mergeNotifications()` with monotonic read status: `isRead: incoming.isRead || Boolean(existing?.isRead)`. Once marked read on the client, a notification can never revert to unread from stale network data.

### Challenge 4: False-Positive Rate Limiting on Social Feeds

- **Problem:** Loading a feed page of 20 posts caused the frontend to fire 20 parallel requests to `/posts/{id}/likes` and `/posts/{id}/comments/count`. This immediately tripped the per-endpoint rate limit bucket (capacity 10).
- **Solution:** Added weighted request costing in `internal/router/dependencies.go`, discounting likes and comment-count reads to `0.2` tokens while keeping standard requests at `1.0`. Normal feed consumption runs smoothly while mutation abuse remains strictly throttled.
