import request from 'supertest';
import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import app from '../src/app';
import prisma from '../src/config/prisma';
import { generateAccessToken } from '../src/utils/jwt';

vi.mock('../src/config/prisma');
vi.mock('../src/config/redis', () => ({
  getCached: vi.fn(),
  setCache: vi.fn(),
  invalidateCache: vi.fn(),
}));
// Cloudinary – skip real uploads in tests
vi.mock('../src/config/cloudinary', () => ({
  uploadToCloudinary: vi.fn().mockResolvedValue('https://res.cloudinary.com/test/avatar.jpg'),
  avatarUpload: { single: vi.fn().mockReturnValue((_req: any, _res: any, next: any) => next()) },
  default: {},
}));
vi.mock('bcryptjs', () => ({
  default: { hash: vi.fn().mockResolvedValue('hashed'), compare: vi.fn() },
  hash: vi.fn().mockResolvedValue('hashed'),
  compare: vi.fn(),
}));

const MOCK_USER = {
  id: 'user-abc',
  name: 'Test User',
  username: 'testuser',
  email: 'test@example.com',
  passwordHash: 'hashed_password',
  bio: 'Hi!',
  avatar: null,
  college: 'MIT',
  skills: ['React', 'Node'],
  trustLevel: 'BRONZE',
  trustScore: 10,
  createdAt: new Date(),
};

describe('User Controller – /api/v1/users', () => {
  let token: string;

  beforeAll(() => {
    token = generateAccessToken({ userId: MOCK_USER.id, username: MOCK_USER.username });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GET /:username ────────────────────────────────────────
  describe('GET /:username', () => {
    it('200 – returns public profile', async () => {
      const { passwordHash: _, ...safeUser } = MOCK_USER;
      (prisma.user.findUnique as any).mockResolvedValue({
        ...safeUser,
        _count: { posts: 3, teamMembers: 1 },
      });

      const res = await request(app).get('/api/v1/users/testuser');

      expect(res.status).toBe(200);
      expect(res.body.data.user.username).toBe('testuser');
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('404 – returns 404 for unknown username', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);

      const res = await request(app).get('/api/v1/users/nobody');
      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /me ─────────────────────────────────────────────
  describe('PATCH /me', () => {
    it('200 – updates profile when authenticated', async () => {
      (prisma.user.update as any).mockResolvedValue({
        ...MOCK_USER,
        name: 'Updated Name',
        bio: 'New bio',
      });

      const res = await request(app)
        .patch('/api/v1/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name', bio: 'New bio' });

      expect(res.status).toBe(200);
      expect(res.body.data.user.name).toBe('Updated Name');
    });

    it('401 – returns 401 without token', async () => {
      const res = await request(app)
        .patch('/api/v1/users/me')
        .send({ name: 'Hacker' });

      expect(res.status).toBe(401);
    });
  });

  // ── GET /search ───────────────────────────────────────────
  describe('GET /search', () => {
    it('200 – returns matching users', async () => {
      (prisma.user.findMany as any).mockResolvedValue([MOCK_USER]);

      const res = await request(app)
        .get('/api/v1/users/search?q=test')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data.users).toHaveLength(1);
    });

    it('400 – rejects query shorter than 2 chars', async () => {
      const res = await request(app)
        .get('/api/v1/users/search?q=a')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });

    it('400 – rejects missing query param', async () => {
      const res = await request(app)
        .get('/api/v1/users/search')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(400);
    });
  });

  // ── GET /:username/posts ──────────────────────────────────
  describe('GET /:username/posts', () => {
    it('200 – returns paginated posts for a user', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({ id: MOCK_USER.id });
      (prisma.post.findMany as any).mockResolvedValue([
        { id: 'post-1', content: 'Hello', category: 'DISCUSSION', createdAt: new Date(), _count: { comments: 0, votes: 1 } },
      ]);
      (prisma.post.count as any).mockResolvedValue(1);

      const res = await request(app).get('/api/v1/users/testuser/posts?page=1&limit=10');

      expect(res.status).toBe(200);
      expect(res.body.data.posts).toHaveLength(1);
      expect(res.body.data.pagination.total).toBe(1);
    });

    it('404 – returns 404 posts for unknown user', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);

      const res = await request(app).get('/api/v1/users/ghost/posts');
      expect(res.status).toBe(404);
    });
  });
});
