# Camply Backend API

Node.js/Express REST + WebSocket backend for [Camply](https://camply.live) — the campus social platform.

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Runtime | Node.js + TypeScript | Type safety, great ecosystem |
| Framework | Express.js | Minimal, flexible, battle-tested |
| Database | PostgreSQL (via Neon/Supabase) | Relational data, full-text search |
| ORM | Prisma | Auto-generated types, migrations |
| Cache | Redis (Upstash) | Feed caching, session data |
| Auth | JWT (access + refresh tokens) | Stateless, scalable |
| Real-time | Socket.IO | Community chat, typing indicators |
| File upload | Cloudinary | Image hosting & CDN |
| Validation | Zod | Runtime type-safe validation |
| Logging | Winston | Structured logs |
| Security | Helmet + CORS + Rate limiting | Production hardening |

---

## Quick Start

### 1. Clone & install

```bash
git clone <your-repo>
cd camply-backend
npm install
```

### 2. Set up environment

```bash
cp .env.example .env
# Fill in all values in .env
```

**Required variables:**

```env
DATABASE_URL=postgresql://...      # Neon / Supabase / local Postgres
JWT_ACCESS_SECRET=<random-64-chars>
JWT_REFRESH_SECRET=<random-64-chars>
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

**Optional (app works without these):**
```env
REDIS_URL=redis://...   # Falls back gracefully if absent
```

### 3. Set up database

```bash
# Push schema to DB
npm run db:push

# Or run migrations (recommended for production)
npm run db:migrate

# Seed with sample data
npm run db:seed
```

### 4. Run

```bash
# Development (hot reload)
npm run dev

# Production
npm run build && npm start
```

---

## API Reference

### Authentication

| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| POST | `/api/v1/auth/register` | ❌ | Create account |
| POST | `/api/v1/auth/login` | ❌ | Login → get tokens |
| POST | `/api/v1/auth/refresh` | ❌ | Rotate refresh token |
| POST | `/api/v1/auth/logout` | ❌ | Revoke refresh token |
| GET | `/api/v1/auth/me` | ✅ | Get current user |

### Users

| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| GET | `/api/v1/users/:username` | ❌ | Public profile |
| PATCH | `/api/v1/users/me` | ✅ | Update profile |
| PATCH | `/api/v1/users/me/avatar` | ✅ | Upload avatar |
| PATCH | `/api/v1/users/me/password` | ✅ | Change password |
| GET | `/api/v1/users/search?q=` | ✅ | Search users |

### Posts

| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| GET | `/api/v1/posts` | Optional | Feed (paginated) |
| POST | `/api/v1/posts` | ✅ | Create post |
| GET | `/api/v1/posts/:id` | Optional | Single post + comments |
| DELETE | `/api/v1/posts/:id` | ✅ | Delete own post |
| POST | `/api/v1/posts/:id/vote` | ✅ | Upvote/downvote |
| POST | `/api/v1/posts/:id/comments` | ✅ | Add comment |

### Matching

| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| GET | `/api/v1/match/profiles` | ✅ | Swipe queue |
| POST | `/api/v1/match/like` | ✅ | Like or pass |
| GET | `/api/v1/match/matches` | ✅ | Mutual matches |

### Teams

| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| GET | `/api/v1/teams/mine` | ✅ | My teams |
| POST | `/api/v1/teams` | ✅ | Create team |
| POST | `/api/v1/teams/:id/invite` | ✅ | Invite member |
| DELETE | `/api/v1/teams/:id` | ✅ | Delete team |

### Chats

| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| GET | `/api/v1/chats` | ✅ | List all chats |
| POST | `/api/v1/chats/:id/join` | ✅ | Join a chat |
| GET | `/api/v1/chats/:id/messages` | ✅ | Paginated messages |

---

## Auth Flow

```
Register/Login
  → Server issues:
      accessToken  (15 min, in response body)
      refreshToken (7 days, httpOnly cookie)

  → Client stores:
      accessToken  → memory / localStorage
      refreshToken → auto-sent via cookie

  → On 401 Unauthorized:
      POST /api/v1/auth/refresh → new accessToken

  → On logout:
      POST /api/v1/auth/logout → cookie cleared + DB row deleted
```

---

## WebSocket Events (Socket.IO)

### Client → Server

```js
socket.emit("join-chat", chatId)
socket.emit("leave-chat", chatId)
socket.emit("send-message", { chatId, content })
socket.emit("typing", chatId)
```

### Server → Client

```js
socket.on("new-message", message)    // message with sender info
socket.on("user-typing", { userId, username })
socket.on("error", { message })
```

**Authentication:** Pass access token in handshake:
```js
const socket = io("https://api.camply.live", {
  auth: { token: accessToken }
})
```

---

## Response Format

All responses follow this shape:

```json
// Success
{ "success": true, "message": "...", "data": { ... } }

// Error
{ "success": false, "error": { "message": "...", "details": [...] } }
```

---

## Deployment (Railway / Render)

1. Connect your GitHub repo
2. Set all environment variables
3. Build command: `npm run build`
4. Start command: `npm start`
5. Add PostgreSQL + Redis as managed services

**Recommended free-tier stack:**
- DB: [Neon](https://neon.tech) (PostgreSQL, generous free tier)
- Cache: [Upstash](https://upstash.com) (Redis, free tier)
- Hosting: [Railway](https://railway.app) or [Render](https://render.com)
- Images: [Cloudinary](https://cloudinary.com) (free tier = 25 GB)

---

## Project Structure

```
src/
├── config/          # Prisma, Redis, Socket.IO, Cloudinary, Logger
├── controllers/     # Route handlers (auth, user, post, match, team, chat)
├── middleware/      # Auth, validation, error handling
├── models/          # Zod schemas
├── routes/          # Express routers
├── utils/           # JWT helpers, API response, trust score
└── server.ts        # Entry point
prisma/
└── schema.prisma    # Database schema
scripts/
└── seed.ts          # Sample data
```
