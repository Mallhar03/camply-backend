import request from 'supertest';
import { describe, it, expect, beforeAll, vi } from 'vitest';
import app from '../src/app';
import prisma from '../src/config/prisma';
import { generateAccessToken } from '../src/utils/jwt';
import * as redisClient from '../src/config/redis';

vi.mock('../src/config/prisma');

// Mock Redis to avoid caching issues during test
vi.mock('../src/config/redis', () => ({
  getCached: vi.fn(),
  setCache: vi.fn(),
  invalidateCache: vi.fn(),
}));

describe('Post Controller Integration', () => {
  let token: string;
  let testUser: any;
  let testPost: any;

  beforeAll(() => {
    // Generate a valid JWT token
    token = generateAccessToken({ userId: 'test-user-id', username: 'testuser' });
  });

  it('should create a new post connected to simulated database', async () => {
    // Mock the prisma response for creating a post
    const mockPost = {
      id: 'post-123',
      content: 'This is a real integration test post',
      category: 'QUERY',
      createdAt: new Date(),
      updatedAt: new Date(),
      authorId: 'test-user-id',
      author: {
        id: 'test-user-id',
        username: 'testuser',
        name: 'Test',
        avatar: null,
        trustLevel: 'BRONZE'
      },
      _count: { comments: 0, votes: 0 }
    };
    
    (prisma.post.create as any).mockResolvedValue(mockPost);

    const res = await request(app)
      .post('/api/v1/posts')
      .set('Authorization', `Bearer ${token}`)
      .send({
        content: 'This is a real integration test post',
        category: 'QUERY'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(prisma.post.create).toHaveBeenCalledOnce();
    
    testPost = res.body.data.post;
  });

  it('should get feed with pagination without leaking user vote state', async () => {
    // Mock Redis returning nothing, forcing a DB fetch
    vi.mocked(redisClient.getCached).mockResolvedValue(null);

    // Mock post fetching
    (prisma.post.findMany as any).mockResolvedValue([
      { id: 'post-123', content: 'hello', category: 'DISCUSSION' }
    ]);
    (prisma.post.count as any).mockResolvedValue(1);

    // Mock global vote grouping
    (prisma.vote.groupBy as any).mockResolvedValue([
      { value: 1, _count: { value: 1 } }
    ]);

    // Mock user specific vote fetch (simulating cache miss)
    (prisma.vote.findMany as any).mockResolvedValue([
      { postId: 'post-123', value: 1 }
    ]);

    // Fetch the feed as the authed user
    const resAuth = await request(app)
      .get('/api/v1/posts?limit=1')
      .set('Authorization', `Bearer ${token}`);

    expect(resAuth.status).toBe(200);
    expect(resAuth.body.data.posts[0].upvotes).toBe(1);
    expect(resAuth.body.data.posts[0].userVote).toBe(1); // Attached correctly to me

    // Reset mocks for unauthed run
    vi.mocked(redisClient.getCached).mockResolvedValue(null);
    (prisma.vote.findMany as any).mockResolvedValue([]); // unauthed doesn't fetch personal votes

    // Fetch the feed as an unauthenticated user (simulating cache hit)
    const resNoAuth = await request(app).get('/api/v1/posts?limit=1');
    expect(resNoAuth.status).toBe(200);
    expect(resNoAuth.body.data.posts[0].userVote).toBeNull(); // No leak!
  });

  it('should add a comment dynamically', async () => {
    (prisma.post.count as any).mockResolvedValue(1);
    (prisma.comment.create as any).mockResolvedValue({
      id: 'comment-123',
      content: 'Real comment',
      createdAt: new Date(),
    });

    const res = await request(app)
      .post(`/api/v1/posts/post-123/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ content: 'Real comment' });

    expect(res.status).toBe(201);
    expect(res.body.data.comment.content).toBe('Real comment');
  });
});
