# Person 3 — Profiles & Followers

## Main Responsibility

Own the complete Profile and Followers features.

This includes:

- Database migrations
- Backend logic
- API handlers
- Frontend UI
- Profile privacy
- Follow requests
- Feature-level validation and testing

Authentication, Docker, and final project-wide integration are not included in this checklist.

---

## 1. User Profile

### Backend

- [X] Get the current user's profile
- [X] Get another user's profile by ID / username
- [ ] Return email
- [ ] Return first name
- [ ] Return last name
- [ ] Return date of birth
- [ ] Return avatar
- [ ] Return nickname
- [ ] Return About Me
- [ ] Return followers information
- [ ] Return following information
- [ ] Return user posts/activity information when needed
- [ ] Never expose the user's password
- [ ] Handle user-not-found errors

### Frontend

- [ ] Create own Profile page
- [ ] Create other-user Profile page
- [ ] Display profile avatar
- [ ] Display name
- [ ] Display nickname
- [ ] Display About Me
- [ ] Display date of birth according to the required visibility rules
- [ ] Display followers
- [ ] Display following
- [ ] Display user posts/activity

---

## 2. Profile Privacy

### Database

- [ ] Add/store profile privacy state
- [ ] Support Public profile
- [ ] Support Private profile
- [ ] Add migration if the existing `users` table needs modification
- [ ] Create matching `.down.sql` migration

### Backend

- [ ] Change profile from Public to Private
- [ ] Change profile from Private to Public
- [ ] Check profile privacy before exposing protected information
- [ ] Allow followers to view permitted private-profile information
- [ ] Prevent non-followers from viewing protected private-profile information
- [ ] Allow the profile owner to view their own information

### Frontend

- [ ] Add profile privacy control
- [ ] Show current privacy state
- [ ] Allow user to switch Public ↔ Private
- [ ] Update visible actions based on target profile privacy

---

## 3. Followers

### Database

- [ ] Create `followers` table migration
- [ ] Store follower user ID
- [ ] Store followed user ID
- [ ] Prevent duplicate follow relationships
- [ ] Prevent a user from following themselves
- [ ] Create matching `.down.sql` migration

### Backend

- [ ] Follow another user
- [ ] Unfollow another user
- [ ] Get followers list
- [ ] Get following list
- [ ] Check whether User A follows User B
- [ ] Check whether at least one user follows the other when needed by chat
- [ ] Handle invalid follow operations safely

### Public Profile Follow Flow

- [ ] Follow immediately when the target profile is Public
- [ ] Create follower relationship directly
- [ ] Do not require approval

### Frontend

- [ ] Add Follow button
- [ ] Add Unfollow button
- [ ] Display Followers list
- [ ] Display Following list
- [ ] Update button state after follow/unfollow

---

## 4. Follow Requests

### Database

- [ ] Create `follow_requests` table migration
- [ ] Store requester user ID
- [ ] Store target user ID
- [ ] Store request status if needed
- [ ] Prevent duplicate active requests
- [ ] Create matching `.down.sql` migration

### Backend

- [ ] Send follow request when target profile is Private
- [ ] Prevent duplicate pending requests
- [ ] Get incoming pending follow requests
- [ ] Accept follow request
- [ ] Create follower relationship after acceptance
- [ ] Decline follow request
- [ ] Remove/update completed request correctly
- [ ] Prevent unauthorized users from accepting/declining another user's requests

### Frontend

- [ ] Show Request Follow button for private profiles
- [ ] Show Requested/Pending state
- [ ] Create Follow Requests UI
- [ ] Add Accept button
- [ ] Add Decline button
- [ ] Update follower state after acceptance

---

## 5. Avatar / Profile Data

- [ ] Display avatar from registration/profile data
- [ ] Make sure optional nickname is handled correctly
- [ ] Make sure optional About Me is handled correctly
- [ ] Handle users without an avatar
- [ ] Reuse the project's existing image storage logic for avatar-related work when needed

---

## 6. Interfaces Needed by Other Team Members

For Person 2 — Posts:

- [ ] Provide a reusable follower check
- [ ] Provide a way to get a user's followers for Private post selection

For Person 4 — Chat:

- [ ] Provide a reusable check for whether User A follows User B
- [ ] Provide a reusable check for whether either user follows the other
- [ ] Provide target profile privacy information when required by chat rules

Suggested responsibility boundary:

```text
Profile/Followers feature decides:
- Whether a profile is public or private
- Who follows whom
- Whether a follow request is pending
- Whether a follow request is accepted or declined
```

---

## 7. Feature Testing

- [ ] Test viewing a public profile
- [ ] Test viewing a private profile as a follower
- [ ] Test viewing a private profile as a non-follower
- [ ] Test changing profile privacy
- [ ] Test following a public profile
- [ ] Test unfollowing
- [ ] Test sending a private-profile follow request
- [ ] Test duplicate follow requests
- [ ] Test accepting a follow request
- [ ] Test declining a follow request
- [ ] Test self-follow prevention
- [ ] Test follower/following lists
