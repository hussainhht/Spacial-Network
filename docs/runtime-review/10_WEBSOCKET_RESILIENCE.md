# 10. WebSocket Resilience, Concurrency & Security Audit

## 1. Executive Domain Summary

The WebSocket subsystem (`backend/internal/websocket`) was audited for concurrency, multi-tab state distribution, reconnection resilience, and session decoupling. The system uses a single multiplexed Gorilla WebSocket endpoint at `GET /api/ws` carrying chat, notifications, typing indicators, read receipts, and presence.

Key runtime findings:
1. **Critical Security Finding — WebSocket Survives Logout (RT-WS-001):** When a user logs out via REST (`POST /api/logout`), the HTTP session cookie and database session record are invalidated. However, the server does **not** close the user's active WebSocket connection, nor does it verify session validity upon processing incoming frames. A logged-out user can continue sending and receiving private messages indefinitely on an existing socket.
2. **Multi-Tab Fan-Out:** The Go `Hub` maintains a set of clients per user (`map[int64]map[*Client]bool`). Messages sent to a user are fanned out to all open tabs/devices simultaneously. Closing one tab does not impact the others.
3. **Unauthenticated Connect Loop (RT-WS-002):** The frontend `WebSocketProvider` is placed at `RootLayout` rather than the authenticated AppShell. On unauthenticated routes (`/login`, `/register`), the client loops every 1500ms attempting connection and failing with `401 Unauthorized`.

---

## 2. Multi-Connection (Multi-Tab) Fan-Out Verification

Tested with two concurrent WebSocket connections (`Tab 1`, `Tab 2`) established under Alice's active session:

```text
                  ┌───> Alice Socket (Tab 1) [Receives Msg 1]
Bob sends Msg 1 ──┤
                  └───> Alice Socket (Tab 2) [Receives Msg 1]

Tab 1 Closes ─────> Hub unregisters Tab 1; Tab 2 remains OPEN

Bob sends Msg 2 ──────> Alice Socket (Tab 2) [Receives Msg 2]
```

### 2.1 Observed Runtime Behavior
- **Simultaneous Fan-Out:** Both Tab 1 and Tab 2 received Bob's message in real time.
- **Selective Teardown:** Closing Tab 1 triggered `Hub.Unregister(client)`. Because `len(userClients) > 0`, the user was **not** marked offline.
- **Subsequent Delivery:** Messages sent after Tab 1 closed were delivered to Tab 2 without disruption.

---

## 3. High-Risk Security Test: WebSocket Survives Session Logout (RT-WS-001)

### 3.1 Test Execution & Reproducible Proof
```text
T0: Alice logs in via POST /api/login and establishes WebSocket at /api/ws.
    Hub registers Client with UserID = 1.
T1: Alice issues POST /api/logout.
    Backend sets revoked_at = CURRENT_TIMESTAMP in SQLite sessions table.
    Backend returns 200 OK and sends expired Set-Cookie.
T2: Inspection of Alice's WebSocket state:
    ws.readyState = 1 (OPEN).
T3: Alice transmits a private message over the WebSocket to Bob:
    {"type": "private_message", "payload": {"recipient_id": 2, "content": "Post-logout test"}}
T4: Hub checks sender ID (1) against in-memory client struct, checks follow relationship in DB, saves to private_messages, and pushes to Bob.
T5: Bob's WebSocket receives the message in real time.
```

### 3.2 Root Cause Analysis
1. `SessionMiddleware` is only invoked during the HTTP upgrade handshake:
   ```go
   apiMux.Handle("GET /ws", sessionMiddleware(rateLimit(http.HandlerFunc(deps.Handlers.Websocket.ServeWS))))
   ```
2. Once upgraded, `client.UserID` is permanently bound to the `Client` struct in memory.
3. `LogoutHandler` in `internal/auth/handler.go` has no reference to the WebSocket `Hub` and does not call `Hub.DisconnectUser(userID)`.
4. The message dispatcher (`dependencies.go`) never queries the `sessions` table before executing `wsRouter.Dispatch(senderID, raw)`.

---

## 4. Frontend Reconnection Loop on Unauthenticated Routes (RT-WS-002)

### 4.1 Description
In `frontend/src/app/layout.tsx`:
```tsx
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <SpaceBackground />
        <WebSocketProvider>{children}</WebSocketProvider>
      </body>
    </html>
  );
}
```
`WebSocketProvider` mounts unconditionally. When an unauthenticated visitor accesses `/login` or `/register`:
1. `connectSocket()` initiates `new WebSocket("ws://localhost:8080/api/ws")`.
2. Handshake fails with HTTP 401 (`Unauthorized: Cookie Not Found`).
3. `ws.onclose` fires, executing:
   ```typescript
   reconnectTimeoutRef.current = setTimeout(connectSocket, 1500);
   ```
4. The client issues repeated connection attempts every 1500ms indefinitely, flooding server logs and browser console with 401 errors.

---

## 5. Discovered Issues & Observations

| Issue ID | Severity | Title | Summary |
|---|:---:|---|---|
| **RT-WS-001** | **High** | WebSocket connection survives user logout | Logging out via REST does not terminate existing WebSocket connections. The connection remains open and authorized to transmit/receive messages indefinitely. |
| **RT-WS-002** | **Medium** | Unconditional WebSocket connection loop on unauthenticated routes | `WebSocketProvider` in `RootLayout` attempts connection every 1500ms when logged out, generating continuous 401 errors. |

