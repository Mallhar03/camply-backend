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
| GET | `/api/v1/users/:username/posts` | ❌ | User's posts (paginated) |
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
| PATCH | `/api/v1/posts/:id` | ✅ | Edit own post |
| DELETE | `/api/v1/posts/:id` | ✅ | Delete own post |
| POST | `/api/v1/posts/:id/vote` | ✅ | Upvote/downvote |
| POST | `/api/v1/posts/:id/comments` | ✅ | Add comment |
| DELETE | `/api/v1/posts/:id/comments/:commentId` | ✅ | Delete comment |

### Matching

| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| GET | `/api/v1/match/profiles` | ✅ | Swipe queue |
| POST | `/api/v1/match/like` | ✅ | Like or pass |
| GET | `/api/v1/match/matches` | ✅ | Mutual matches |

### Teams

| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| GET | `/api/v1/teams?q=&hackathon=&page=&limit=` | ✅ | Browse / search all teams |
| GET | `/api/v1/teams/mine` | ✅ | My teams |
| GET | `/api/v1/teams/:id` | ✅ | Get team by ID |
| POST | `/api/v1/teams` | ✅ | Create team |
| PATCH | `/api/v1/teams/:id` | ✅ | Update team (owner only) |
| POST | `/api/v1/teams/:id/invite` | ✅ | Invite member |
| DELETE | `/api/v1/teams/:id/members/me` | ✅ | Leave team |
| DELETE | `/api/v1/teams/:id` | ✅ | Delete team (owner only) |

### Chats

| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| GET | `/api/v1/chats` | ✅ | List all chats |
| POST | `/api/v1/chats` | ✅ | Create a chat room |
| POST | `/api/v1/chats/:id/join` | ✅ | Join a chat |
| DELETE | `/api/v1/chats/:id/members/me` | ✅ | Leave a chat |
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
socket.on("new-message", message)         // message with sender info
socket.on("user-typing", { userId, username })
socket.on("error", { message })
// Notifications (personal room, sent automatically by the server)
socket.on("match", { matchedUserId })     // mutual match occurred
socket.on("new-comment", { commenterId, postId })
socket.on("new-vote", { voterId, postId, value })
socket.on("team-invite", { teamId, teamName })
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
├── services/        # Business logic (trust score, real-time notifications)
├── utils/           # JWT helpers, API response, trust score constants
└── server.ts        # Entry point
prisma/
└── schema.prisma    # Database schema
scripts/
└── seed.ts          # Sample data
```


#problems we have faced


# 🛠️ Dev Log — Problems Faced & How I Solved Them

A honest log of real bugs I hit while building Camply and exactly how I fixed them.

---

## 1. 🗑️ Deleted Posts Still Showing in Feed

**Problem:**
After deleting a post, it would still appear in the feed for up to 5 minutes.
The post was being deleted from the database successfully, but the frontend
kept showing it because the backend was returning a **cached version** of the feed
from Redis.

**Root Cause:**
The `deletePost` controller was missing a cache invalidation call after the DB delete.
```typescript
// ❌ Before — cache never cleared
await prisma.post.delete({ where: { id } });
sendSuccess(res, null, "Post deleted");

// ✅ After — cache cleared immediately
await prisma.post.delete({ where: { id } });
await invalidateCache(`feed:*`);
sendSuccess(res, null, "Post deleted");
```

**Lesson:**
Every write operation (create, update, delete) that affects cached data
must invalidate the relevant cache keys.

---

## 2. 👁️ Three-Dot Menu Hidden on Mobile

**Problem:**
The post options menu (⋯) was completely invisible on mobile devices.
Users couldn't delete or share their own posts on phones.

**Root Cause:**
The button had `opacity-0 group-hover:opacity-100` applied — which works
on desktop with hover, but on mobile there is no hover state, so the
button stayed permanently invisible.

**Fix:**
```
// ❌ Before — invisible on mobile
opacity-0 group-hover:opacity-100

// ✅ After — visible on mobile, hover effect on desktop
opacity-100 md:opacity-0 md:group-hover:opacity-100
```

**Lesson:**
Never hide interactive UI elements with hover-only CSS.
Always keep them visible on mobile by default.

---

## 3. 💬 Comment Count Stale After Adding Comment

**Problem:**
After a user added a comment, the comment count on the post card
stayed the same. It only updated after a full page refresh.

**Root Cause:**
The `addComment` backend controller was saving the comment to the DB
but never invalidating the Redis feed cache. So the feed still returned
the old cached post with the old `_count.comments` value.

**Fix:**
```typescript
// ✅ Added after comment is created
await invalidateCache(`feed:*`);
sendSuccess(res, { comment }, "Comment added", 201);
```

**Lesson:**
Any action that changes a count or aggregate shown in a cached feed
must bust that cache.

---

## 4. 🔄 Feed Not Refreshing After New Post Created

**Problem:**
After creating a new post, the feed wouldn't show the new post immediately.
User had to manually refresh the page to see it.

**Root Cause:**
The frontend was calling `refetch()` from the current useQuery instance.
But `refetch()` only re-runs the exact current query — if the query was
stale or the filter had changed, it silently did nothing.

**Fix:**
```typescript
// ❌ Before — unreliable
const handlePostCreated = () => {
  refetch();
};

