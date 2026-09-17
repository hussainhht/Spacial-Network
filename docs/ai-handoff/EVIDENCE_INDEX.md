# Evidence Index — Fact-Checking & Symbol Reference

This index maps every major technical claim, architectural mechanism, and business rule to repository-relative source paths, symbols, database tables, and relevant Git commits. Future agents can use this index for fast verification without scanning the entire repository.

---

## 1. Authentication & Sessions

| Claim / Mechanism                                                       |  Status  | Conf. | Repository Evidence Path                                                                                                    | Symbol / Route / Table                                   |  Commit   |
| ----------------------------------------------------------------------- | :------: | :---: | --------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | :-------: |
| Password hashing with bcrypt (default cost 10)                          | Verified | High  | `backend/internal/users/service.go`                                                                                         | `hashPassword()`, `bcrypt.GenerateFromPassword`          | `2d7acf3` |
| Password verification on login                                          | Verified | High  | `backend/internal/users/service.go`                                                                                         | `comparePasswords()`, `CheckCredentials()`               | `2d7acf3` |
| Identifier accepts either username or email                             | Verified | High  | `backend/internal/users/repository.go`                                                                                      | `GetCredentials()` (`WHERE username = ? OR email = ?`)   | `2d7acf3` |
| Session tokens generated via 32 crypto-secure random bytes (hex)        | Verified | High  | `backend/pkg/session/session.go`                                                                                            | `GenerateSessionToken()` (`crypto/rand.Read`)            | `9c880f0` |
| Sessions stored in SQLite with expiration and revocation                | Verified | High  | `backend/pkg/db/migrations/sqlite/20260827221113_create_sessions_table.up.sql`<br>`backend/internal/auth/repository.go`     | Table `sessions`<br>`CreateSession()`, `RevokeSession()` | `9c880f0` |
| Session cookie configuration (`HttpOnly`, `SameSite=Lax`, 24h lifetime) | Verified | High  | `backend/internal/auth/handler.go`<br>`backend/internal/config/config.go`                                                   | `http.SetCookie()`, `SessionLifetime = 24 * time.Hour`   | `2d7acf3` |
| Sliding-window session expiration update on every authenticated request | Verified | High  | `backend/internal/middleware/auth.go`                                                                                       | `authService.UpdateSessionExpiry()`                      | `2e59ea5` |
| Request context user ID injection                                       | Verified | High  | `backend/internal/middleware/auth.go`<br>`backend/internal/requestctx/requestctx.go`                                        | `requestctx.WithUserID()`                                | `f8f73d0` |
| Password change requires old password verification                      | Verified | High  | `backend/internal/users/service.go`<br>`backend/internal/auth/change_password.go`                                           | `ChangePassword()`, `PATCH /api/users/me/password`       | `77491a6` |
| Interactive registration wizard with 3D planet stages                   | Verified | High  | `frontend/src/features/auth/components/RegisterForm.tsx`<br>`frontend/src/features/auth/components/RegisterPlanetStage.tsx` | Component `RegisterForm`, `RegisterPlanetStage`          | `a8bf882` |
| Interactive login page with planet visual stage                         | Verified | High  | `frontend/src/features/auth/components/LoginForm.tsx`<br>`frontend/src/features/auth/components/LoginPlanetStage.tsx`       | Component `LoginForm`, `LoginPlanetStage`                | `0fa6276` |

---

## 2. Profiles & Account Management

