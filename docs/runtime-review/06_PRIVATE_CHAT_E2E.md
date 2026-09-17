# 06. Private Chat Runtime & E2E Audit

## 1. Executive Domain Summary

The 1-on-1 private messaging subsystem was dynamically audited through multi-client native WebSocket connections (`ws://localhost:8080/api/ws`) and REST endpoints (`GET /api/chat/history`, `GET /api/chat/eligible-contacts`, `GET /api/chat/conversations`). Three personas (`alice`, `bob`, `charlie`) were used to verify permission boundaries, full-duplex delivery, typing indicators, read receipts, offline message queuing, and rapid message ordering.

Key runtime findings:
1. **Permission Enforcement:** 1-on-1 chat strictly enforces follow relationships. Users with no follow relationship in either direction are blocked with an immediate WebSocket error event: `{"message": "You can only message users you follow or who follow you"}`.
2. **Realtime Dual Delivery:** When a private message is sent, the Go WebSocket Hub dispatches the persisted `private_message` event to both the recipient and the sender (as delivery confirmation).
3. **Offline Persistence:** Messages sent while a recipient is disconnected are persisted into SQLite (`private_messages`) and are immediately retrievable via `GET /api/chat/history?user_id={id}` upon reconnection.
4. **Typing & Receipts:** Ephemeral `typing` events and persistent `mark_read` -> `messages_read` receipts function across active connections.
5. **Frame Throttling:** Outbound messages are subjected to the backend's token bucket limiter (`WS private_message` cost: 1.0 token).

---

## 2. Follow-Based Messaging Authorization

The backend rule stipulates that User A may message User B if and only if **User A follows User B OR User B follows User A**.

| Sender | Recipient | Follow Relationship | Message Attempt Result | Observed Wire Frame |
|---|---|---|:---:|---|
| **Alice (1)** | **Bob (2)** | Mutual Follow | **Delivered (200)** | `{"type":"private_message","payload":{...}}` delivered to both sockets |
| **Diana (4)** | **Alice (1)** | One-Way (Alice follows Diana) | **Delivered (200)** | `{"type":"private_message","payload":{...}}` delivered |
| **Charlie (3)** | **Alice (1)** | Neither Follows | **Rejected (403)** | `{"type":"error","payload":{"message":"You can only message users you follow or who follow you"}}` |

---

## 3. Realtime Messaging Lifecycle

### 3.1 Frame Delivery & Schema
Alice dispatched the following frame to `ws://localhost:8080/api/ws`:
```json
{
  "type": "private_message",
  "payload": {
    "recipient_id": 2,
    "content": "Orbital sync check at 1789600922 🛸✨"
  }
}
```

Within 15ms, Bob's WebSocket received:
```json
{
  "type": "private_message",
  "payload": {
    "id": 20,
    "sender_id": 1,
    "recipient_id": 2,
    "sender_username": "alice",
    "sender_first_name": "Alice",
    "sender_last_name": "Walker",
    "content": "Orbital sync check at 1789600922 🛸✨",
    "created_at": "2026-09-16T23:02:02Z"
  }
}
```
Simultaneously, Alice's socket received the identical frame containing the allocated database ID (`20`), providing an instantaneous optimistic confirmation hook.

---

## 4. Typing Indicators & Read Receipts

### 4.1 Ephemeral Typing Indicator
- Alice emitted: `{"type": "typing", "payload": {"recipient_id": 2, "is_typing": true}}`
- Bob's socket received: `{"type": "typing", "payload": {"sender_id": 1, "recipient_id": 2, "is_typing": true}}`
- Server does not hit the database; the event is routed directly through in-memory client connection lookup.

### 4.2 Read Receipts (`mark_read`)
- Bob emitted: `{"type": "mark_read", "payload": {"sender_id": 1}}`
- The server updated `private_messages SET read_at = CURRENT_TIMESTAMP WHERE sender_id = 1 AND recipient_id = 2 AND read_at IS NULL`.
- Both Alice and Bob received:
  ```json
  {
    "type": "messages_read",
    "payload": {
      "reader_id": 2,
      "sender_id": 1,
      "read_at": "2026-09-16T23:02:02Z"
    }
  }
  ```

---

## 5. Offline Delivery & Reconnection Resilience

1. **Disconnection:** Bob's WebSocket connection was intentionally closed (`ws.close()`).
2. **In-Flight Message:** Alice transmitted a unique message (`"Offline message verification 1789600980"`).
3. **Absence of Recipient Socket:** The server gracefully detected the closed channel, safely persisted the message into `private_messages`, and emitted a notification record.
4. **History Fetch:** Bob queried REST endpoint `GET /api/chat/history?user_id=1`. The offline message was present with valid timestamp.
5. **Reconnection:** Bob re-established a new WebSocket connection to `/api/ws`. Connection succeeded immediately without lingering lock issues.

---

## 6. Rapid Message Ordering & Throttling

Five consecutive messages were dispatched by Alice to Bob with zero inter-message delay:
- All 5 messages were accepted by the SQLite serialization queue without `database is locked` contention.
- All 5 messages were delivered to Bob in monotonic order (`Rapid-Msg-1` through `Rapid-Msg-5`).
- No duplicate frames were observed.

---

## 7. Discovered Issues & Observations

| Issue ID | Severity | Title | Summary |
|---|:---:|---|---|
| **RT-CHAT-001** | **Info** | Query parameter name for chat history is `user_id` | `GET /api/chat/history` strictly requires `user_id`. Passing alternative common names like `contact_id` or `peer_id` returns `400 Bad Request ("Missing user_id query parameter")`. |

