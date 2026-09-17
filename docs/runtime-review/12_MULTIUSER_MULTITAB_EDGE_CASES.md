# 12. Multi-User & Multi-Tab Edge Cases Runtime Audit

## 1. Executive Domain Summary

Complex state synchronization, multi-tab interactions, and concurrent multi-user race conditions were audited dynamically across authenticated sessions.

Key runtime findings:
1. **Simultaneous Bidirectional Messaging:** Transmitting parallel private messages between Alice and Bob at the exact same millisecond succeeded without deadlocks, lost frames, or SQLite locking issues.
2. **Single Active Session Conflict (RT-SESSION-001):** Opening a second browser/profile and logging in as the same user immediately invalidates the first session's token in SQLite. Subsequent REST requests on the first browser fail with `401 Unauthorized: invalid session`.
3. **Multi-Tab WebSocket Distribution:** When a user opens multiple tabs under the *same* session cookie, the Go Hub multiplexer fans out private messages to all open sockets simultaneously.
4. **Decoupled Session Invalidation:** Logging out in Tab 1 clears the cookie and revokes the DB session, but does **not** close Tab 2's active WebSocket connection (see `RT-WS-001`).

---

## 2. Multi-User Concurrency & Race Tests

### 2.1 Simultaneous Bidirectional Messaging
Two concurrent WebSocket clients (Alice, User 1 and Bob, User 2) dispatched messages simultaneously:
- **Alice Frame:** `"Simultaneous from Alice 1789601398"` -> Recipient: 2
- **Bob Frame:** `"Simultaneous from Bob 1789601398"` -> Recipient: 1

**Observed Result:**
- SQLite's single-connection serializer (`SetMaxOpenConns(1)`) ordered the transactions atomically without transaction aborts or busy timeouts.
- Alice received Bob's message and sender confirmation for her own message.
- Bob received Alice's message and sender confirmation for his own message.
- **Verdict: PASS.**

---

## 3. Multi-Tab / Same User Scenarios

| Multi-Tab Scenario | Observed Runtime Behavior | Consistency Verdict |
|---|---|:---:|
| **Two Tabs Open, Incoming Message** | Both tabs receive the `private_message` WebSocket frame and render the message simultaneously. | **PASS** |
| **Tab 1 Closes, Tab 2 Active** | Hub unregisters Tab 1; Tab 2 continues receiving incoming messages and notifications. | **PASS** |
| **Tab 1 Logs Out** | Tab 1 receives expired cookie. Tab 2's next REST call fails with `401 Unauthorized`. However, Tab 2's WebSocket remains open. | **PARTIAL (RT-WS-001)** |
| **Second Login by Same User** | Device B logs in. SQLite updates `sessions SET session_token = ? WHERE user_id = ?`. Device A's session token is overwritten and invalidated. | **FAIL (RT-SESSION-001)** |

---

## 4. Discovered Issues & Observations

| Issue ID | Severity | Title | Summary |
|---|:---:|---|---|
| **RT-SESSION-001** | **High** | Single concurrent session limit per user account | Logging in on a second tab/device overwrites the session token in the database, causing the first session to be immediately logged out. |
| **RT-WS-001** | **High** | WebSocket connection survives user logout | When a session is logged out via REST, active WebSocket connections on other tabs remain open and able to send/receive messages. |

