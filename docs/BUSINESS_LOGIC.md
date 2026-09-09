# Business Logic Guide

This document explains what **Business Logic** is in software development and provides a complete reference of all the business logic and domain rules in our **Social Network** project.

---

## 1. What is Business Logic?

In software engineering, **Business Logic** is the set of **core rules, workflows, calculations, and constraints** that define how an application functions and how data is created, transformed, validated, and stored.

It is the translation of **real-world rules** into code.

### The Analogy: A Game of Chess

Think of an application as a game of chess:

| Component | What it represents | In our Social Network |
| :--- | :--- | :--- |
| **Presentation (UI)** | The physical board, colors, and design of the pieces. | The Next.js pages, CSS styles, avatars, buttons, message bubbles. |
| **Database (Storage)** | The wooden box that stores the pieces when not playing. | SQLite tables (`users`, `posts`, `private_messages`, `groups`). |
| **Business Logic (The Rules)** | The rules of the game: *Knights move in an L-shape; Pawns cannot move backwards; You cannot put your own King in check.* | *Users cannot message themselves; Only approved followers can view private posts; Group events only accept "Going" or "Not Going".* |

---

## 2. Business Logic vs Other Types of Logic

Software systems generally contain three types of logic:

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Logic (UI)                  │
│   • "Show a blue bubble on the right for my messages"       │
│   • "Display a loading spinner while fetching"              │
│   • "Format the ISO timestamp to HH:MM AM/PM"               │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Business Logic (Domain)                  │
│   • "Is this user allowed to send a message to recipient?"  │
│   • "Did the user provide a valid birthdate (age > 13)?"    │
│   • "Does this account have private profile enabled?"       │
│   • "Mark unread messages as read when history is fetched"  │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Access Logic (Storage)              │
│   • "INSERT INTO private_messages VALUES (?, ?, ?)"         │
│   • "SELECT * FROM users WHERE id = ?"                      │
│   • "ROLLBACK transaction on SQL error"                     │
└─────────────────────────────────────────────────────────────┘
```

### Why Must Business Logic Live on the Backend?

1. **Security**: Frontend code (JavaScript/React) runs in the user's browser and can be modified, bypassed, or inspected via DevTools or curl. The backend is the **single source of truth** and must strictly enforce every rule.
2. **Data Integrity**: Database constraints (`UNIQUE`, `FOREIGN KEY`, `NOT NULL`) and backend services (`backend/internal/<domain>/service.go`) guarantee that corrupt or unauthorized data can never enter the database.
3. **Frontend Role**: The frontend mirrors validation (e.g., input lengths, required fields) purely for **User Experience (UX)** to give instant visual feedback before a network request is sent.

---

## 3. Social Network Project: Complete Business Logic

Below is the complete catalog of all business rules implemented (or required) across our application domains:

---

### 3.1. Authentication & User Accounts (`internal/auth`, `internal/users`)

- **Unique Identity:**
  - Email addresses and usernames must be globally unique across all accounts (case-insensitive).
- **Registration Requirements:**
  - Mandatory fields: Email, Password, First Name, Last Name, Date of Birth.
  - Optional fields: Username / Nickname, About Me / Bio, Profile Avatar image.
  - Minimum age restriction: Date of birth must be a valid past date (user must be at least a valid age).
- **Password Security:**
  - Plaintext passwords must never be stored.
  - Passwords must be hashed using a cryptographic one-way hashing algorithm (`bcrypt`).
  - Passwords must meet minimum length/complexity requirements (e.g., minimum 8 characters).
- **Session Management:**
  - On successful login, the server issues a cryptographically secure random session UUID.
  - The session token is transmitted via an `HttpOnly`, `SameSite=Lax` cookie to prevent Cross-Site Scripting (XSS) token theft.
  - Sessions have an expiration time.
  - Logging out invalidates the session record in the database and clears the browser cookie.
  - Only one active session is linked per cookie.

---

### 3.2. Profiles & Social Graph (`internal/users`, `internal/followers`)

- **Profile Privacy Setting:**
  - Every user account has a privacy toggle: **Public** or **Private** (default is Public).
  - Users can switch their profile between Public and Private at any time.
- **Following Rules:**
  - A user **cannot follow themselves**.
  - **Public Profile:** Clicking "Follow" immediately establishes a following relationship.
  - **Private Profile:** Clicking "Follow" creates a **pending Follow Request**. The target user must explicitly **Accept** or **Decline** the request.
- **Content Visibility Rules:**
  - **Public Profile:** Any authenticated user can view their profile info, followers list, following list, and public posts.
  - **Private Profile:** Non-followers can only see basic profile info (name, username, avatar). Posts, followers lists, and following lists are strictly hidden until the follow request is accepted.
- **Unfollowing:**
  - Unfollowing immediately revokes access to the private profile's posts and removes the user from their followers list.

---

### 3.3. Posts & Comments (`internal/posts`, `internal/comments`)

- **Post Privacy Tiers:**
  Every post must belong to one of three privacy levels:
  1. **Public:** Visible to all registered users of the platform.
  2. **Private (Followers Only):** Visible only to approved followers of the author.
  3. **Almost Private (Custom Selected Followers):** Visible only to a specific whitelist of followers chosen by the author at the time of creation.
- **Post Content:**
  - Posts may contain text, an image, or both. A post cannot be completely empty (must have text or an image).
  - Text length has an upper bound (e.g., maximum 5,000 characters).
- **Image Attachments:**
  - Permitted image formats: JPEG/JPG, PNG, GIF.
  - Maximum upload file size limit (e.g., 5MB).
  - Images are validated on the backend before being written to disk (`/uploads/posts/`).
- **Comments Rules:**
  - A user can only comment on a post if they have permission to **view** that post.
  - Comments must contain valid non-empty text (and optional image).
  - Comments inherit the access control of the parent post.

---

### 3.4. Groups & Communities (`internal/groups`)

- **Group Creation:**
  - Any registered user can create a group by providing a non-empty Title and Description.
  - The creator automatically becomes the first **Member** and the **Owner/Admin** of the group.
- **Membership & Joining:**
  - **Join Request Flow:**
    - A non-member can send a request to join a group.
    - Only the group creator/admin can view pending join requests and **Accept** or **Reject** them.
    - Duplicate pending requests are blocked.
  - **Invitation Flow:**
    - Group members can invite external users to join the group.
    - The invited user receives an invitation and can **Accept** or **Decline**.
- **Group Access Control:**
  - Non-members can only see group metadata (Title, Description, Member Count).
  - **Group Posts & Comments:** Only accepted group members can view posts, create posts, or comment inside a group.
- **Group Events:**
  - Any group member can create an event with: Title, Description, and Event Date/Time (must be in the future).
  - Group members can respond to the event with an RSVP: **Going** or **Not Going**.
  - A user can change their RSVP option at any time before the event.

---

### 3.5. Real-Time Private Messaging (`internal/chat`)

- **Self-Messaging Block:**
  - A user cannot send a private message to themselves (`sender_id != recipient_id`).
- **Recipient Verification:**
  - The server verifies that `recipient_id` exists in the database before saving or routing.
- **Content Limits:**
  - Messages cannot be empty or consist solely of whitespace (`ErrEmptyMessage`).
  - Messages cannot exceed `MaxMessageLength = 2000` UTF-8 characters.
- **Messaging Permissions:**
  - Users can only message each other if there is an existing follow relationship (at minimum, one follows the other, or mutual followers depending on configuration).
- **History & Pagination:**
  - Message history is ordered chronologically.
  - History is paginated (limit between 1 and 50, default 10-20, offset-based) so large histories don't overwhelm bandwidth.
- **Read Receipts & Unread Counters:**
  - New incoming messages are saved with `read_at = NULL`.
  - When a user opens a conversation or fetches chat history, all unread messages from that partner are marked with `read_at = CURRENT_TIMESTAMP`.
  - A real-time `messages_read` event is dispatched back to the sender so their double checkmarks (`✓✓`) update live.
  - In the sidebar, if a message arrives from someone other than the currently active conversation, their `unread_count` increments by 1.
- **Presence & Live Typing:**
  - When a user's WebSocket connects, they are broadcast as `user_online` to active peers; on disconnect, `user_offline`.
  - Typing events are transient (not saved to the database) and include an inactivity timeout (1.5–2s) to prevent stuck typing indicators.

---

### 3.6. Notifications (`internal/notifications`)

- **Triggers for Notifications:**
  - Follow request received (for private profiles).
  - Follow request accepted.
  - Group invitation received.
  - Group join request received (sent to group creator).
  - Group join request accepted.
  - New group event created.
- **Delivery Rules:**
  - Real-time: Pushed immediately via WebSocket if recipient is online.
  - Persistence: Saved in the `notifications` table so offline users see them upon next login.
  - Notifications can be marked as read individually or all at once.

---

## 4. Where Business Logic Lives in Our Codebase

| Layer | Directory | Responsibility |
| :--- | :--- | :--- |
| **Go Service Layer** | [`backend/internal/<domain>/service.go`](file:///Users/baderal3foo/git/reboot01/Projects/social-network/backend/internal) | The primary home for business rules, validation, permission checks, and event dispatching. |
| **Go Validation** | [`backend/internal/validation/`](file:///Users/baderal3foo/git/reboot01/Projects/social-network/backend/internal/validation) | Sanitizing inputs, email format checks, length limits. |
| **Database Constraints** | [`backend/pkg/db/migrations/sqlite/`](file:///Users/baderal3foo/git/reboot01/Projects/social-network/backend/pkg/db/migrations/sqlite) | Foreign keys, `CHECK` constraints, `UNIQUE` indexes, `NOT NULL`. |
| **Frontend Custom Hooks** | [`frontend/src/features/<domain>/hooks/`](file:///Users/baderal3foo/git/reboot01/Projects/social-network/frontend/src/features) | Client-side state coordination, real-time message buffering, optimistic updates (e.g. `useChat`). |
| **Frontend API Clients** | [`frontend/src/features/<domain>/api/`](file:///Users/baderal3foo/git/reboot01/Projects/social-network/frontend/src/features) | Translating UI requests into backend REST calls with proper error handling. |
