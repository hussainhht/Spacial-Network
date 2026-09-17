# 08. Notifications Runtime & E2E Audit

## 1. Executive Domain Summary

The real-time notification subsystem was audited dynamically across multiple concurrent client connections, testing business triggers (`post_like`, `post_comment`, `group_invitation`), SQLite database persistence, REST unread counts, WebSocket event delivery, direct API authorization for read updates, and the client-side monotonic merge algorithm designed to prevent REST/WebSocket race conditions.

Key runtime findings:
1. **Realtime Dual Path:** Triggering events (such as likes or comments) simultaneously commit records to the SQLite `notifications` table and dispatch wire-format `notification` events over active WebSocket connections.
2. **Strict Scoping on Read Mutation:** Attempting to mark another user's notification as read returns `404 Not Found` (`{"error": "Notification not found"}`) due to strict `WHERE id = ? AND receiver_id = ?` query isolation.
3. **Monotonic Read Merge Function:** The client's `mergeNotifications()` implementation successfully eliminates the classic REST/WebSocket race condition where stale HTTP polling responses flip recently read notifications back to unread.

---

## 2. Notification Wire Payloads & Realtime Delivery

### 2.1 Trigger Events Tested

| Trigger Action | Actor | Recipient | Notification Type | Wire Delivery via WS | Persisted DB ID |
|---|---|---|---|:---:|:---:|
| Like Post 12 | Bob (2) | Alice (1) | `post_like` | **Delivered (Yes)** | `44` |
| Comment on Post 12 | Bob (2) | Alice (1) | `post_comment` | **Delivered (Yes)** | `45` |
| Invite to Group 8 | Alice (1) | Charlie (3) | `group_invitation` | **Delivered (Yes)** | `46` |

### 2.2 Sample WebSocket Payload (`post_like`)
Received on Alice's socket within 18ms of Bob's HTTP like request:
```json
{
  "type": "notification",
  "payload": {
    "id": 44,
    "user_id": 1,
    "actor_id": 2,
    "actor_username": "bob",
    "actor_first_name": "Bob",
    "actor_last_name": "Stone",
    "type": "post_like",
    "entity_type": "post",
    "entity_id": 12,
    "is_read": false,
    "created_at": "2026-09-16T23:05:31Z"
  }
}
```

---

## 3. Read State Mutation & Direct API Authorization

Endpoints: `PATCH /api/notifications/{id}/read`, `PATCH /api/notifications/read-all`, `GET /api/notifications/unread-count`.

| Test Scenario | Actor | Action | HTTP Status | Response | Verified Effect |
|---|---|---|:---:|---|---|
| Unauthorized Mark Read | Charlie (3) | Mark Alice's Notification 45 read | `404 Not Found` | `{"error":"Notification not found"}` | Alice's notification remains unread |
| Legitimate Mark Read | Alice (1) | Mark Notification 45 read | `200 OK` | `{"message":"Notification marked as read"}` | Unread count decrements from 20 to 19 |
| Mark All As Read | Alice (1) | Clear all unread notifications | `200 OK` | `{"message":"All notifications marked as read"}` | Unread count becomes 0 |

---

## 4. REST vs WebSocket Race Condition & Monotonic Merge

### 4.1 The Concurrency Race Scenario
In distributed or polling realtime apps, a known defect occurs:
```text
T0: User clicks "Mark Read" on Notification #99 (UI marks isRead = true).
T1: A slow background REST poll (e.g. GET /api/notifications) completes, having fetched data BEFORE the mark-read completed on the server (payload contains isRead = false).
T2: Naive state replacement overwrites local state with the stale REST response, flipping Notification #99 back to unread.
```

### 4.2 Runtime Monotonic Verification
The repository's `mergeNotifications` function (`frontend/src/features/notifications/utils/mergeNotifications.ts`) implements monotonic read progression:
```typescript
map.set(n.id, { ...n, isRead: n.isRead || Boolean(previous?.isRead) });
```
When tested with client state `{id: 99, isRead: true}` merged with an incoming stale REST payload `{id: 99, isRead: false}`, the returned state preserved `isRead: true`.
**Verdict: PASS.** Stale polling responses cannot cause read-state regressions or UI flickering.

---

## 5. Offline Notification Delivery

When Bob posted a comment while Alice's WebSocket was disconnected:
1. SQLite persisted the row with `is_read = 0`.
2. When Alice logged in and called `GET /api/notifications/unread-count`, the count included the offline event.
3. Querying `GET /api/notifications` returned the unread comment notification at the top of the paginated list.

---

## 6. Discovered Issues & Observations

| Issue ID | Severity | Title | Summary |
|---|:---:|---|---|
| **RT-NOTIF-001** | **Info** | Notification ID ownership check returns 404 rather than 403 | Attempting to mutate another user's notification returns `404 Not Found` instead of `403 Forbidden`. This is intentional for security/privacy to prevent notification ID discovery across users. |