| Claim / Mechanism                                                                  |  Status  | Conf. | Repository Evidence Path                                                                                        | Symbol / Route / Table                                |  Commit   |
| ---------------------------------------------------------------------------------- | :------: | :---: | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | :-------: |
| User profile privacy flag (`is_private` boolean)                                   | Verified | High  | `backend/pkg/db/migrations/sqlite/20260904180906_add_profile_privacy_to_users.up.sql`                           | Column `users.is_private`                             | `7a50780` |
| Public profile privacy toggle endpoint                                             | Verified | High  | `backend/internal/users/handler.go`                                                                             | `UpdateProfilePrivacyHandler()` (`/users/me/privacy`) | `7a50780` |
| Profile privacy rules (`AboutMe` masked for non-followers of private profiles)     | Verified | High  | `backend/internal/users/handler.go`<br>`backend/internal/users/service.go`                                      | `toProfileResponse()`, `CanViewFullProfile()`         | `7a50780` |
| Personal profile details (UUID, email, age, DOB) only visible to profile owner     | Verified | High  | `backend/internal/users/handler.go`                                                                             | `includePersonalInfo` in `toProfileResponse()`        | `7a50780` |
| Profile details editable: first name, last name, nickname, about me, date of birth | Verified | High  | `backend/internal/users/handler.go`<br>`frontend/src/features/profile/components/ProfileDetailsForm.tsx`        | `PATCH /users/me/profile`, `ProfileDetailsForm`       | `77491a6` |
| Avatar update handler with file upload replacement                                 | Verified | High  | `backend/internal/users/handler.go`<br>`frontend/src/features/profile/components/ProfileAvatarForm.tsx`         | `PATCH /users/me/avatar`, `ProfileAvatarForm`         | `7a50780` |
| Avatar circular presentation enforced uniformly                                    | Verified | High  | `frontend/src/components/UserAvatar.tsx`<br>`frontend/src/features/search/components/UniversalNavbarSearch.tsx` | Commits `ef003ba`, `3430087`, `4c4fd0b`               | `ef003ba` |

---

## 3. Followers & Follow Requests

| Claim / Mechanism                                                                  |  Status  | Conf. | Repository Evidence Path                                                                                         | Symbol / Route / Table                               |  Commit   |
| ---------------------------------------------------------------------------------- | :------: | :---: | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | :-------: |
| Followers table with unique pair constraint                                        | Verified | High  | `backend/pkg/db/migrations/sqlite/20260906173721_create_followers_table.up.sql`                                  | Table `followers(follower_id, followed_id)`          | `568084d` |
| Follow requests table with unique pair constraint                                  | Verified | High  | `backend/pkg/db/migrations/sqlite/20260908144443_create_follow_requests_table.up.sql`                            | Table `follow_requests(requester_id, target_id)`     | `568084d` |
| Self-follow prohibited (`ErrCannotFollowSelf`)                                     | Verified | High  | `backend/internal/followers/service.go`                                                                          | `FollowUser()`, `CreateFollowRequest()`              | `568084d` |
| Following a public profile creates immediate follow relationship                   | Verified | High  | `backend/internal/followers/handler.go`                                                                          | `FollowUserHandler()`                                | `568084d` |
| Following a private profile creates a follow request                               | Verified | High  | `backend/internal/followers/handler.go`                                                                          | `targetProfile.IsPrivate -> CreateFollowRequest()`   | `568084d` |
| Follow request accept triggers `follow_accepted` notification                      | Verified | High  | `backend/internal/followers/service.go`                                                                          | `AcceptFollowRequest()`                              | `f483738` |
| Follow request decline sends ephemeral `follow_removed` WS event (no notification) | Verified | High  | `backend/internal/followers/service.go`<br>`backend/internal/followers/ws.go`                                    | `DeclineFollowRequest()`, `EventFollowRemoved`       | `f483738` |
| Unfollow sends ephemeral `follow_removed` WS event (no notification)               | Verified | High  | `backend/internal/followers/service.go`<br>`backend/internal/followers/ws.go`                                    | `UnfollowUser()`, `FollowRemovedUnfollowed`          | `f483738` |
| Personalized follow recommendations                                                | Verified | High  | `backend/internal/followers/repository.go`<br>`frontend/src/features/recommendations/components/WhoToFollow.tsx` | `GetRecommendations()`, `GET /users/recommendations` | `568084d` |

---

## 4. Posts, Feeds & Comments

