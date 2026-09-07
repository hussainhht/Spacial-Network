# Person 1 — Groups & Group Events

## Main Responsibility

Own the complete Groups and Group Events features.

This includes:

- Database migrations
- Backend logic
- API handlers
- Frontend UI
- Feature-level validation and testing

Authentication, Docker, and final project-wide integration are not included in this checklist.

---

## 1. Groups

### Database

- [X] Create `groups` table migration
- [X] Create `group_members` table migration
- [X] Add proper foreign keys, constraints, and `.down.sql` migrations

### Backend

- [X] Create a group (title, description, creator, auto-add creator as member)
- [X] Get all groups (with pagination)
- [X] Get a group by ID
- [X] Get group members
- [X] Check whether a user is a group member / creator
- [X] Prevent invalid or duplicate membership records
- [X] Validate required group data and return proper HTTP errors

### Frontend

- [X] Create Groups page (browse all groups)
- [X] Create Group form
- [X] Group details page (title, description, creator, members)
- [X] Show correct actions depending on membership state

---

## 2. Group Join Requests

### Database

- [X] Create `group_join_requests` table migration (with constraints and `.down.sql`)

### Backend

- [X] Allow a user to request to join a group
- [X] Prevent members from sending another join request
- [X] Prevent duplicate pending requests
- [X] Get pending join requests for a group (creator only)
- [X] Accept a join request (adds user to `group_members` and updates status)
- [X] Reject a join request (updates status)

### Frontend

- [X] Add Request to Join button (with pending state)
- [X]  Pending join requests UI for group creator (with Accept and Reject buttons)
- [X] Update UI after accepting or rejecting a request

---

## 3. Group Invitations

### Database

- [X] Create `group_invitations` table migration (with constraints and `.down.sql`)

### Backend

- [X] Allow group creator and existing members to invite users
- [X] Prevent inviting an existing member or sending duplicate pending invitations
- [X] Get pending invitations for a user
- [X] Accept invitation (adds user to group and updates status)
- [X] Decline invitation (updates status)

### Frontend

- [X] Create Invite User UI
- [X] Display pending invitations (with Accept and Decline buttons)
- [X] Update group membership UI after accepting

---

## 4. Group Events

### Database

- [ ] Create `events` table migration (group ID, creator ID, title, description, date/time, and `.down.sql`)
- [ ] Create `event_responses` table migration (event ID, user ID, response status, unique constraint, and `.down.sql`)

### Backend

- [ ] Allow group members to create an event (validate title, description, date/time)
- [ ] Prevent non-members and unauthorized users from accessing/creating events
- [ ] Get events for a group and get event details
- [ ] Support event responses (`Going` / `Not Going`, members only, allow changing response)

### Frontend

- [ ] Display group events
- [ ] Create Event form (title, description, date/time)
- [ ] Event response UI (Going/Not Going buttons, display and change response)

---

## 5. Interfaces Needed by Other Team Members

- [ ] Make group membership checks easy to use from Group Posts and Group Chat

Suggested responsibility boundary:

```text
Groups feature decides:
- Who is a group member
- Who is the creator
- Who can join
- Who can invite
- Who can create/respond to events
```

---

## 6. Feature Testing

- [ ] Test creating, browsing, and viewing group details
- [ ] Test join requests (sending, duplicate prevention, creator accept/reject)
- [ ] Test invitations (sending, duplicate prevention, user accept/decline)
- [ ] Test non-member restrictions and unauthorized access
- [ ] Test event creation and event responses
