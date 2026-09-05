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

- [x] Create `groups` table migration
- [x] Create `group_members` table migration
- [x] Add proper foreign keys, constraints, and `.down.sql` migrations

### Backend

- [x] Create a group (title, description, creator, auto-add creator as member)
- [x] Get all groups (with pagination)
- [x] Get a group by ID
- [x] Get group members
- [x] Check whether a user is a group member / creator
- [x] Prevent invalid or duplicate membership records
- [x] Validate required group data and return proper HTTP errors

### Frontend

- [x] Create Groups page (browse all groups)
- [x] Create Group form
- [x] Group details page (title, description, creator, members)
- [x] Show correct actions depending on membership state

---

## 2. Group Join Requests

### Database

- [x] Create `group_join_requests` table migration (with constraints and `.down.sql`)

### Backend

- [x] Allow a user to request to join a group
- [x] Prevent members from sending another join request
- [x] Prevent duplicate pending requests
- [x] Get pending join requests for a group (creator only)
- [x] Accept a join request (adds user to `group_members` and updates status)
- [x] Reject a join request (updates status)

### Frontend

- [ ] Add Request to Join button (with pending state)
- [ ] Pending join requests UI for group creator (with Accept and Reject buttons)
- [ ] Update UI after accepting or rejecting a request

---

## 3. Group Invitations

### Database

- [x] Create `group_invitations` table migration (with constraints and `.down.sql`)

### Backend

- [x] Allow group creator and existing members to invite users
- [x] Prevent inviting an existing member or sending duplicate pending invitations
- [x] Get pending invitations for a user
- [x] Accept invitation (adds user to group and updates status)
- [x] Decline invitation (updates status)

### Frontend

- [ ] Create Invite User UI
- [ ] Display pending invitations (with Accept and Decline buttons)
- [ ] Update group membership UI after accepting

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
