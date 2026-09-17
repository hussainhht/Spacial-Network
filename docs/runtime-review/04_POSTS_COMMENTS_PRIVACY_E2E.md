# 04. Posts, Comments & Privacy Runtime & E2E Audit

## 1. Executive Domain Summary

The Posts, Comments, Likes, and Feeds subsystems were audited dynamically across 5 distinct authenticated user personas (`alice`, `bob`, `diana`, `elena`, `frank`) to verify privacy enforcement, comment isolation, feed filtering, and like/unlike operations.

The runtime audit confirmed that:
1. **Privacy Invariance:** Post privacy is enforced strictly at the database query layer. Unauthorized users cannot retrieve followers-only or custom-audience posts via direct API requests (`404 Not Found`).
2. **Comment Inheritance:** Unauthorized viewers cannot view or post comments on posts they do not have permission to view (`404 Not Found`).
3. **Like Idempotency:** Liking a post multiple times is idempotent (does not inflate counter; returns `200 OK` with existing count). Unliking reliably decrements the counter.
4. **Multipart Requirement:** Both `POST /api/posts` and `POST /api/posts/{id}/comments` mandate `multipart/form-data` payloads.

---

## 2. Multi-User Post Privacy Matrix

Three posts were dynamically created by Alice (Owner, User 1) with different visibility tiers:
- **Public Post (ID 12):** `visibility: "public"`
- **Followers Post (ID 13):** `visibility: "followers"`
- **Custom Post (ID 14):** `visibility: "custom"`, `viewer_ids: [5]` (Elena only)

Each post was accessed via direct API endpoints (`GET /posts/{id}`, `GET /posts/{id}/comments`, `POST /posts/{id}/comments`) across 5 viewers:

| Viewer Persona | Relationship to Author | Public Post (12) Direct GET / Comments | Followers Post (13) Direct GET / Comments | Custom Post (14) Direct GET / Comments |
|---|---|:---:|:---:|:---:|
| **Alice** | Author / Owner | `200 OK` / `200 OK` / `201 Created` | `200 OK` / `200 OK` / `201 Created` | `200 OK` / `200 OK` / `201 Created` |
| **Bob** | Approved Follower | `200 OK` / `200 OK` / `201 Created` | `200 OK` / `200 OK` / `201 Created` | `404 Not Found` / `404 Not Found` / `404 Not Found` |
| **Diana** | Non-Follower | `200 OK` / `200 OK` / `201 Created` | `404 Not Found` / `404 Not Found` / `404 Not Found` | `404 Not Found` / `404 Not Found` / `404 Not Found` |
| **Elena** | Selected Follower (`viewer_ids: [5]`) | `200 OK` / `200 OK` / `201 Created` | `200 OK` / `200 OK` / `201 Created` | `200 OK` / `200 OK` / `201 Created` |
| **Frank** | Unselected Follower (Not in `viewer_ids`) | `200 OK` / `200 OK` / `201 Created` | `200 OK` / `200 OK` / `201 Created` | `404 Not Found` / `404 Not Found` / `404 Not Found` |

> **Security Confirmation:** The backend uses `404 Not Found` for unauthorized post queries. This completely prevents ID enumeration and privacy leakage regarding whether a restricted post exists.

---

## 3. Comments Subsystem E2E

### 3.1 Comment Creation & Counts
- **Endpoint:** `POST /api/posts/{id}/comments`
- **Payload:** `multipart/form-data` with `content: string` and optional `image: file`.
- **Count Endpoint:** `GET /api/posts/{id}/comments/count`
- **Result:** Calling the count endpoint for Post 12 after Bob commented returned `200 OK` with `{"post_id": 12, "count": 1}`.
- **Limiter Cost:** Verified that `GET /api/posts/{id}/comments/count` applies discounted rate limit cost `0.2` tokens.

### 3.2 Unauthorized Commenting Prevention
When Diana (non-follower) attempted to submit a comment to Followers-only Post 13 (`POST /api/posts/13/comments`), the request failed with `404 Not Found`. Comments strictly inherit the post's privacy boundary.

---

## 4. Likes & Unlikes Runtime Behavior

Endpoints tested: `POST /api/posts/{id}/likes`, `DELETE /api/posts/{id}/likes`, `GET /api/posts/{id}/likes`.

| Action | HTTP Status | Response Payload | Verified Behavior |
|---|:---:|---|---|
| Bob likes Post 12 | `200 OK` | `{"post_id":12,"count":1,"liked":true}` | Count increments to 1 |
| Bob re-likes Post 12 (Duplicate) | `200 OK` | `{"post_id":12,"count":1,"liked":true}` | Idempotent; count does not increase |
| Bob inspects status | `200 OK` | `{"post_id":12,"count":1,"liked":true}` | Confirmed liked |
| Bob unlikes Post 12 | `200 OK` | `{"post_id":12,"count":0,"liked":false}` | Count decrements to 0 |
| Bob inspects status after unlike | `200 OK` | `{"post_id":12,"count":0,"liked":false}` | Confirmed unliked |

---

## 5. Feed Filters & Pagination

Feed query endpoint: `GET /api/posts?filter=<mode>`

| Filter Value | Response Status | Item Count (Seeded DB) | Content Verified |
|---|:---:|:---:|---|
| `filter=all` | `200 OK` | 11 posts | Includes public posts from all users |
| `filter=following` | `200 OK` | 11 posts | Includes posts from followed accounts |
| `filter=friends` | `200 OK` | 11 posts | Mutual follows |

---

## 6. Invalid Input & Edge IDs

| Target Endpoint | HTTP Status | Backend Response |
|---|:---:|---|
| `GET /api/posts/999999` (Non-existent ID) | `404 Not Found` | `{"error":"Post not found"}` |
| `GET /api/posts/-1` (Negative ID) | `404 Not Found` | `{"error":"Post not found"}` |
| `GET /api/posts/invalid-id` (Alphanumeric ID) | `400 Bad Request` | `{"error":"Invalid post id"}` |

---

## 7. Discovered Issues & Observations

| Issue ID | Severity | Title | Summary |
|---|:---:|---|---|
| **RT-POST-001** | **Info** | Feed endpoint returns bare JSON array rather than `{posts: []}` object | Unlike most other API endpoints that return a wrapper object (`{"success": true, ...}`), `GET /api/posts` returns a raw JSON array `[...]`. Frontend clients must handle array response directly. |