| Claim / Mechanism                                            |  Status  | Conf. | Repository Evidence Path                                                                                                                                        | Symbol / Route / Table                                               |  Commit   |
| ------------------------------------------------------------ | :------: | :---: | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | :-------: |
| Posts table schema with visibility CHECK                     | Verified | High  | `backend/pkg/db/migrations/sqlite/20260902120000_create_posts_table.up.sql`<br>`backend/pkg/db/migrations/sqlite/20260909120000_add_visibility_to_posts.up.sql` | Table `posts`, column `visibility` (`public`, `followers`, `custom`) | `8a53056` |
| Allowed viewers table for custom privacy posts               | Verified | High  | `backend/pkg/db/migrations/sqlite/20260909120001_create_post_allowed_viewers_table.up.sql`                                                                      | Table `post_allowed_viewers(post_id, user_id)`                       | `8a53056` |
| Custom visibility viewer list restricted to actual followers | Verified | High  | `backend/internal/posts/service.go`                                                                                                                             | `s.followers.FilterFollowerIDs()` in `CreatePost()`                  | `8a53056` |
| Custom viewer UI picker in frontend                          | Verified | High  | `frontend/src/features/posts/components/CustomViewerPicker.tsx`                                                                                                 | `CustomViewerPicker` using `useMyFollowers()`                        | `8a53056` |
| Feed scopes: `all`, `following`, `friends` (mutual follow)   | Verified | High  | `backend/internal/posts/model.go`<br>`backend/internal/posts/repository.go`                                                                                     | `FeedAll`, `FeedFollowing`, `FeedFriends`                            | `8a53056` |
| Cursor-based deterministic feed pagination                   | Verified | High  | `backend/internal/posts/model.go`<br>`backend/internal/posts/repository.go`                                                                                     | `FeedCursor{CreatedAt, ID}`, `ListPostsPage()`                       | `8a53056` |
| Post multi-media attachments table (`post_media`)            | Verified | High  | `backend/pkg/db/migrations/sqlite/20260915120000_add_post_media.up.sql`                                                                                         | Table `post_media(post_id, file_path, media_type, sort_order)`       | `503fbb0` |
| Comments table with post foreign key and cascade delete      | Verified | High  | `backend/pkg/db/migrations/sqlite/20260905190457_create_comments_table.up.sql`                                                                                  | Table `comments(post_id, user_id, content, image_path)`              | `e4cb3ad` |
| Comment count endpoint                                       | Verified | High  | `backend/internal/comments/handler.go`                                                                                                                          | `GET /posts/{id}/comments/count`                                     | `8e9bb33` |
| Comment deletion authorization (author or group moderator)   | Verified | High  | `backend/internal/comments/service.go`                                                                                                                          | `CanModerateComment()`                                               | `afa5744` |

---

## 5. Likes & Post Sharing

| Claim / Mechanism                                                |  Status  | Conf. | Repository Evidence Path                                                    | Symbol / Route / Table                                |  Commit   |
| ---------------------------------------------------------------- | :------: | :---: | --------------------------------------------------------------------------- | ----------------------------------------------------- | :-------: |
| Likes table with unique `(post_id, user_id)` constraint          | Verified | High  | `backend/pkg/db/migrations/sqlite/20260915130001_create_likes_table.up.sql` | Table `likes(post_id, user_id)`                       | `ff3d2d3` |
| Liking a post notifies author via `post_like` (except self-like) | Verified | High  | `backend/internal/likes/service.go`                                         | `LikePost()`, `notifications.NotificationPostLike`    | `b056b7f` |
| Unlike removes record idempotently                               | Verified | High  | `backend/internal/likes/repository.go`                                      | `DELETE FROM likes WHERE post_id = ? AND user_id = ?` | `ff3d2d3` |
| Share post endpoint dispatches as in-app chat message            | Verified | High  | `backend/internal/share/service.go`<br>`backend/internal/router/router.go`  | `POST /posts/{id}/share`, `SharePost()`               | `2927661` |
| Share post modal supports sending to user or group               | Verified | High  | `frontend/src/features/interactions/components/ShareModal.tsx`              | Component `ShareModal`                                | `ce42498` |
| Shared post preview rendered inside chat bubbles                 | Verified | High  | `frontend/src/features/interactions/components/PostSharePreview.tsx`        | Component `PostSharePreview`                          | `d3c2e1c` |

