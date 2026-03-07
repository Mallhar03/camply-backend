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

// bcrypt is slow in tests – use a pre-hashed value for 'password123'
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('hashed_password'),
    compare: vi.fn(),
  },
  hash: vi.fn().mockResolvedValue('hashed_password'),
  compare: vi.fn(),
}));

import bcrypt from 'bcryptjs';

const MOCK_USER = {
  id: 'user-abc',
  name: 'Test User',
  username: 'testuser',
  email: 'test@example.com',
  passwordHash: 'hashed_password',
  bio: null,
  avatar: null,
  college: null,
  skills: [],
  trustLevel: 'BRONZE',
  trustScore: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const MOCK_REFRESH_TOKEN_RECORD = {
  id: 'rt-1',
  token: 'valid-refresh-token',
  userId: MOCK_USER.id,
  expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
  createdAt: new Date(),
  user: MOCK_USER,
};

describe('Auth Controller – /api/v1/auth', () => {
  let accessToken: string;

  beforeAll(() => {
    accessToken = generateAccessToken({ userId: MOCK_USER.id, username: MOCK_USER.username });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── POST /register ────────────────────────────────────────
  describe('POST /register', () => {
    it('201 – registers a new user successfully', async () => {
      (prisma.user.findFirst as any).mockResolvedValue(null);
      (prisma.user.create as any).mockResolvedValue(MOCK_USER);
      (prisma.refreshToken.create as any).mockResolvedValue({});

      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Test User',
        username: 'testuser',
        email: 'test@example.com',
        password: 'Password123',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('409 – rejects duplicate email', async () => {
      (prisma.user.findFirst as any).mockResolvedValue({ email: 'test@example.com', username: 'other' });

      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Another',
        username: 'newuser',
        email: 'test@example.com',
        password: 'Password123',
      });

      expect(res.status).toBe(409);
    });

    it('409 – rejects duplicate username', async () => {
      (prisma.user.findFirst as any).mockResolvedValue({ email: 'other@example.com', username: 'testuser' });

      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Another',
        username: 'testuser',
        email: 'new@example.com',
        password: 'Password123',
      });

      expect(res.status).toBe(409);
    });
  });

  // ── POST /login ───────────────────────────────────────────
  describe('POST /login', () => {
    it('200 – logs in with valid credentials', async () => {
      (prisma.user.findFirst as any).mockResolvedValue(MOCK_USER);
      (bcrypt.compare as any).mockResolvedValue(true);
      (prisma.refreshToken.findMany as any).mockResolvedValue([]);
      (prisma.refreshToken.create as any).mockResolvedValue({});

      const res = await request(app).post('/api/v1/auth/login').send({
        identifier: 'testuser',
        password: 'Password123',
      });

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data.user).not.toHaveProperty('passwordHash');
    });

    it('401 – rejects unknown user', async () => {
      (prisma.user.findFirst as any).mockResolvedValue(null);

      const res = await request(app).post('/api/v1/auth/login').send({
        identifier: 'ghost',
        password: 'whatever',
      });

      expect(res.status).toBe(401);
    });

    it('401 – rejects wrong password', async () => {
      (prisma.user.findFirst as any).mockResolvedValue(MOCK_USER);
      (bcrypt.compare as any).mockResolvedValue(false);

      const res = await request(app).post('/api/v1/auth/login').send({
        identifier: 'testuser',
        password: 'wrongpassword',
      });

      expect(res.status).toBe(401);
    });

    it('limits active refresh tokens to 3 devices (rotates oldest)', async () => {
      (prisma.user.findFirst as any).mockResolvedValue(MOCK_USER);
      (bcrypt.compare as any).mockResolvedValue(true);
      (prisma.refreshToken.findMany as any).mockResolvedValue([
        { id: 't1' }, { id: 't2' }, { id: 't3' },
      ]);
      (prisma.refreshToken.deleteMany as any).mockResolvedValue({});
      (prisma.refreshToken.create as any).mockResolvedValue({});

      const res = await request(app).post('/api/v1/auth/login').send({
        identifier: 'testuser',
        password: 'Password123',
      });

      expect(res.status).toBe(200);
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledOnce();
    });
  });

  // ── POST /logout ──────────────────────────────────────────
  describe('POST /logout', () => {
    it('200 – logs out and clears cookie', async () => {
      (prisma.refreshToken.deleteMany as any).mockResolvedValue({});

      const res = await request(app)
        .post('/api/v1/auth/logout')
        .send({ refreshToken: 'some-token' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  // ── GET /me ───────────────────────────────────────────────
  describe('GET /me', () => {
    it('200 – returns authenticated user profile', async () => {
      (prisma.user.findUnique as any).mockResolvedValue({
        ...MOCK_USER,
        _count: { posts: 5, teamMembers: 2 },
      });

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.user.id).toBe(MOCK_USER.id);
    });

    it('401 – returns 401 without token', async () => {
      const res = await request(app).get('/api/v1/auth/me');
      expect(res.status).toBe(401);
    });

    it('404 – returns 404 when user no longer exists in DB', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(404);
    });
  });
});
