# 07. Group Chat Runtime & E2E Audit

## 1. Executive Domain Summary

The group messaging channel subsystem was dynamically audited through multi-client WebSocket connections and REST endpoints across 3 personas (`alice` as Group Creator, `diana` as Group Member, and `charlie` as Outsider) targeting Group 8 (*Stellar Cartography Union*).

The primary objective was to test real-time broadcast distribution, permission enforcement, and the high-risk integration scenario of **membership revocation on long-lived WebSocket connections**.

Key runtime findings:
1. **Dynamic Membership Authorization:** Unlike naive implementations that cache permissions at WebSocket upgrade time, this server queries current group membership from SQLite on **every single group message frame**.
2. **Immediate Revocation Effect:** When a member is removed via REST (`DELETE /api/groups/{id}/members/{userID}`), an existing, open WebSocket connection belonging to that user **immediately loses broadcast reception and transmission rights**.
3. **Outsider Isolation:** Non-members cannot receive broadcast frames, cannot send frames (`{"message": "You must be a member of this group to send messages"}`), and cannot query message history via REST (`403 Forbidden`).

---

## 2. Multi-Member Broadcast & Outsider Denial

With concurrent WebSocket connections open for Alice (Creator), Diana (Member), and Charlie (Outsider):

1. **Broadcast Transmission:** Alice dispatched:
   ```json
   {
     "type": "group_message",
     "payload": {
       "group_id": 8,
       "content": "Group 8 expedition announcement 1789601052"
     }
   }
   ```
2. **Delivery Results:**
   - **Diana (Member):** Received frame within 12ms.
   - **Alice (Creator):** Received frame with allocated database ID.
   - **Charlie (Outsider):** Did **NOT** receive the frame (0 bytes leaked).

3. **Outsider Send Attempt:** Charlie attempted to emit a `group_message` for Group 8 over WebSocket:
   - Server returned error event:
     ```json
     {
       "type": "error",
       "payload": {
         "message": "You must be a member of this group to send messages"
       }
     }
     ```

---

## 3. Group History REST Access Controls

- **Endpoint:** `GET /api/groups/{id}/messages`

| Persona | Role in Group 8 | HTTP Status | Response |
|---|---|:---:|---|
| **Diana** | Member | `200 OK` | Array of message objects with author summaries |
| **Charlie** | Outsider (Non-member) | `403 Forbidden` | `{"error": "You must be a member of this group to view messages"}` |

---

## 4. Active WebSocket Membership Revocation (High-Risk Test)

This test directly validates system behavior when membership is revoked while a WebSocket connection remains active:

### 4.1 Test Sequence
```text
T0: Diana is an active group member with an open WebSocket connection.
T1: Alice sends DELETE /api/groups/8/members/4 via REST.
    Backend response: 200 OK {"success": true, "message": "Member removed"}
T2: Diana's WebSocket remains physically connected and open.
T3: Alice dispatches a new group message: "Message after Diana removed 1789601053".
    Backend queries: GetGroupMembers(8)
    Diana is no longer in the member list; broadcast is NOT sent to Diana's client channel.
T4: Diana attempts to send a group message over her still-open WebSocket.
    Backend queries: IsGroupMember(8, 4) -> returns false
    Backend dispatches: {"type": "error", "payload": {"message": "You must be a member of this group to send messages"}}
```

### 4.2 Security Verdict
**PASS (Zero Authorization Lag):** The application completely avoids stale authorization vulnerabilities on persistent sockets. Membership changes take effect instantly across all active WebSocket channels.

---

## 5. Discovered Issues & Observations

| Issue ID | Severity | Title | Summary |
|---|:---:|---|---|
| **RT-GCHAT-001** | **Info** | Group message broadcast performs per-frame DB lookups | `GetGroupMembers` is queried on every message to construct the broadcast list. While this guarantees 100% real-time authorization correctness, high message throughput in large groups could increase SQLite read load. Under current single-connection pooling, this is well within safe bounds. |

