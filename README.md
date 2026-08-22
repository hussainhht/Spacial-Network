## best social-network

Next.js
=======

UI
Routing
React
Frontend state
API calls
WebSocket client

Go
==

Authentication
Sessions
Database
Authorization
Business logic
REST API
WebSocket server
Uploads



Social Network
│
├── Frontend
│   ├── Next.js
│   ├── React
│   ├── TypeScript
│   ├── HTML / JSX / TSX
│   └── CSS
│
├── Backend
│   └── Go
│
├── Database
│   └── SQLite
│
├── Real-time
│   └── WebSockets
│
└── Infrastructure
    └── Docker

```
backend/
│
├── cmd/
│     └── main.go
│
├── internal/
│   │
│   ├── auth/
│   │   ├── handler.go
│   │   ├── service.go
│   │   └── repository.go
│   │
│   ├── users/
│   │   ├── handler.go
│   │   ├── service.go
│   │   ├── repository.go
│   │   └── model.go
│   │
│   ├── followers/
│   │   ├── handler.go
│   │   ├── service.go
│   │   └── repository.go
│   │
│   ├── posts/
│   │   ├── handler.go
│   │   ├── service.go
│   │   ├── repository.go
│   │   └── model.go
│   │
│   ├── comments/
│   │   ├── handler.go
│   │   ├── service.go
│   │   └── repository.go
│   │
│   ├── groups/
│   │   ├── handler.go
│   │   ├── service.go
│   │   ├── repository.go
│   │   └── model.go
│   │
│   ├── events/
│   │   ├── handler.go
│   │   ├── service.go
│   │   └── repository.go
│   │
│   ├── chat/
│   │   ├── handler.go
│   │   ├── websocket.go
│   │   ├── hub.go
│   │   ├── service.go
│   │   └── repository.go
│   │
│   ├── notifications/
│   │   ├── handler.go
│   │   ├── service.go
│   │   └── repository.go
│   │
│   └── middleware/
│       ├── auth.go
│       ├── cors.go
│       └── logging.go
│
├── pkg/
│   ├── db/
│   │   ├── migrations/
│   │   │   └── sqlite/
│   │   │       ├── 000001_create_users_table.up.sql
│   │   │       ├── 000001_create_users_table.down.sql
│   │   │       ├── 000002_create_sessions_table.up.sql
│   │   │       ├── 000002_create_sessions_table.down.sql
│   │   │       ├── ...
│   │   │
│   │   └── sqlite/
│   │       └── sqlite.go
│   │
│   ├── session/
│   │   └── session.go
│   │
│   ├── response/
│   │   └── json.go
│   │
│   └── validation/
│       └── validation.go
│
├── uploads/
│   ├── avatars/
│   ├── posts/
│   └── comments/
│
├── data/
│   └── social-network.db
│
├── Dockerfile
├── go.mod
├── go.sum
└── .env
```
