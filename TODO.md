
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
- [X] Add proper foreign keys and constraints
- [X] Create matching `.down.sql` migrations

### Backend

- [X] Create a group
- [ ] Store group title
- [ ] Store group description
- [ ] Store group creator/owner
- [ ] Automatically add the creator as a group member
- [ ] Get all groups
- [ ] Get a group by ID
- [ ] Get group members
- [ ] Check whether a user is a group member
- [ ] Check whether a user is the group creator
- [ ] Prevent invalid or duplicate membership records
- [ ] Validate required group data
- [ ] Return proper HTTP errors

### Frontend

- [ ] Create Groups page
- [ ] Display all groups
- [ ] Create Group form
- [ ] Group details page
- [ ] Display title and description
- [ ] Display group creator
- [ ] Display group members
- [ ] Show correct actions depending on membership state

---

## 2. Group Join Requests

### Database

- [ ] Create `group_join_requests` table migration
- [ ] Store requester ID
- [ ] Store group ID
- [ ] Store request status if needed
- [ ] Prevent duplicate active join requests
- [ ] Create matching `.down.sql` migration

### Backend

- [ ] Allow a user to request to join a group
- [ ] Prevent members from sending another join request
- [ ] Prevent duplicate pending requests
- [ ] Get pending join requests for a group
- [ ] Allow only the group creator to review join requests
- [ ] Accept a join request
- [ ] Add accepted user to `group_members`
- [ ] Reject a join request
- [ ] Remove or update completed requests correctly

### Frontend

- [ ] Add Request to Join button
- [ ] Show pending state after sending request
- [ ] Create pending join requests UI for the group creator
- [ ] Add Accept button
- [ ] Add Reject button
- [ ] Update UI after accepting or rejecting a request

---

## 3. Group Invitations

### Database

- [ ] Create `group_invitations` table migration
- [ ] Store group ID
- [ ] Store invited user ID
- [ ] Store inviter user ID if needed
- [ ] Store invitation status if needed
- [ ] Prevent duplicate active invitations
- [ ] Create matching `.down.sql` migration

### Backend

- [ ] Allow the group creator to invite users
- [ ] Allow existing group members to invite users
- [ ] Prevent inviting an existing member
- [ ] Prevent duplicate pending invitations
- [ ] Get pending invitations for a user
- [ ] Accept invitation
- [ ] Add accepted user to the group
- [ ] Decline invitation
- [ ] Handle already completed invitations safely

### Frontend

- [ ] Create Invite User UI
- [ ] Display pending invitations
- [ ] Add Accept Invitation button
- [ ] Add Decline Invitation button
- [ ] Update group membership UI after accepting

---

## 4. Group Events

### Database

- [ ] Create `events` table migration
- [ ] Store group ID
- [ ] Store event creator ID
- [ ] Store event title
- [ ] Store event description
- [ ] Store event date/time
- [ ] Create `event_responses` table migration
- [ ] Store user response for each event
- [ ] Prevent duplicate responses for the same user/event
- [ ] Create matching `.down.sql` migrations

### Backend

- [ ] Allow group members to create an event
- [ ] Prevent non-members from creating events
- [ ] Get events for a group
- [ ] Get event details
- [ ] Support `Going`
- [ ] Support `Not Going`
- [ ] Allow a user to change their response
- [ ] Prevent non-members from responding to group events
- [ ] Validate event title
- [ ] Validate event description
- [ ] Validate event date/time
- [ ] Prevent unauthorized event access

### Frontend

- [ ] Display group events
- [ ] Create Event form
- [ ] Add event title field
- [ ] Add event description field
- [ ] Add date/time field
- [ ] Add Going button
- [ ] Add Not Going button
- [ ] Display the current user's response
- [ ] Allow the user to change their response

---

## 5. Interfaces Needed by Other Team Members

- [ ] Provide a reusable way to check group membership
- [ ] Provide a reusable way to check whether a user is the group creator
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

- [ ] Test creating a group
- [ ] Test browsing groups
- [ ] Test group details
- [ ] Test duplicate join requests
- [ ] Test accepting join requests
- [ ] Test rejecting join requests
- [ ] Test invitations
- [ ] Test accepting invitations
- [ ] Test declining invitations
- [ ] Test non-member restrictions
- [ ] Test event creation
- [ ] Test event responses
- [ ] Test unauthorized access
