# 05. Groups & Events Runtime & E2E Audit

## 1. Executive Domain Summary

The Groups, Memberships, Invitations, and Events subsystems were audited across 5 authenticated personas (`alice`, `bob`, `charlie`, `diana`, `frank`), validating group lifecycle operations, privacy boundaries, membership authorization, and RSVP dynamics.

Key runtime findings:
1. **Private Group Cloaking:** Private groups are completely hidden from the public group directory. Direct API lookups by non-members return `404 Not Found`, and join request attempts return `403 Forbidden ("Private groups are invite only")`.
2. **Creator Authorization:** Group join requests can strictly only be accepted or rejected by the group creator (`403 Forbidden` for non-creators).
3. **Invitation Constraints:** In this backend implementation, group invitations are creator-only (`403 Only the group creator can invite people`). Standard members cannot issue invitations.
4. **Group Content Isolation:** Non-members cannot view or create group posts, view group events, or submit RSVPs (`403 You must be a member of this group to do this`).
5. **Event Temporal Enforcement:** Events require future timestamps; past dates are rejected with `400 Bad Request`.

---

## 2. Group Creation & Privacy Semantics

### 2.1 Group Creation
- **Endpoint:** `POST /api/groups`
- **Content-Type:** `multipart/form-data`
- **Fields:** `title`, `description`, `privacy` (`public` | `private`), optional `image_template_id` or `groupPhoto` file.
- **Response Shape:** `{"success": true, "message": "Group created successfully", "group_id": <id>}`.

### 2.2 Public vs Private Group Visibility

| Action / Query | Public Group (ID 8) | Private Group (ID 9) |
|---|:---:|:---:|
| Directory Listing (`GET /api/groups`) for Outsider | Visible in array | **Hidden from array** |
| Direct Detail Lookup (`GET /api/groups/{id}`) for Outsider | `200 OK` (Public info) | `404 Not Found` (`{"message":"Group not found"}`) |
| Join Request Submission (`POST /api/groups/{id}/join-requests`) | `201 Created` (`"Join request sent"`) | `403 Forbidden` (`"Private groups are invite only"`) |
| Entry Method | Join request approval or Invite | Strictly invite-only by creator |

---

## 3. Group Join Requests & Direct Authorization

Tested workflow for public group (ID 8, Creator: Alice):
1. **Submission:** Diana (outsider) submitted `POST /api/groups/8/join-requests`.
   - Result: `201 Created` (`{"success":true,"message":"Join request sent successfully"}`).
2. **Duplicate Request:** Diana submitted a second join request while one was already pending.
   - Result: `409 Conflict` (`{"success":false,"message":"A pending join request already exists"}`).
3. **Pending Queue Inspection:** Alice inspected `GET /api/groups/8/join-requests`.
   - Result: `200 OK` with `join_requests: [{id: 4, username: "diana", status: "pending", ...}]`.
4. **Bypass Attempt (Non-Creator):** Bob (unrelated member) attempted to accept Diana's request via `POST /api/groups/8/join-requests/4/accept`.
   - Result: `403 Forbidden` (`{"success":false,"message":"Only the group creator can do this"}`).
5. **Legitimate Approval:** Alice (creator) approved Diana's request.
   - Result: `200 OK` (`{"success":true,"message":"Join request accepted"}`).
6. **Membership Confirmation:** Querying Diana's membership (`GET /api/groups/8/membership`) returned:
   ```json
   {
     "success": true,
     "is_member": true,
     "role": "member",
     "has_pending_join_request": false
   }
   ```

---

## 4. Group Invitations Workflow

- **Endpoint:** `POST /api/groups/{id}/invitations`
- **Payload:** `{"invited_user_id": <id>}` (Note: requires `invited_user_id` as field name).

| Action | Actor | HTTP Status | Response |
|---|---|:---:|---|
| Member attempts invite | Diana (member) invites Charlie | `403 Forbidden` | `{"success":false,"message":"Only the group creator can invite people"}` |
| Creator issues invite | Alice (creator) invites Frank | `201 Created` | `{"success":true,"message":"Invitation sent successfully"}` |
| Invitee queries invites | Frank queries `GET /api/group-invitations` | `200 OK` | Listed in `invitations` array with inviter details |
| Invitee accepts invite | Frank sends `POST /api/group-invitations/{id}/accept` | `200 OK` | `{"success":true,"message":"Invitation accepted"}` |
| Membership verified | Frank queries `/groups/8/membership` | `200 OK` | `role: "member"`, `is_member: true` |

---

## 5. Group Posts & Content Authorization

Endpoints: `POST /api/groups/{id}/posts`, `GET /api/groups/{id}/posts`.

| Scenario | User | HTTP Status | Observed Behavior |
|---|---|:---:|---|
| Member creates group post | Diana (`member`) | `201 Created` | Post created with `group_id: 8` and `group_title` |
| Member views group posts | Frank (`member`) | `200 OK` | Sees Diana's group post |
| Non-member creates group post | Charlie (`outsider`) | `403 Forbidden` | `{"error":"You must be a member of this group to do this"}` |
| Non-member reads group posts | Charlie (`outsider`) | `403 Forbidden` | `{"error":"You must be a member of this group to do this"}` |

---

## 6. Group Events & RSVPs E2E

### 6.1 Event Creation Constraints
- **Endpoint:** `POST /api/groups/{id}/events`
- **Date Validation:**
  - Submission with `event_time: "2026-09-15T..."` (past date) returned `400 Bad Request` (`{"success":false,"message":"event time must be in the future"}`).
  - Submission by Charlie (non-member) returned `403 Forbidden` (`{"success":false,"message":"You must be a member of this group to do this"}`).
  - Submission by Diana (member) with future date returned `201 Created` with `event_id: 5`.

### 6.2 Attendee RSVP Dynamics
- **Endpoint:** `PUT /api/groups/{id}/events/{eventID}/response`
- **Payload:** `{"response": "going" | "not_going"}`

| Actor | RSVP Value | HTTP Status | Event Response Snapshot |
|---|---|:---:|---|
| Frank (Member) | `going` | `200 OK` | `going_count: 1, not_going_count: 0, current_user_response: "going"` |
| Frank (Member) | `not_going` (Update) | `200 OK` | `going_count: 0, not_going_count: 1, current_user_response: "not_going"` |
| Charlie (Non-Member) | `going` | `403 Forbidden` | `{"success":false,"message":"You must be a member of this group to do this"}` |

---

## 7. Discovered Issues & Observations

| Issue ID | Severity | Title | Summary |
|---|:---:|---|---|
| **RT-GROUP-001** | **Info** | Group invitation payload expects `invited_user_id` | While intuitive frontend naming often uses `user_id`, the invitation endpoint requires `invited_user_id`. Mismatched field names result in `400 Bad Request`. |
| **RT-GROUP-002** | **Info** | Standard members cannot invite new members | Unlike platforms allowing open member invitations, this backend strictly restricts invitations to the group creator (`Only the group creator can invite people`). |