---

## 6. Groups & Group Events

| Claim / Mechanism                                                  |  Status  | Conf. | Repository Evidence Path                                                                                                                                   | Symbol / Route / Table                                                   |  Commit   |
| ------------------------------------------------------------------ | :------: | :---: | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | :-------: |
| Groups table schema with privacy enum                              | Verified | High  | `backend/pkg/db/migrations/sqlite/20260829174143_create_groups_table.up.sql`<br>`backend/pkg/db/migrations/sqlite/20260914203241_add_group_privacy.up.sql` | Table `groups`, column `privacy` (`public`, `private`)                   | `eb020fc` |
| Group creator automatically becomes member with creator role       | Verified | High  | `backend/internal/groups/transactions.go`                                                                                                                  | `InsertGroup()` with transactional member insertion                      | `eb020fc` |
| Public groups allow join requests (`RequestToJoin`)                | Verified | High  | `backend/internal/groups/service.go`                                                                                                                       | `RequestToJoin()`, `ErrJoinRequestNotAllowed` for private                | `686eb9a` |
| Private groups are strictly invite-only                            | Verified | High  | `backend/internal/groups/service.go`                                                                                                                       | `CreateGroupInvitation()`                                                | `686eb9a` |
| Only group creator may invite users                                | Verified | High  | `backend/internal/groups/service.go`                                                                                                                       | `group.CreatorID != inviterID -> ErrNotGroupCreator`                     | `686eb9a` |
| Group photo support with templates                                 | Verified | High  | `backend/pkg/db/migrations/sqlite/20260907012822_add_group_photo_to_groups.up.sql`<br>`frontend/src/features/groups/constants/groupImageTemplates.ts`      | Column `groups.group_photo`, templates `earth`, `saturn`, `mars`, `moon` | `c8f67fa` |
| Group posts unified into `posts` table via `group_id`              | Verified | High  | `backend/pkg/db/migrations/sqlite/20260909180000_add_group_id_to_posts.up.sql`                                                                             | Column `posts.group_id REFERENCES groups(id)`                            | `8303242` |
| Group post creation and read require group membership              | Verified | High  | `backend/internal/posts/service.go`                                                                                                                        | `CreateGroupPost()`, `ListGroupPosts()`                                  | `8303242` |
| Group events table with future event_time requirement              | Verified | High  | `backend/pkg/db/migrations/sqlite/20260906220800_create_events_table.up.sql`<br>`backend/internal/groups/event_service.go`                                 | Table `events`, `eventTime.After(time.Now())`                            | `1726970` |
| Event cover photos / templates                                     | Verified | High  | `backend/pkg/db/migrations/sqlite/20260915130000_add_image_path_to_events.up.sql`<br>`frontend/src/features/groups/components/events/EventCoverPicker.tsx` | Column `events.image_path`, `EventCoverPicker`                           | `1726970` |
| Event response options (`going`, `not_going`)                      | Verified | High  | `backend/pkg/db/migrations/sqlite/20260906220805_create_event_responses_table.up.sql`                                                                      | Table `event_responses(event_id, user_id, response)`                     | `1726970` |
| Event response RSVP broadcasts ephemeral WS event to group members | Verified | High  | `backend/internal/groups/event_ws.go`                                                                                                                      | `EventGroupEventResponseUpdated` ("group_event_response_updated")        | `1726970` |
| Event response notifies event creator with `event_rsvp`            | Verified | High  | `backend/internal/groups/event_service.go`                                                                                                                 | `RespondToEvent()`, `NotificationEventRSVP`                              | `3444152` |

