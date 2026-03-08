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

const OWNER = { userId: 'a0000000-0000-0000-0000-000000000001', username: 'owner' };
const MEMBER = { userId: 'b0000000-0000-0000-0000-000000000002', username: 'member' };

const TEAM_SHAPE = {
  id: 'team-1',
  name: 'Alpha Squad',
  description: 'Win HackX',
  hackathon: 'HackX 2025',
  roles: ['Frontend Dev', 'Backend Dev'],
  createdAt: new Date(),
  members: [
    {
      userId: OWNER.userId,
      role: 'OWNER',
      user: { id: OWNER.userId, username: OWNER.username, name: 'Owner', avatar: null, trustLevel: 'BRONZE' },
    },
  ],
};

describe('Team Controller – /api/v1/teams', () => {
  let ownerToken: string;
  let memberToken: string;

  beforeAll(() => {
    ownerToken = generateAccessToken(OWNER);
    memberToken = generateAccessToken(MEMBER);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── POST / ────────────────────────────────────────────────
  describe('POST /', () => {
    it('201 – creates a team and sets creator as OWNER', async () => {
      (prisma.team.create as any).mockResolvedValue(TEAM_SHAPE);

      const res = await request(app)
        .post('/api/v1/teams')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Alpha Squad', description: 'Win HackX', hackathon: 'HackX 2025' });

      expect(res.status).toBe(201);
      expect(res.body.data.team.name).toBe('Alpha Squad');
      expect(res.body.data.team.members[0].role).toBe('OWNER');
    });

    it('401 – requires authentication', async () => {
      const res = await request(app).post('/api/v1/teams').send({ name: 'Ghost' });
      expect(res.status).toBe(401);
    });
  });

  // ── GET /:id ──────────────────────────────────────────────
  describe('GET /:id', () => {
    it('200 – returns team by id', async () => {
      (prisma.team.findUnique as any).mockResolvedValue(TEAM_SHAPE);

      const res = await request(app)
        .get('/api/v1/teams/team-1')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.data.team.id).toBe('team-1');
    });

    it('404 – returns 404 for unknown team', async () => {
      (prisma.team.findUnique as any).mockResolvedValue(null);

      const res = await request(app)
        .get('/api/v1/teams/no-team')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(404);
    });
  });

  // ── POST /:id/invite ──────────────────────────────────────
  describe('POST /:id/invite', () => {
    it('200 – owner can invite a new member', async () => {
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'OWNER' }); // requester is owner
      (prisma.user.findUnique as any).mockResolvedValue({ id: MEMBER.userId });
      (prisma.teamMember.findUnique as any).mockResolvedValue(null); // not already member
      (prisma.teamMember.create as any).mockResolvedValue({});
      (prisma.team.findUnique as any).mockResolvedValue(TEAM_SHAPE);

      const res = await request(app)
        .post('/api/v1/teams/team-1/invite')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ username: MEMBER.username });

      expect(res.status).toBe(200);
    });

    it('403 – non-owner cannot invite', async () => {
      (prisma.teamMember.findFirst as any).mockResolvedValue(null); // not owner

      const res = await request(app)
        .post('/api/v1/teams/team-1/invite')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ username: 'someone' });

      expect(res.status).toBe(403);
    });

    it('404 – returns 404 if invitee does not exist', async () => {
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'OWNER' });
      (prisma.user.findUnique as any).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/v1/teams/team-1/invite')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ username: 'ghost' });

      expect(res.status).toBe(404);
    });

    it('409 – returns 409 if user is already a member', async () => {
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'OWNER' });
      (prisma.user.findUnique as any).mockResolvedValue({ id: MEMBER.userId });
      (prisma.teamMember.findUnique as any).mockResolvedValue({ role: 'MEMBER' }); // already in

      const res = await request(app)
        .post('/api/v1/teams/team-1/invite')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ username: MEMBER.username });

      expect(res.status).toBe(409);
    });
  });

  // ── DELETE /:id ───────────────────────────────────────────
  describe('DELETE /:id', () => {
    it('200 – owner can delete the team', async () => {
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'OWNER' });
      (prisma.team.delete as any).mockResolvedValue({});

      const res = await request(app)
        .delete('/api/v1/teams/team-1')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
    });

    it('403 – non-owner cannot delete', async () => {
      (prisma.teamMember.findFirst as any).mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/v1/teams/team-1')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ── DELETE /:id/members/me ────────────────────────────────
  describe('DELETE /:id/members/me', () => {
    it('200 – member can leave a team', async () => {
      (prisma.teamMember.findUnique as any).mockResolvedValue({ role: 'MEMBER' });
      (prisma.teamMember.delete as any).mockResolvedValue({});

      const res = await request(app)
        .delete('/api/v1/teams/team-1/members/me')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(200);
    });

    it('400 – owner cannot leave if other members exist', async () => {
      (prisma.teamMember.findUnique as any).mockResolvedValue({ role: 'OWNER' });
      (prisma.teamMember.count as any).mockResolvedValue(3); // others still there

      const res = await request(app)
        .delete('/api/v1/teams/team-1/members/me')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(400);
    });

    it('200 – owner can leave and delete team when last member', async () => {
      (prisma.teamMember.findUnique as any).mockResolvedValue({ role: 'OWNER' });
      (prisma.teamMember.count as any).mockResolvedValue(1); // sole member
      (prisma.team.delete as any).mockResolvedValue({});

      const res = await request(app)
        .delete('/api/v1/teams/team-1/members/me')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(prisma.team.delete).toHaveBeenCalledOnce();
    });

    it('404 – returns 404 when not a member', async () => {
      (prisma.teamMember.findUnique as any).mockResolvedValue(null);

      const res = await request(app)
        .delete('/api/v1/teams/team-1/members/me')
        .set('Authorization', `Bearer ${memberToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ── PATCH /:id ────────────────────────────────────────────
  describe('PATCH /:id', () => {
    it('200 – owner can update team details', async () => {
      (prisma.teamMember.findFirst as any).mockResolvedValue({ role: 'OWNER' });
      (prisma.team.update as any).mockResolvedValue({ ...TEAM_SHAPE, name: 'Beta Squad' });

      const res = await request(app)
        .patch('/api/v1/teams/team-1')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Beta Squad' });

      expect(res.status).toBe(200);
      expect(res.body.data.team.name).toBe('Beta Squad');
    });

    it('403 – non-owner cannot update', async () => {
      (prisma.teamMember.findFirst as any).mockResolvedValue(null);

      const res = await request(app)
        .patch('/api/v1/teams/team-1')
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Hacked' });

      expect(res.status).toBe(403);
    });
  });
});