// ✅ After — forces all feed queries to reload
const handlePostCreated = () => {
  queryClient.invalidateQueries({ queryKey: ["feed"] });
};
```

**Lesson:**
Use `queryClient.invalidateQueries()` instead of `refetch()` when you want
to guarantee fresh data across all query variants (different filters, pages etc.)

---

## 5. 📤 Share Button Copying Wrong URL

**Problem:**
The Share Post button was copying `https://beta.camply.live` (just the homepage)
instead of the actual post URL.

**Root Cause:**
The onClick handler was using `window.location.origin` which only gives
the domain, not the full path.

**Fix:**
```typescript
// ❌ Before — copies homepage
navigator.clipboard.writeText(window.location.origin);

// ✅ After — copies actual post URL
const postUrl = `${window.location.origin}/posts/${id}`;
// Uses native share sheet on mobile, clipboard on desktop
if (navigator.share) {
  navigator.share({ title, text, url: postUrl });
} else {
  navigator.clipboard.writeText(postUrl);
}
```

**Lesson:**
Always test share/copy features end-to-end. `window.location.origin`
only gives you the domain — always append the specific resource path.

---

## 6. 🗳️ Votes Causing Posts to Disappear from Feed

**Problem:**
When a user voted on a post, other posts would randomly disappear
from the feed or the entire feed would re-sort/reload unexpectedly.

**Root Cause:**
Two things were happening simultaneously:
1. The backend was calling `invalidateCache("feed:*")` on every vote
2. The frontend was calling `queryClient.invalidateQueries(["feed"])` on every vote

This caused a full feed refetch on every single vote, which reset
pagination and reordered posts.

**Fix:**
Votes should **never** bust the feed cache. The vote counts are fine
to be slightly stale. Only the vote buttons on the specific post
need to update instantly via optimistic updates.

```typescript
// ❌ Removed from votePost controller
await invalidateCache(`feed:*`); // ← was causing full feed reload

// ❌ Removed from frontend handleVote
queryClient.invalidateQueries({ queryKey: ["feed"] }); // ← was causing disappearing posts
```

**What should invalidate the feed cache:**

| Action | Bust Cache? |
|--------|------------|
| Create post | ✅ Yes |
| Delete post | ✅ Yes |
| Edit post | ✅ Yes |
| Vote on post | ❌ No |
| Add comment | ✅ Yes (count changes) |
| Delete comment | ❌ No |

**Lesson:**
Not every write action needs to bust the entire feed cache.
Over-invalidation causes worse UX than slightly stale data.

---

## 7. ↩️ Vote State Not Reverting on API Failure

**Problem:**
If a vote API call failed (network error, server down), the UI
would show the wrong vote state permanently. The optimistic update
applied but never rolled back.

**Root Cause:**
The `previousVote` variable was saved but never actually used
in the catch block to restore state.

**Fix:**
```typescript
// Save ALL previous state before optimistic update
const prevVote = userVote;
const prevUpvotes = currentUpvotes;
const prevDownvotes = currentDownvotes;

// Apply optimistic update...

try {
  const result = await votePost(id, type);
  // Sync with real server counts
  setCurrentUpvotes(result.upvotes);
  setCurrentDownvotes(result.downvotes);
  setUserVote(result.userVote);
} catch (error) {
  // ✅ Actually rollback now
  setCurrentUpvotes(prevUpvotes);
  setCurrentDownvotes(prevDownvotes);
  setUserVote(prevVote);
}
```

**Lesson:**
Optimistic updates MUST have a proper rollback. Save the complete
previous state before mutating, not just one piece of it.

---

## 8. 🔌 Redis Cache Working But Vote Counts Wrong After Refresh

**Problem:**
Vote counts shown in the feed were correct initially but wrong
after page refresh. The cached feed had stale vote counts.

**Root Cause:**
The feed cache stored upvote/downvote counts at cache-write time.
When users voted, the DB updated but the cache was stale (5 min TTL).
The backend was also not returning real-time counts from `votePost`.

**Fix:**
Made `votePost` controller return real DB counts after every vote:
```typescript
// After any vote action, always return fresh counts
const allVotes = await prisma.vote.groupBy({
  by: ["value"],
  where: { postId },
  _count: { value: true },
});

sendSuccess(res, {
  upvotes: allVotes.find(v => v.value === 1)?._count.value || 0,
  downvotes: allVotes.find(v => v.value === -1)?._count.value || 0,
  userVote: currentVote?.value ?? null,
});
```

Frontend then syncs local state with server truth:
```typescript
const result = await votePost(id, type);
setCurrentUpvotes(result.upvotes);
setCurrentDownvotes(result.downvotes);
setUserVote(result.userVote);
```

**Lesson:**
For user-specific real-time actions like voting, always return
the server's ground truth in the response. Don't rely on the
client calculating the new state.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React + TypeScript + Tailwind + shadcn/ui |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL (Neon) |
| ORM | Prisma |
| Cache | Redis (Upstash) |
| Auth | JWT (access + refresh tokens) |
| Real-time | Socket.IO |
| File Upload | Cloudinary |
| Hosting | Vercel (frontend) + Railway (backend) |

---

*Built by [@kranthii-k](https://github.com/kranthii-k)*