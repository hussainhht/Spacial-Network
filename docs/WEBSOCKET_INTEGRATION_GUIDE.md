# WebSocket Integration Guide for Developers

This guide explains how to connect new features (e.g. Notifications, Followers, Group Chat, Live Feeds) to the application's real-time WebSocket system.

---

## 1. Architectural Overview

The application uses a **Single Connection Multiplexer** pattern:

- **One Connection:** The browser opens a single persistent WebSocket connection to `/api/ws`.
- **One Hub:** The Go backend manages active client connections in a central `websocket.Hub`.
- **Decoupled Routing:** Inbound messages are dispatched by event type via `websocket.Router` on the backend, and routed through `WebSocketProvider` on the frontend.

```
┌────────────────────────────────────────────────────────┐
│               Frontend (Next.js)                       │
│  WebSocketProvider (Maintains 1 connection: /api/ws)   │
│  ├── useChat()            ──> Chat Window              │
│  ├── useInviteUserSearch()──> Group Invite Search      │
│  └── useYourFeature()     ──> Your UI Component        │
└──────────────────────────┬─────────────────────────────┘
                           │ Single WS Stream (JSON Events)
                           ▼
┌────────────────────────────────────────────────────────┐
│               Backend (Go Server)                      │
│  websocket.Handler (/api/ws with Session Auth)         │
│  └── websocket.Router (Dispatches by event.Type)       │
│      ├── chat.Service (private_message, typing, etc.)  │
│      ├── groups.InviteSearchWSHandler                  │
│      └── your_feature.Service                          │
└────────────────────────────────────────────────────────┘
```

---

## 2. The Standard Event Protocol

All messages sent over the WebSocket (in both directions) follow this JSON envelope:

```json
{
  "type": "event_name",
  "payload": { ... }
}
```

* **`type` (string):** The unique identifier for the event (e.g. `"private_message"`, `"invite_user_search"`, `"notification_new"`).
* **`payload` (JSON object):** The data associated with the event.

---

## 3. Backend: How to Connect Your Feature

Connecting a new feature to the backend involves **3 simple steps**:

### Step 3.1: Define Event Types & Payloads

Inside your feature package (e.g., `backend/internal/notifications/models.go`):

```go
package notifications

import "social/internal/websocket"

// Event names
const (
    EventNewNotification      websocket.EventType = "notification_new"
    EventMarkNotificationRead websocket.EventType = "notification_mark_read"
)

// Inbound payload (Client -> Server)
type MarkReadPayload struct {
    NotificationID int64 `json:"notification_id"`
}

// Outbound payload (Server -> Client)
type NewNotificationPayload struct {
    ID        int64  `json:"id"`
    Title     string `json:"title"`
    Message   string `json:"message"`
    CreatedAt string `json:"created_at"` // Always use time.RFC3339 UTC strings
}
```

---

### Step 3.2: To PUSH Events to a User (Server $\to$ Client)

Whenever an action occurs in your service (e.g. someone commented on a post or requested to join a group), send a real-time event through `websocket.Hub`:

```go
// 1. Inject websocket.Hub into your service or notifier:
type Service struct {
    repo *Repository
    hub  *websocket.Hub
}

// 2. Create and push the event:
func (s *Service) NotifyUser(recipientID int64, title, message string) error {
    payload := NewNotificationPayload{
        ID:        123,
        Title:     title,
        Message:   message,
        CreatedAt: time.Now().UTC().Format(time.RFC3339),
    }

    event, err := websocket.NewEvent(EventNewNotification, payload)
    if err != nil {
        return err
    }

    // Pushes directly to the recipient's active socket(s):
    s.hub.SendToUser(recipientID, event)
    return nil
}
```

---

### Step 3.3: To RECEIVE Events from a User (Client $\to$ Server)

If your feature handles incoming WebSocket events from the browser:

1. Write an `EventHandler` method matching `func(senderID int64, rawPayload json.RawMessage)`:

```go
func (s *Service) HandleMarkRead(senderID int64, rawPayload json.RawMessage) {
    var req MarkReadPayload
    if err := json.Unmarshal(rawPayload, &req); err != nil {
        log.Printf("invalid mark read payload: %v", err)
        return
    }

    // Process the request for senderID...
    _ = s.repo.MarkAsRead(req.NotificationID, senderID)
}
```

