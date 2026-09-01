# Person 4 — WebSocket, Chat & Notifications

## Main Responsibility

Own the real-time communication layer, Private Chat, Group Chat, and Notification infrastructure.

This includes:

- Database migrations
- WebSocket backend
- Chat APIs/history
- Notification backend
- Frontend chat/notification UI
- Feature-level validation and testing

Authentication, Docker, and final project-wide integration are not included in this checklist.

---

## 1. WebSocket Core

### Backend

- [x] Create WebSocket endpoint
- [x] Upgrade HTTP connection to WebSocket
- [x] Identify/authenticate the connected user using the existing session system
- [x] Create WebSocket Hub
- [x] Register connected users
- [x] Unregister disconnected users
- [x] Track active connections
- [x] Implement read loop
- [x] Implement write loop
- [x] Handle connection errors
- [x] Handle client disconnects safely
- [x] Avoid concurrent map/write issues
- [x] Support multiple users connected at the same time
- [x] Create a clear real-time message/event format
- [x] Separate chat events from notification events

Suggested structure:

```text
WebSocket Hub
├── Connected Users
├── Private Messages
├── Group Messages
└── Notifications
```

### Frontend

- [x] Create WebSocket client connection
- [x] Connect after the user is authenticated
- [x] Handle incoming WebSocket messages
- [x] Reconnect safely when connection is lost
- [x] Route incoming events to Chat or Notifications UI

---

## 2. Private Chat

### Database

- [x] Create `private_messages` table migration
- [x] Store sender ID
- [x] Store receiver ID
- [x] Store message content
- [x] Store message timestamp
- [x] Create matching `.down.sql` migration

### Backend

- [x] Send private message
- [x] Receive private messages in real time
- [x] Save messages to SQLite
- [x] Load chat history between two users
- [x] Return messages in correct order
- [x] Support text messages
- [x] Support emojis
- [x] Prevent sending empty/invalid messages
- [ ] Check whether messaging is allowed before sending
- [ ] Reuse follower/profile checks from Person 3
- [x] Deliver to connected receiver immediately when allowed
- [x] Keep stored messages available when a user reconnects

### Chat Permission

- [ ] Implement the project's follow/profile-based messaging rules
- [ ] Prevent unauthorized private messaging
- [ ] Keep permission logic outside the raw WebSocket transport when possible

### Frontend

- [ ] Create private Chat page or panel
- [ ] Display conversation history
- [ ] Display sender and receiver messages correctly
- [ ] Add message input
- [ ] Send message over WebSocket
- [ ] Display incoming messages immediately
- [ ] Support emoji text
- [ ] Keep UI usable when the other user is offline

---

## 3. Group Chat

### Database

- [ ] Create `group_messages` table migration
- [ ] Store group ID
- [ ] Store sender/user ID
- [ ] Store message content
- [ ] Store timestamp
- [ ] Create matching `.down.sql` migration

### Backend

- [ ] Send a message to a group chat
- [ ] Save group messages to SQLite
- [ ] Load group chat history
- [ ] Check group membership before sending
- [ ] Check group membership before returning history
- [ ] Broadcast messages only to connected group members
- [ ] Prevent non-members from receiving group messages
- [ ] Reuse group membership logic from Person 1

### Frontend

- [ ] Add Group Chat UI
- [ ] Display previous group messages
- [ ] Add group message input
- [ ] Send group messages over WebSocket
- [ ] Display incoming group messages immediately
- [ ] Hide/prevent chat access for non-members

---

## 4. Notification Infrastructure

Person 4 owns the notification system itself.

Other features create/trigger notifications when their own actions happen.

### Database

- [ ] Create `notifications` table migration
- [ ] Store receiver/user ID
- [ ] Store notification type
- [ ] Store related entity/reference ID if needed
- [ ] Store notification data/message
- [ ] Store read/unread state
- [ ] Store creation time
- [ ] Create matching `.down.sql` migration

### Backend

- [ ] Create notification service
- [ ] Create/store notification
- [ ] Get notifications for the current user
- [ ] Get unread notifications
- [ ] Get unread notification count
- [ ] Mark one notification as read
- [ ] Mark notifications as read if required
- [ ] Send new notifications in real time when the user is connected
- [ ] Keep notifications stored for offline users
- [ ] Keep notification events separate from private chat messages

### Required Notification Types

- [ ] Follow Request
- [ ] Group Invitation
- [ ] Group Join Request
- [ ] New Group Event

### Frontend

- [ ] Create global Notifications UI
- [ ] Make notifications accessible from every page
- [ ] Display unread count
- [ ] Display notification list
- [ ] Update unread count in real time
- [ ] Mark notification as read
- [ ] Visually separate notifications from chat messages

---

## 5. Responsibility Boundary for Notifications

Person 4 should NOT implement the business logic for:

- Follow requests
- Group invitations
- Group join requests
- Group events

Those features are owned by other team members.

Person 4 provides the notification system they can call.

Example flow:

```text
Person 3 creates Follow Request
             ↓
Notification Service
             ↓
Store Notification
             ↓
Send Real-Time Notification
```

And:

```text
Person 1 creates Group Invitation / Join Request / Event
             ↓
Notification Service
             ↓
Store Notification
             ↓
Send Real-Time Notification
```

---

## 6. Dependencies on Other Team Members

From Person 1:

- [ ] Use shared group membership checks for Group Chat

From Person 3:

- [ ] Use follower relationship checks for Private Chat
- [ ] Use profile privacy information when required by the messaging rules

For Persons 1 and 3:

- [ ] Provide a simple notification service/API they can call from their features

---

## 7. Feature Testing

- [ ] Test WebSocket connect
- [ ] Test WebSocket disconnect
- [ ] Test multiple connected users
- [ ] Test private message delivery
- [ ] Test stored private chat history
- [ ] Test unauthorized private messaging
- [ ] Test emoji messages
- [ ] Test group chat
- [ ] Test non-member group chat restrictions
- [ ] Test notification creation
- [ ] Test notification persistence for offline users
- [ ] Test real-time notification delivery
- [ ] Test unread notification count
- [ ] Test mark-as-read
- [ ] Test that notifications and chat messages remain separate