---

## 7. Realtime WebSockets & Chat

| Claim / Mechanism                                                             |  Status  | Conf. | Repository Evidence Path                                                              | Symbol / Route / Table                                  |  Commit   |
| ----------------------------------------------------------------------------- | :------: | :---: | ------------------------------------------------------------------------------------- | ------------------------------------------------------- | :-------: |
| Single multiplexed WebSocket endpoint (`GET /api/ws`)                         | Verified | High  | `backend/internal/router/router.go`<br>`backend/internal/websocket/handler.go`        | `ServeWS()`, `upgrader.Upgrade`                         | `9c880f0` |
| WebSocket authentication via HTTP session cookie                              | Verified | High  | `backend/internal/router/router.go`<br>`backend/internal/websocket/handler.go`        | `sessionMiddleware(ServeWS)`                            | `9c880f0` |
| Client hub with concurrent register/unregister/broadcast loops                | Verified | High  | `backend/internal/websocket/hub.go`<br>`backend/internal/websocket/client.go`         | `Hub.Run()`, `Client.ReadPump()`, `Client.WritePump()`  | `9c880f0` |
| Inbound WS router dispatching typed messages                                  | Verified | High  | `backend/internal/websocket/router.go`<br>`backend/internal/router/dependencies.go`   | `Router.Register()`, `wsRouter.Dispatch()`              | `9c880f0` |
| Private message authorization: users must follow or be followed               | Verified | High  | `backend/internal/chat/service.go`<br>`backend/internal/followers/service.go`         | `followChecker.CanMessage()`, `HasFollowRelationship()` | `be491ba` |
| Private message length bound: 2000 runes                                      | Verified | High  | `backend/internal/chat/service.go`                                                    | `MaxMessageLength = 2000`                               | `be491ba` |
| Private messages table with read status and timestamp                         | Verified | High  | `backend/pkg/db/migrations/sqlite/20260829145858_create_private_message_table.up.sql` | Table `private_messages`                                | `be491ba` |
| Read receipt event (`mark_read` -> `messages_read`)                           | Verified | High  | `backend/internal/chat/service.go`                                                    | `EventMarkRead`, `EventMessagesRead`                    | `be491ba` |
| Group messages table with group and user foreign keys                         | Verified | High  | `backend/pkg/db/migrations/sqlite/20260909190000_create_group_messages_table.up.sql`  | Table `group_messages`                                  | `73238ce` |
| Group message sent only to current group members                              | Verified | High  | `backend/internal/chat/service.go`                                                    | `groupChecker.GetGroupMembers()`, `s.hub.SendToUsers()` | `73238ce` |
| Group message triggers `group_message` notification for offline/other members | Verified | High  | `backend/internal/chat/service.go`                                                    | `notifyGroupMembers()`, `NotificationGroupMessage`      | `73238ce` |
| In-memory typing indicator event (`typing`)                                   | Verified | High  | `backend/internal/chat/service.go`                                                    | `EventTyping`                                           | `be491ba` |
| Real-time invite candidate search over WebSocket                              | Verified | High  | `backend/internal/groups/ws.go`                                                       | `EventInviteUserSearch`, `EventInviteUserSearchResults` | `686eb9a` |

---

## 8. Notifications System

