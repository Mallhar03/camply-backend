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
vi.mock('../src/services/notification.service', () => ({
  notifyMatch: vi.fn(),
  notifyComment: vi.fn(),
  notifyVote: vi.fn(),
  notifyTeamInvite: vi.fn(),
}));

const USER_A = { userId: 'a0000000-0000-0000-0000-000000000001', username: 'usera' };
const USER_B = { userId: 'b0000000-0000-0000-0000-000000000002', username: 'userb' };

const PROFILE_SELECT = {
  id: USER_B.userId,
  username: USER_B.username,
  name: 'User B',
  avatar: null,
  bio: 'Hello',
  college: 'Stanford',
  skills: ['React'],
  trustLevel: 'BRONZE',
  trustScore: 5,
};

describe('Match Controller – /api/v1/match', () => {
  let tokenA: string;

  beforeAll(() => {
    tokenA = generateAccessToken(USER_A);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── GET /profiles ─────────────────────────────────────────
  describe('GET /profiles', () => {
    it('200 – returns profiles excluding self and already-swiped users', async () => {
      (prisma.matchLike.findMany as any).mockResolvedValue([]);
      (prisma.user.findMany as any).mockResolvedValue([PROFILE_SELECT]);

      const res = await request(app)
        .get('/api/v1/match/profiles')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.profiles).toHaveLength(1);
      expect(res.body.data.profiles[0].id).toBe(USER_B.userId);
    });

    it('200 – supports skills filter', async () => {
      (prisma.matchLike.findMany as any).mockResolvedValue([]);
      (prisma.user.findMany as any).mockResolvedValue([PROFILE_SELECT]);

      const res = await request(app)
        .get('/api/v1/match/profiles?skills=React,Node')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
    });

    it('401 – requires authentication', async () => {
      const res = await request(app).get('/api/v1/match/profiles');
      expect(res.status).toBe(401);
    });
  });

  // ── POST /like ────────────────────────────────────────────
  describe('POST /like', () => {
    it('200 – records a like (no mutual match yet)', async () => {
      (prisma.matchLike.upsert as any).mockResolvedValue({});
      (prisma.matchLike.findUnique as any).mockResolvedValue(null); // no mutual

      const res = await request(app)
        .post('/api/v1/match/like')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ toUserId: USER_B.userId, action: 'like' });

      expect(res.status).toBe(200);
      expect(res.body.data.matched).toBe(false);
    });

    it('200 – detects mutual match correctly', async () => {
      (prisma.matchLike.upsert as any).mockResolvedValue({});
      // B already liked A → mutual
      // B already liked A → mutual
      (prisma.matchLike.findUnique as any).mockResolvedValue({ status: 'PENDING' });
      (prisma.matchLike.updateMany as any).mockResolvedValue({});
      // awardTrustToMany calls prisma.user.update
      (prisma.user.update as any).mockResolvedValue({ trustScore: 10 });

      const res = await request(app)
        .post('/api/v1/match/like')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ toUserId: USER_B.userId, action: 'like' });

      expect(res.status).toBe(200);
      expect(res.body.data.matched).toBe(true);
      // Both match records updated to MATCHED
      expect(prisma.matchLike.updateMany).toHaveBeenCalledOnce();
    });

    it('200 – records a pass action', async () => {
      (prisma.matchLike.upsert as any).mockResolvedValue({});

      const res = await request(app)
        .post('/api/v1/match/like')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ toUserId: USER_B.userId, action: 'pass' });

      expect(res.status).toBe(200);
      expect(res.body.data.matched).toBe(false);
    });

    it('400 – prevents swiping on yourself', async () => {
      const res = await request(app)
        .post('/api/v1/match/like')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ toUserId: USER_A.userId, action: 'like' });

      expect(res.status).toBe(400);
    });
  });

  // ── GET /matches ──────────────────────────────────────────
  describe('GET /matches', () => {
    it('200 – returns list of matched users', async () => {
      (prisma.matchLike.findMany as any).mockResolvedValue([
        { toUser: PROFILE_SELECT },
      ]);

      const res = await request(app)
        .get('/api/v1/match/matches')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.matches).toHaveLength(1);
      expect(res.body.data.matches[0].id).toBe(USER_B.userId);
    });

    it('200 – returns empty array when no matches', async () => {
      (prisma.matchLike.findMany as any).mockResolvedValue([]);

      const res = await request(app)
        .get('/api/v1/match/matches')
        .set('Authorization', `Bearer ${tokenA}`);

      expect(res.status).toBe(200);
      expect(res.body.data.matches).toHaveLength(0);
    });
  });
});
