import { Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { AuthRequest } from "../middleware/auth.middleware";
import { getCached, setCache, invalidateCache } from "../config/redis";
import { awardTrust } from "../services/trust.service";
import { notifyComment, notifyVote } from "../services/notification.service";

const POST_SELECT = {
  id: true,
  content: true,
  category: true,
  createdAt: true,
  updatedAt: true,
  author: {
    select: {
      id: true,
      username: true,
      name: true,
      avatar: true,
      trustLevel: true,
    },
  },
  _count: { select: { comments: true, votes: true } },
};

// GET /api/v1/posts?page=1&limit=10&category=DISCUSSION
export async function getFeed(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, parseInt(req.query.limit as string) || 10);
    const category = req.query.category as string | undefined;
    const skip = (page - 1) * limit;

    const cacheKey = `feed:${category || "all"}:${page}:${limit}`;
    const cached = await getCached(cacheKey);
    if (cached) {
      sendSuccess(res, cached);
      return;
    }

    const where = category ? { category: category as any } : {};

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        select: POST_SELECT,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.post.count({ where }),
    ]);

    // Compute vote counts per post
    const postsWithVotes = await Promise.all(
      posts.map(async (post) => {
        const votes = await prisma.vote.groupBy({
          by: ["value"],
          where: { postId: post.id },
          _count: { value: true },
        });
        const upvotes = votes.find((v) => v.value === 1)?._count.value || 0;
        const downvotes = votes.find((v) => v.value === -1)?._count.value || 0;

        // If authed, check user's own vote
        let userVote: number | null = null;
        if (req.user) {
          const myVote = await prisma.vote.findUnique({
            where: { postId_userId: { postId: post.id, userId: req.user.userId } },
            select: { value: true },
          });
          userVote = myVote?.value ?? null;
        }

        return { ...post, upvotes, downvotes, userVote };
      })
    );

    const payload = {
      posts: postsWithVotes,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + limit < total,
      },
    };

    await setCache(cacheKey, payload, 60); // 1 min TTL
    sendSuccess(res, payload);
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/posts
export async function createPost(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { content, category } = req.body;

    const post = await prisma.post.create({
      data: { content, category, authorId: req.user!.userId },
      select: POST_SELECT,
    });

    // Update trust score (non-fatal)
    await awardTrust(req.user!.userId, "POST_CREATED");

    await invalidateCache(`feed:all:*`);

    sendSuccess(res, { post }, "Post created", 201);
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/posts/:id
export async function getPost(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const post = await prisma.post.findUnique({
      where: { id },
      select: {
        ...POST_SELECT,
        comments: {
          select: {
            id: true,
            content: true,
            createdAt: true,
            author: { select: { id: true, username: true, avatar: true, trustLevel: true } },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!post) {
      sendError(res, "Post not found", 404);
      return;
    }

    sendSuccess(res, { post });
  } catch (err) {
    next(err);
  }
}

// DELETE /api/v1/posts/:id
export async function deletePost(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const post = await prisma.post.findUnique({
      where: { id },
      select: { authorId: true },
    });

    if (!post) {
      sendError(res, "Post not found", 404);
      return;
    }

    if (post.authorId !== req.user!.userId) {
      sendError(res, "Forbidden", 403);
      return;
    }

    await prisma.post.delete({ where: { id } });
    sendSuccess(res, null, "Post deleted");
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/posts/:id/vote
export async function votePost(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { value } = req.body; // 1 or -1
    const postId = req.params.id as string;
    const userId = req.user!.userId;

    if (![1, -1].includes(value)) {
      sendError(res, "Vote value must be 1 or -1", 400);
      return;
    }

    const existing = await prisma.vote.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing) {
      if (existing.value === value) {
        // Toggle off
        await prisma.vote.delete({ where: { postId_userId: { postId, userId } } });
        sendSuccess(res, { voted: false }, "Vote removed");
      } else {
        await prisma.vote.update({
          where: { postId_userId: { postId, userId } },
          data: { value },
        });
        sendSuccess(res, { voted: true, value }, "Vote updated");
      }
    } else {
      await prisma.vote.create({ data: { postId, userId, value } });
      // Notify post author
      const postRecord = await prisma.post.findUnique({ where: { id: postId }, select: { authorId: true } });
      if (postRecord) notifyVote(postRecord.authorId, userId, postId, value);
      sendSuccess(res, { voted: true, value }, "Vote recorded");
    }
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/posts/:id/comments
export async function addComment(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { content } = req.body;
    const postId = req.params.id as string;

    const postExists = await prisma.post.count({ where: { id: postId } });
    if (!postExists) {
      sendError(res, "Post not found", 404);
      return;
    }

    const comment = await prisma.comment.create({
      data: { content, postId, authorId: req.user!.userId },
      select: {
        id: true,
        content: true,
        createdAt: true,
        author: { select: { id: true, username: true, avatar: true, trustLevel: true } },
      },
    });

    // Notify post author (non-fatal)
    const post = await prisma.post.findUnique({ where: { id: postId }, select: { authorId: true } });
    if (post) notifyComment(post.authorId, req.user!.userId, postId);

    sendSuccess(res, { comment }, "Comment added", 201);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/v1/posts/:id
export async function updatePost(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { id } = req.params as { id: string };
    const { content, category } = req.body;

    const post = await prisma.post.findUnique({ where: { id }, select: { authorId: true } });
    if (!post) {
      sendError(res, "Post not found", 404);
      return;
    }
    if (post.authorId !== req.user!.userId) {
      sendError(res, "Forbidden", 403);
      return;
    }

    const updated = await prisma.post.update({
      where: { id },
      data: { ...(content !== undefined && { content }), ...(category !== undefined && { category }) },
      select: POST_SELECT,
    });

    await invalidateCache(`feed:all:*`);
    sendSuccess(res, { post: updated }, "Post updated");
  } catch (err) {
    next(err);
  }
}

// DELETE /api/v1/posts/:id/comments/:commentId
export async function deleteComment(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { commentId } = req.params as { commentId: string };

    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { authorId: true, postId: true },
    });
    if (!comment) {
      sendError(res, "Comment not found", 404);
      return;
    }

    // Allow author OR post author to delete
    const post = await prisma.post.findUnique({
      where: { id: comment.postId },
      select: { authorId: true },
    });

    if (comment.authorId !== req.user!.userId && post?.authorId !== req.user!.userId) {
      sendError(res, "Forbidden", 403);
      return;
    }

    await prisma.comment.delete({ where: { id: commentId } });
    sendSuccess(res, null, "Comment deleted");
  } catch (err) {
    next(err);
  }
}
