# 03. Profiles & Followers Runtime & E2E Audit

## 1. Executive Domain Summary

The Profiles, Privacy, and Follower subsystem was thoroughly audited across multiple authenticated test personas (`alice`, `bob`, `charlie`, `diana`) exercising public profiles, private profiles, follow requests, authorization boundaries, and privacy toggles.

The runtime verification confirmed that:
1. **Public/Private Boundaries:** Fully enforced at the API layer. Non-followers cannot access private profiles' `about_me` or retrieve their followers/following lists via direct API calls (`403 Forbidden`).
2. **Direct Authorization:** Strict scoping prevents unauthorized users or the requester from accepting or declining follow requests (`404 Not Found`).
3. **State Transitions:** Follow requests transition cleanly through `none` -> `requested` -> `following` (on accept) or `none` (on decline/unfollow).
4. **Self-Follow Prevention:** Attempting to follow one's own account is blocked (`400 Bad Request`).

---

## 2. Profile Field Visibility & Privacy Matrix

Direct inspection of payloads returned by `GET /api/users/me` and `GET /api/profiles/{username}` confirmed strict privacy filtering.

### 2.1 Profile Attribute Exposure Matrix

| Profile Attribute | Own Profile (`/users/me`) | Public User (`/profiles/alice`) | Private User Non-Follower (`/profiles/charlie`) | Private User Follower (`/profiles/charlie`) |
|---|:---:|:---:|:---:|:---:|
| `id` | Yes (`1`) | Yes (`1`) | Yes (`3`) | Yes (`3`) |
| `username` | Yes (`alice`) | Yes (`alice`) | Yes (`charlie`) | Yes (`charlie`) |
| `first_name` | Yes (`Alice`) | Yes (`Alice`) | Yes (`Charlie`) | Yes (`Charlie`) |
| `last_name` | Yes (`Walker`) | Yes (`Walker`) | Yes (`Davis`) | Yes (`Davis`) |
| `nickname` | Yes (`StarGazer`) | Yes (`StarGazer`) | Yes (`NebulaHunter`) | Yes (`NebulaHunter`) |
| `about_me` | Yes (Full bio) | Yes (Full bio) | **MASKED / OMITTED** | Yes (Full bio) |
| `can_view_full_profile` | `true` | `true` | `false` | `true` |
| `is_private` | `false` | `false` | `true` | `true` |
| `email` | Yes (`alice@space.net`) | **NEVER EXPOSED** | **NEVER EXPOSED** | **NEVER EXPOSED** |
| `date_of_birth` | Yes (`1998-04-12`) | **NEVER EXPOSED** | **NEVER EXPOSED** | **NEVER EXPOSED** |
| `age` | Yes (`28`) | **NEVER EXPOSED** | **NEVER EXPOSED** | **NEVER EXPOSED** |
| `uuid` | Yes (`c0d58dd8-...`) | **NEVER EXPOSED** | **NEVER EXPOSED** | **NEVER EXPOSED** |

> **Security Confirmation:** Sensitive biographical fields (`email`, `date_of_birth`, `age`, `uuid`) are never leaked to any third-party viewer, regardless of follower relationship or profile privacy.

---

## 3. Followers / Following List Access Controls

Endpoints tested: `GET /api/profiles/{username}/followers` and `GET /api/profiles/{username}/following`.

### 3.1 Test Results

| Viewer | Target User | Target Privacy | HTTP Status | Response |
|---|---|---|:---:|---|
| Bob | Alice | Public | `200 OK` | Full list of follower user summaries |
| Diana | Charlie | Private (Non-Follower) | `403 Forbidden` | `{"success":false,"message":"You cannot view this private profile's followers","users":null}` |
| Diana | Charlie | Private (Non-Follower) | `403 Forbidden` | `{"success":false,"message":"You cannot view this private profile's following","users":null}` |
| Diana | Charlie | Private (Approved Follower) | `200 OK` | Array of follower user objects |

---

## 4. State Transitions & Direct API Authorization

### 4.1 State Machine: Follow Workflow
A multi-step state machine was tested between Diana and Charlie:

```text
[Initial: Not Following]
       │
       ▼ Diana sends POST /api/profiles/charlie/follow
[State: Pending Request] (has_pending_request: true, is_following: false)
       │
       ├──────────────────────────────────────────┐
       │ Target (Charlie) Accepts                 │ Target (Charlie) Declines
       ▼                                          ▼
[State: Following] (is_following: true)     [State: Not Following] (is_following: false)
       │
       ▼ Diana sends DELETE /api/profiles/charlie/follow
[State: Not Following] (is_following: false)
```

### 4.2 Authorization & Edge Case Verification

| Test Scenario | Action | HTTP Status | Observed Payload | Verdict |
|---|---|:---:|---|:---:|
| Self-Follow | Alice sends `POST /api/profiles/alice/follow` | `400 Bad Request` | `{"success":false,"message":"cannot follow yourself"}` | **PASS** |
| Duplicate Follow Request | Diana sends second follow request to Charlie while pending | `409 Conflict` | `{"success":false,"message":"follow request already pending"}` | **PASS** |
| Outsider Approves Request | Bob (user 2) sends `POST /api/follow-requests/6/accept` for Diana's request to Charlie | `404 Not Found` | `{"success":false,"message":"Follow request not found"}` | **PASS (Scoping Enforced)** |
| Requester Approves Own Request | Diana (requester) sends `POST /api/follow-requests/6/accept` | `404 Not Found` | `{"success":false,"message":"Follow request not found"}` | **PASS (Bypass Prevented)** |
| Target Approves Request | Charlie (target) sends `POST /api/follow-requests/6/accept` | `200 OK` | `{"success":true,"message":"Follow request accepted"}` | **PASS** |
| Target Declines Request | Charlie (target) sends `POST /api/follow-requests/6/decline` | `200 OK` | `{"success":true,"message":"Follow request declined"}` | **PASS** |
| Privacy Toggle | Alice sends `PATCH /api/users/me/privacy` with `{"is_private": true}` | `200 OK` | `{"success":true,"message":"Profile privacy updated","is_private":true}` | **PASS** |

---

## 5. Discovered Issues & Observations

| Issue ID | Severity | Title | Summary |
|---|:---:|---|---|
| **RT-FOLLOW-001** | **Info** | Follow request IDs return generic 404 for unauthorized approvers | The query `WHERE id = ? AND target_id = ?` returns `sql.ErrNoRows`, yielding `404 Not Found`. While secure (prevents ID enumeration), standard REST semantics often differentiate between 403 and 404. Confirmed safe. |

