# Backend Unit Test Report

Test suite added under `backend/tests/`, mirroring `backend/internal/*` and
`backend/pkg/db/sqlite` package structure. All tests use the standard
`testing` package only (no `testify` — not previously a dependency; adding
it was declined). Every test runs against a freshly migrated in-memory
SQLite database (`backend/tests/testutil/db.go`), isolated per test.

## Summary table

| Feature area   | Test files | Test cases (top-level) | Pass | Fail |
|-----------------|-----------:|------------------------:|-----:|-----:|
| auth & sessions | 2          | 15                       | 15   | 0    |
| followers       | 1          | 8                        | 8    | 0    |
| profile         | 1          | 5                        | 5    | 0    |
| posts           | 1          | 7                        | 7    | 0    |
| comments        | 1          | 4                        | 4    | 0    |
| upload (images) | 1          | 3                        | 3    | 0    |
| groups (+events)| 2          | 16                       | 16   | 0    |
| chat            | 1          | 5                        | 5    | 0    |
| notifications   | 1          | 6                        | 6    | 0    |
| db/sqlite       | 1          | 3                        | 3    | 0    |
| **Total**       | **12**     | **72**                   | **72** | **0** |

(Counts are top-level `Test*` functions; several also run table-driven
subtests, e.g. `TestValidateRegisterRequest_MissingFields` runs 11 cases and
`TestMediaStorage_Save_AcceptedTypes` runs 4. Full `-v` run: 0 failures.)

## Coverage by audit item