| Claim / Mechanism                                                   |  Status  | Conf. | Repository Evidence Path                                                                                                                       | Symbol / Route / Table                                        |  Commit   |
| ------------------------------------------------------------------- | :------: | :---: | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | :-------: |
| Notifications table with actor, receiver, type, entity, and read_at | Verified | High  | `backend/pkg/db/migrations/sqlite/20260903211849_create_notifications_table.up.sql`                                                            | Table `notifications`                                         | `ca46584` |
| 15 validated notification types (extensible without DB migration)   | Verified | High  | `backend/internal/notifications/model.go`                                                                                                      | `NotificationType` enum, `validNotificationTypes` map         | `799d5fb` |
| Persistence happens before WebSocket delivery                       | Verified | High  | `backend/internal/notifications/service.go`                                                                                                    | `s.repo.Create()` followed by `s.deliver()`                   | `ca46584` |
| Shared wire payload: REST and WS use identical struct               | Verified | High  | `backend/internal/notifications/events.go`                                                                                                     | `NewNotificationEvent(Notification)`                          | `ca46584` |
| Monotonic read-state merge in frontend (`mergeNotifications`)       | Verified | High  | `frontend/src/features/notifications/utils/mergeNotifications.ts`                                                                              | `isRead: n.isRead \|\| Boolean(previous?.isRead)`             | `ca46584` |
| Mark all as read endpoint and UI action                             | Verified | High  | `backend/internal/notifications/handler.go`<br>`frontend/src/features/notifications/api/notifications.ts`                                      | `PATCH /notifications/read-all`, `markAllNotificationsRead()` | `a1c23c7` |
| Floating notification toast popups for real-time alerts             | Verified | High  | `frontend/src/features/notifications/hooks/useNotificationToasts.ts`<br>`frontend/src/features/notifications/components/NotificationToast.tsx` | Component `NotificationToast`, `useNotificationToasts`        | `624a7d1` |

---

## 9. Rate Limiting System

| Claim / Mechanism                                                           |  Status  | Conf. | Repository Evidence Path                                                          | Symbol / Route / Table                                             |  Commit   |
| --------------------------------------------------------------------------- | :------: | :---: | --------------------------------------------------------------------------------- | ------------------------------------------------------------------ | :-------: |
| Two-tier token bucket limiter (global hard cap + endpoint soft cap)         | Verified | High  | `backend/internal/ratelimit/limiter.go`<br>`backend/internal/ratelimit/bucket.go` | Structs `Limiter`, `Bucket`                                        | `d8b7276` |
| Enforces cooldown penalties upon exhaustion (30s global, 15s endpoint)      | Verified | High  | `backend/internal/config/config.go`<br>`backend/internal/ratelimit/limiter.go`    | `RateLimitGlobalPenalty`, `RateLimitEndpointPenalty`               | `d8b7276` |
| HTTP rate limit middleware nested inside session authentication             | Verified | High  | `backend/internal/router/router.go`<br>`backend/internal/middleware/ratelimit.go` | `middleware.RateLimit` inside `sessionMiddleware`                  | `d8b7276` |
| WebSocket chat event throttling (`private_message`, `group_message`)        | Verified | High  | `backend/internal/router/dependencies.go`                                         | `shouldRateLimitWebSocketEvent()`, `sendWebSocketRateLimitError()` | `d8b7276` |
| Cheap read endpoint discounting (feed posts likes/comments cost 0.2 tokens) | Verified | High  | `backend/internal/router/dependencies.go`                                         | `cheapReadEndpoints`, `rateLimitRequestCost()`                     | `d8b7276` |
| Background garbage collection of idle full buckets and expired penalties    | Verified | High  | `backend/internal/ratelimit/limiter.go`                                           | `cleanupLoop()`, `CleanupInterval = 2m`                            | `d8b7276` |

---

## 10. Space & 3D System