2. Register the handler in [`backend/internal/router/dependencies.go`](file:///Users/baderal3foo/git/reboot01/Projects/social-network/backend/internal/router/dependencies.go):

```go
// In setupDependencies(...)
wsRouter.Register(notifications.EventMarkNotificationRead, notificationsService.HandleMarkRead)
```

*(Optional clean pattern)*: You can add a `RegisterWSRoutes(r *websocket.Router)` method in your service (just like `chatService.RegisterWSRoutes(wsRouter)`):

```go
func (s *Service) RegisterWSRoutes(r *websocket.Router) {
    r.Register(EventMarkNotificationRead, s.HandleMarkRead)
}
```

---

## 4. Frontend: How to Connect Your Feature

### Step 4.1: Add Event Types to [`frontend/src/lib/websocket/types.ts`](file:///Users/baderal3foo/git/reboot01/Projects/social-network/frontend/src/lib/websocket/types.ts)

1. Add your event names to `EventType`:

```ts
export type EventType =
  | "private_message"
  | "typing"
  | "notification_new"          // <-- Your new event
  | "notification_mark_read"   // <-- Your new event
  | "error";
```

2. Define your TypeScript payload interfaces:

```ts
export interface NotificationPayload {
  id: number;
  title: string;
  message: string;
  created_at: string;
}
```

3. Expose your state in `WebSocketContextType`:

```ts
export interface WebSocketContextType {
  // ... existing fields ...
  lastNotification: NotificationPayload | null;
}
```

---

### Step 4.2: Expose Incoming Event in [`frontend/src/providers/WebSocketProvider.tsx`](file:///Users/baderal3foo/git/reboot01/Projects/social-network/frontend/src/providers/WebSocketProvider.tsx)

1. Add state in the provider:

```tsx
const [lastNotification, setLastNotification] = useState<NotificationPayload | null>(null);
```

2. Route the incoming event in `ws.onmessage`:

```tsx
switch (data.type) {
  // ...
  case "notification_new":
    setLastNotification(data.payload as NotificationPayload);
    break;
}
```

3. Include `lastNotification` in `contextValue` (and in its `useMemo` dependencies):

```tsx
const contextValue = useMemo(
  () => ({
    // ...
    lastNotification,
  }),
  [/* ... */, lastNotification]
);
```

---

### Step 4.3: Create a Feature Hook (e.g. `useNotifications.ts`)

Encapsulate state and socket listeners in a custom hook inside your feature directory (`frontend/src/features/your_feature/hooks/`):

```tsx
// frontend/src/features/notifications/hooks/useNotifications.ts
"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useWebSocket } from "@/providers/WebSocketProvider";
import type { NotificationPayload } from "@/lib/websocket/types";

export function useNotifications() {
  const { lastNotification, sendEvent } = useWebSocket();
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);
  const lastHandledNotifIdRef = useRef<number | null>(null);

  // Listen for live notifications:
  useEffect(() => {
    if (!lastNotification) return;

    // Deduplicate: avoid handling the same notification multiple times
    if (lastHandledNotifIdRef.current === lastNotification.id) return;
    lastHandledNotifIdRef.current = lastNotification.id;

    setNotifications((prev) => [lastNotification, ...prev]);
  }, [lastNotification]);

  // Send an event back to the server:
  const markAsRead = useCallback(
    (notificationId: number) => {
      sendEvent("notification_mark_read", { notification_id: notificationId });
      setNotifications((prev) => prev.filter((n) => n.id !== notificationId));
    },
    [sendEvent]
  );

  return {
    notifications,
    unreadCount: notifications.length,
    markAsRead,
  };
}
```

---

### Step 4.4: Use in Any UI Component

Now any React component can use real-time features with a single clean line:

```tsx
// frontend/src/components/NotificationBell.tsx
"use client";

import { useNotifications } from "@/features/notifications/hooks/useNotifications";

export default function NotificationBell() {
  const { unreadCount } = useNotifications();

  return (
    <div className="relative">
      <button>🔔</button>
      {unreadCount > 0 && <span className="badge">{unreadCount}</span>}
    </div>
  );
}
```

---

## 5. Golden Rules for Developers

1. **NEVER create a new `new WebSocket(...)` in your components:**
   Always use `useWebSocket()` from `WebSocketProvider`. The browser must maintain only **one** WebSocket connection for the entire application.
2. **Always Use Deduplication Refs (`useRef`):**
   React 18/19 renders components multiple times in StrictMode. Always store the ID of the last handled event in a `useRef` before updating state inside `useEffect` to prevent infinite update depth loops.
3. **Always Store and Format Timestamps in UTC RFC3339:**

   - **Backend:** `time.Now().UTC().Format(time.RFC3339)`
   - **Frontend:** Use `parseDate` and `formatDateTime` from `@/lib/utils`. This ensures dates display accurately in the client's local timezone.
4. **Always Verify `senderID` on the Backend:**
   The `senderID` passed into your `EventHandler` is extracted directly from the validated session cookie by the server. Never trust a `user_id` passed inside the JSON payload if it claims to be the sender.