- ✅ **Register — valid input persists a user**: `auth/auth_test.go: TestRegister_ValidInput_PersistsUser`
- ✅ **Register — missing required fields rejected**: `auth/auth_test.go: TestValidateRegisterRequest_MissingFields` (table-driven: email, password, first/last name, age, gender)
- ✅ **Register — duplicate email/username rejected**: `TestRegister_DuplicateEmail_Rejected`, `TestRegister_DuplicateUsername_Rejected` (this app has no separate "nickname" field — username plays that role)
- ✅ **Password hashing — never stored in plaintext, correct/wrong password verify**: `TestPasswordHashing_NeverStoredPlaintext`, `TestCheckCredentials_CorrectAndWrongPassword`
- ✅ **Login — correct credentials succeed and create a session**: `auth/session_test.go: TestLogin_CorrectCredentials_CreatesSession`
- ✅ **Login — wrong password/unknown email fails, no session created**: `TestLogin_WrongPassword_NoSessionCreated`, `TestLogin_UnknownEmail_Fails`
- ✅ **Session/cookie middleware — valid session passes; missing/invalid/expired/revoked rejected (401)**: `TestSessionMiddleware_ValidCookie_Passes`, `TestSessionMiddleware_MissingCookie_Rejected`, `TestSessionMiddleware_InvalidCookie_Rejected`, `TestSessionMiddleware_RevokedCookie_Rejected`, `TestSessionMiddleware_ExpiredSession_Rejected`
- ✅ **Logout invalidates the session**: `TestLogout_InvalidatesSession`
- ✅ **Follow request vs. auto-follow (private vs public profile)**: `followers/followers_test.go: TestFollow_PrivateProfile_CreatesPendingRequest_NotActiveFollow`, `TestFollow_PublicProfile_ActiveFollowImmediately_NoPendingRequest`
- ✅ **Accept/decline follow request**: `TestAcceptFollowRequest_ActivatesFollow`, `TestDeclineFollowRequest_RemovesRequest_NoFollowCreated`
- ✅ **Unfollow (existing / non-followed no-op)**: `TestUnfollow_RequiresExistingFollow`, `TestUnfollow_NonFollowedUser_NoOp`
- ✅ **Duplicate follow requests prevented**: `TestFollow_DuplicateRequest_Prevented`
- ✅ **Profile visibility rules (public open, private owner/follower-only, no password field, privacy toggle persists, aggregates followers/following/own posts)**: `profile/profile_test.go` (all 5 tests) + `posts/posts_test.go: TestListPosts_IncludesOwnPostsRegardlessOfVisibility` for the "own posts" aggregate
- ✅ **Post privacy levels (public/followers/custom) stored and enforced**: `posts/posts_test.go: TestCreatePost_*` (storage) + `TestPostVisibility_*` (enforcement, including that only actual followers land on a custom post's allowed-viewer list even if other IDs were requested)
- ✅ **Comments attach to existing post; fail on non-existent post**: `comments/comments_test.go: TestCreateComment_AttachesToExistingPost`, `TestCreateComment_NonExistentPost_Fails`
- ✅ **Image/GIF upload accepted (JPEG/PNG/GIF/WebP), rejected for disallowed types, path persisted**: `comments/comments_test.go: TestCreateComment_ImageAttachment_*` (end-to-end through the comment handler) + `upload/media_test.go` (direct `MediaStorage.Save` content-sniffing and size-limit tests)
- ✅ **Group creation stores title/description/creator**: `groups/groups_test.go: TestCreateGroup_StoresTitleDescriptionAndCreator`
- ✅ **Group invite/join flow (only members invite, invitee must accept, decline doesn't add member; non-member can request to join, only creator accepts/declines)**: `groups/groups_test.go: TestGroupInvitation_*`, `TestJoinRequest_*` (7 tests)
- ✅ **Group posts/comments require membership to create**: `TestGroupPost_RequiresMembership`, `TestGroupComment_RequiresMembership`. Note: *viewing* a group's post list intentionally does not require membership in this codebase (`posts.Service.ListGroupPosts` doc comment) — see Known gaps.
- ✅ **Event creation requires title/description/time and going/not-going options; member response recorded and updatable; non-member cannot create/respond**: `groups/events_test.go` (6 tests)
- ✅ **Direct message permission rules (only connected users; sender/recipient/content/timestamp persisted; emoji round-trips)**: `chat/chat_test.go` (5 tests)
- ⚠️ **Group chat messages scoped to members**: not implemented in this codebase — there is no group-chat/`group_messages` feature at all (only 1:1 `private_messages`). Not testable; see Known gaps.
- ✅ **Follow request to private profile → notification for recipient**: **not actually true in this codebase** — see Bugs found below. Covered instead by testing the `notifications` package directly plus the two flows that *do* wire a notifier correctly, so the gap is documented rather than silently assumed.
- ✅ **Group invitation → notification for invitee**: `notifications/notifications_test.go: TestGroupInvitation_GeneratesNotificationForInvitee`
- ✅ **Group join request → notification for creator**: `TestGroupJoinRequest_GeneratesNotificationForCreator`
- ✅ **New group event → notification for members**: `TestNewGroupEvent_GeneratesNotificationForMembers`
- ✅ **Notifications scoped to intended recipient only**: `TestNotifications_ScopedToIntendedRecipientOnly` + the invitation/join-request/event tests each also assert other users receive nothing

## Known gaps

- **Real-time WebSocket delivery**: `internal/websocket.Hub` fan-out and the actual `internal/chat` / `internal/groups` WS handlers that push live events to connected clients are not unit-testable without a running server and real socket connections. The tests instead cover the message-persistence and permission-check functions those handlers call (`chat.Service.HandlePrivateMessage`, `followers.Service.CanMessage`), per the task's own scoping note. Needs an integration/e2e test with a real WS client.
- **Group chat**: no group-chat feature exists in the backend (no `group_messages` table, no service/handler) — group members currently only get group *posts/comments* and *events*, not a live chat. Nothing to test here; flagged instead of fabricated.
- **Docker container checks, cross-browser/session checks, OAuth bonus**: out of scope for Go unit tests entirely — these require the actual container build, a browser automation harness, and a configured OAuth provider respectively. Need manual/e2e coverage.
- **Follow-request notification**: technically "coverable" but the underlying feature doesn't fire a notification at all — see Bugs found.

## Bugs found

- **`internal/followers.Service` is never wired to a notifier, so accepting/creating a follow request never generates a notification**, despite `notifications.NotificationFollowRequest` / `EntityFollowRequest` existing as first-class types clearly intended for this.
  - **Where**: `backend/internal/followers/service.go` (`Service` struct has no `notifier` field, unlike `groups.Service` and `chat.Service` which both take one) and its construction site `backend/internal/router/dependencies.go:71` (`followers.NewService(followersRepo)` — no notifier argument).
  - **Expected**: per the audit spec, "A follow request to a private profile generates a notification for the recipient" — matching how `groups.Service` notifies on invitations/join requests/events.
  - **Actual**: `followers.Service.CreateFollowRequest` and `AcceptFollowRequest` never call anything resembling `notifications.Service.Notify`; a user with a pending follow request gets no notification of any kind.
  - **Left unfixed** per the task instructions (don't silently patch production code from a test finding) — flagged here for a maintainer to decide whether to wire a `NotificationSender` into `followers.Service` the same way `groups.Service` and `chat.Service` already are.

No other functional bugs were found; all other audited behaviors matched their implementation once source was read directly (see inline comments in the tests where behavior was non-obvious, e.g. `ListGroupPosts` intentionally not requiring membership to view).

## How to run

```sh
cd backend
go test ./tests/...          # quiet
go test ./tests/... -v       # verbose, per-test output
```

No external services or environment variables are required — every test
spins up its own throwaway in-memory SQLite database.