| Claim / Mechanism                                                        |  Status  | Conf. | Repository Evidence Path                                                                                  | Symbol / Route / Table                                                    |  Commit   |
| ------------------------------------------------------------------------ | :------: | :---: | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | :-------: |
| 3D library stack: Three.js 0.185.1, R3F 9.7.0, Drei 10.7.8               | Verified | High  | `frontend/package.json`                                                                                   | `three`, `@react-three/fiber`, `@react-three/drei`                        | `cea8938` |
| 8 selectable planets registered with themes and camera offsets           | Verified | High  | `frontend/src/components/space/modelsRegistry.ts`                                                         | `earth`, `mercury`, `venus`, `mars`, `jupiter`, `saturn`, `uranus`, `sun` | `99ba50d` |
| Default active planet: Earth                                             | Verified | High  | `frontend/src/components/space/modelsRegistry.ts`                                                         | `DEFAULT_PLANET_ID = "earth"`                                             | `99ba50d` |
| Moon companion orbiting Earth                                            | Verified | High  | `frontend/src/components/space/modelsRegistry.ts`<br>`frontend/src/components/space/PlanetSystem.tsx`     | `MOON_COMPANION`, `moon-final.glb`                                        | `99ba50d` |
| Production optimized GLB assets under `public/models/planets/`           | Verified | High  | `frontend/public/models/planets/`                                                                         | `*-final.glb`                                                             | `99ba50d` |
| Dynamic CSS variable theme generation from active planet                 | Verified | High  | `frontend/src/components/space/PlanetPreferenceProvider.tsx`                                              | `--planet-accent`, `--planet-border`, `--planet-glow`, etc.               | `99ba50d` |
| LocalStorage persistence with cross-tab storage event synchronization    | Verified | High  | `frontend/src/components/space/PlanetPreferenceProvider.tsx`                                              | `social-network:planet`, `social-network:planet-model-enabled`            | `99ba50d` |
| Responsive composition (viewport scale/offset for mobile/tablet/desktop) | Verified | High  | `frontend/src/components/space/modelsRegistry.ts`<br>`frontend/src/components/space/usePlanetViewport.ts` | `ResponsiveComposition`, `usePlanetViewport`                              | `99ba50d` |
| User toggle to enable/disable 3D model in Settings                       | Verified | High  | `frontend/src/features/settings/components/AppearanceSettings.tsx`                                        | Switch control `planetModelEnabled`                                       | `93cffbf` |
| Fallback starfield SVG/CSS background                                    | Verified | High  | `frontend/src/components/space/SpaceBackground.tsx`                                                       | Component `SpaceBackground`                                               | `99ba50d` |
| Abandoned solar system & universe scenes removed                         | Verified | High  | `frontend/CLEANUP_REPORT.md`                                                                              | Removed `features/solar-system/`, `features/universe-home/`               | `05f4a93` |

---

## 11. Database & Migrations

| Claim / Mechanism                                                          |  Status  | Conf. | Repository Evidence Path                                      | Symbol / Route / Table                                       |  Commit   |
| -------------------------------------------------------------------------- | :------: | :---: | ------------------------------------------------------------- | ------------------------------------------------------------ | :-------: |
| SQLite database engine with foreign keys enabled                           | Verified | High  | `backend/pkg/db/sqlite/sqlite.go`                             | `_foreign_keys=on` in DSN                                    | `6c1a791` |
| Single connection serialization to prevent lock contention                 | Verified | High  | `backend/pkg/db/sqlite/sqlite.go`                             | `db.SetMaxOpenConns(1)`, `db.SetMaxIdleConns(1)`             | `6c1a791` |
| Migrations discovered and embedded into Go binary via `embed.FS`           | Verified | High  | `backend/pkg/db/migrations/sqlite/files.go`                   | `//go:embed *.sql`, `var Files embed.FS`                     | `6c1a791` |
| Startup migrations executed automatically on server boot                   | Verified | High  | `backend/cmd/server/main.go`                                  | `sqlite.MigrateUp(db)`                                       | `4d0d8e8` |
| Migration transactions (atomic execution per migration file)               | Verified | High  | `backend/pkg/db/sqlite/migration_runner.go`                   | `tx, err := db.Begin()`, `tx.Commit()`                       | `6c1a791` |
| Schema migration tracking table (`schema_migrations`)                      | Verified | High  | `backend/pkg/db/sqlite/migration_runner.go`                   | `CREATE TABLE schema_migrations (version, name, applied_at)` | `6c1a791` |
| Migration CLI supporting `up`, `down`, `down-all`, `version`, `create`     | Verified | High  | `backend/cmd/migrate/main.go`                                 | CLI entrypoint                                               | `4d0d8e8` |
| Total current migration files: 30 up/down pairs (latest: `20260915130001`) | Verified | High  | `backend/pkg/db/migrations/sqlite/`                           | 60 SQL files                                                 | `ff3d2d3` |
| Repeat-safe bulk database seeder with sample accounts                      | Verified | High  | `backend/cmd/seed/main.go`<br>`backend/internal/seed/bulk.go` | `go run ./cmd/seed`, `RunBulk()`                             | `6ceca37` |

