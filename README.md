



## best social-network

# Next.js

UI
Routing
React
Frontend state
API calls
WebSocket client

# Go

Authentication
Sessions
Database
Authorization
Business logic
REST API
WebSocket server
Uploads

Social Network

```
│
├── Frontend
│ ├── Next.js
│ ├── React
│ ├── TypeScript
│ ├── HTML / JSX / TSX
│ └── CSS
│
├── Backend
│ └── Go
│
├── Database
│ └── SQLite
│
├── Real-time
│ └── WebSockets
│
└── Infrastructure
    └── Docker
```

```
backend/
│
├── cmd/
│     └── main.go
│
├── internal
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





```
frontend/
│
├── public/
│   ├── images/
│   ├── icons/
│   └── ...
│
├── src/
│   │
│   ├── app/
│   │   │
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   │
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   └── register/
│   │   │       └── page.tsx
│   │   │
│   │   └── (main)/
│   │       ├── layout.tsx
│   │       │
│   │       ├── page.tsx
│   │       │
│   │       ├── profile/
│   │       │   └── [userId]/
│   │       │       └── page.tsx
│   │       │
│   │       ├── groups/
│   │       │   ├── page.tsx
│   │       │   │
│   │       │   └── [groupId]/
│   │       │       └── page.tsx
│   │       │
│   │       └── chat/
│   │           ├── page.tsx
│   │           └── [userId]/
│   │               └── page.tsx
│   │
│   ├── features/
│   │   │
│   │   ├── auth/
│   │   │   ├── api/
│   │   │   │   ├── login.ts
│   │   │   │   ├── register.ts
│   │   │   │   ├── logout.ts
│   │   │   │   └── getCurrentUser.ts
│   │   │   │
│   │   │   ├── components/
│   │   │   │   ├── LoginForm.tsx
│   │   │   │   └── RegisterForm.tsx
│   │   │   │
│   │   │   ├── hooks/
│   │   │   │   └── useAuth.ts
│   │   │   │
│   │   │   └── types/
│   │   │       └── auth.ts
│   │   │
│   │   ├── posts/
│   │   │   ├── api/
│   │   │   │   ├── createPost.ts
│   │   │   │   ├── getPosts.ts
│   │   │   │   ├── getPost.ts
│   │   │   │   └── createComment.ts
│   │   │   │
│   │   │   ├── components/
│   │   │   │   ├── Feed.tsx
│   │   │   │   ├── PostCard.tsx
│   │   │   │   ├── CreatePostForm.tsx
│   │   │   │   ├── PostPrivacySelector.tsx
│   │   │   │   ├── CommentsList.tsx
│   │   │   │   └── CommentForm.tsx
│   │   │   │
│   │   │   ├── hooks/
│   │   │   │   ├── usePosts.ts
│   │   │   │   └── useComments.ts
│   │   │   │
│   │   │   └── types/
│   │   │       ├── post.ts
│   │   │       └── comment.ts
│   │   │
│   │   ├── profile/
│   │   │   ├── api/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── types/
│   │   │
│   │   ├── followers/
│   │   │   ├── api/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── types/
│   │   │
│   │   ├── groups/
│   │   │   ├── api/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── types/
│   │   │   └── utils/
│   │   │
│   │   ├── events/
│   │   │   ├── api/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── types/
│   │   │
│   │   ├── chat/
│   │   │   ├── api/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── types/
│   │   │
│   │   └── notifications/
│   │       ├── api/
│   │       ├── components/
│   │       ├── hooks/
│   │       └── types/
│   │
│   ├── components/
│   │   ├── ui/
│   │   │   ├── Button.tsx
│   │   │   ├── Input.tsx
│   │   │   ├── Modal.tsx
│   │   │   ├── Avatar.tsx
│   │   │   ├── Spinner.tsx
│   │   │   └── EmptyState.tsx
│   │   │
│   │   └── layout/
│   │       ├── Navbar.tsx
│   │       ├── Sidebar.tsx
│   │       ├── MobileNav.tsx
│   │       └── AppShell.tsx
│   │
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts
│   │   │   └── errors.ts
│   │   │
│   │   ├── websocket/
│   │   │   └── client.ts
│   │   │
│   │   └── utils/
│   │       ├── date.ts
│   │       └── file.ts
│   │
│   ├── providers/
│   │   ├── AuthProvider.tsx
│   │   ├── WebSocketProvider.tsx
│   │   └── NotificationProvider.tsx
│   │
│   └── types/
│       └── api.ts
│
├── .env.local
├── next.config.ts
├── package.json
└── tsconfig.json
```