---

## 12. Upload & Media Infrastructure

| Claim / Mechanism                                                       |  Status  | Conf. | Repository Evidence Path                                                   | Symbol / Route / Table                                |  Commit   |
| ----------------------------------------------------------------------- | :------: | :---: | -------------------------------------------------------------------------- | ----------------------------------------------------- | :-------: |
| Magic byte sniffing via `http.DetectContentType` (no client trust)      | Verified | High  | `backend/internal/upload/avatar.go`                                        | `sniff[:512]`, `http.DetectContentType(sniff)`        | `32c14d3` |
| Hard file size limit (5 MiB) enforced with `io.LimitReader`             | Verified | High  | `backend/internal/upload/avatar.go`<br>`backend/internal/config/config.go` | `MaxAvatarSize = 5 MiB`, `MaxMediaSize = 5 MiB`       | `32c14d3` |
| Avatar allowed MIME types: JPEG, PNG, GIF (WebP disallowed for avatars) | Verified | High  | `backend/internal/upload/avatar.go`                                        | `allowedAvatarTypes`                                  | `32c14d3` |
| Post/comment/event allowed MIME types: JPEG, PNG, GIF, WebP             | Verified | High  | `backend/internal/upload/media.go`                                         | `allowedMediaTypes`                                   | `686eb9a` |
| Collision-proof filename generation via UUID v4                         | Verified | High  | `backend/internal/upload/avatar.go`                                        | `uuid.NewString() + ext`                              | `32c14d3` |
| Path traversal protection on media deletion                             | Verified | High  | `backend/internal/upload/avatar.go`                                        | `filepath.Clean()`, check `filepath.IsAbs()` & `..`   | `32c14d3` |
| Static media serving via `http.FileServer` at `/uploads/`               | Verified | High  | `backend/internal/router/router.go`                                        | `http.StripPrefix("/uploads/", http.FileServer(...))` | `32c14d3` |

---

## 13. Docker & Deployment Runtime

| Claim / Mechanism                                                               |  Status  | Conf. | Repository Evidence Path              | Symbol / Route / Table                                     |  Commit   |
| ------------------------------------------------------------------------------- | :------: | :---: | ------------------------------------- | ---------------------------------------------------------- | :-------: |
| Multi-stage Go backend build (`golang:1.26-bookworm` -> `debian:bookworm-slim`) | Verified | High  | `backend/Dockerfile`                  | `FROM golang:1.26-bookworm AS builder`                     | `b73750a` |
| Multi-stage Node frontend build (`node:20-bookworm-slim`)                       | Verified | High  | `frontend/Dockerfile`                 | `npm run build -- --webpack`                               | `b73750a` |
| Docker Compose orchestrates `backend` (8080) and `frontend` (3000)              | Verified | High  | `compose.yaml`                        | Services `backend`, `frontend`                             | `b73750a` |
| Persistent SQLite database and uploads volume `backend-data`                    | Verified | High  | `compose.yaml`                        | Volume `backend-data:/app/data`                            | `b73750a` |
| **Caveat:** Frontend browser API client hardcodes `http://localhost:8080`       | Verified | High  | `frontend/src/lib/api.ts`             | `getBackendBaseUrl()`, unused `NEXT_PUBLIC_BACKEND_ORIGIN` | `76c2051` |
| **Caveat:** Backend CORS header hardcodes `http://localhost:3000`               | Verified | High  | `backend/internal/middleware/cors.go` | `Access-Control-Allow-Origin: http://localhost:3000`       | `cad5607` |
