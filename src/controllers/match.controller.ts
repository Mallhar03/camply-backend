import { Response, NextFunction } from "express";
import prisma from "../config/prisma";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { AuthRequest } from "../middleware/auth.middleware";
import { awardTrustToMany } from "../services/trust.service";
import { notifyMatch } from "../services/notification.service";

// GET /api/v1/match/profiles?skills=React,Node
// Returns paginated list of users the current user has NOT yet swiped on
export async function getProfiles(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;
    const limit = Math.min(20, parseInt(req.query.limit as string) || 10);
    const skillsFilter = req.query.skills
      ? (req.query.skills as string).split(",").map((s) => s.trim())
      : undefined;

    // Get IDs already swiped
    const alreadySwiped = await prisma.matchLike.findMany({
      where: { fromUserId: userId },
      select: { toUserId: true },
    });
    const swipedIds = alreadySwiped.map((l) => l.toUserId);
    swipedIds.push(userId); // exclude self

    const profiles = await prisma.user.findMany({
      where: {
        id: { notIn: swipedIds },
        ...(skillsFilter
          ? { skills: { hasSome: skillsFilter } }
          : {}),
      },
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        bio: true,
        college: true,
        skills: true,
        trustLevel: true,
        trustScore: true,
      },
      take: limit,
      orderBy: { trustScore: "desc" },
    });

    sendSuccess(res, { profiles });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/match/like
// body: { toUserId, action: "like" | "pass" }
export async function swipe(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { toUserId, action } = req.body;
    const fromUserId = req.user!.userId;

    if (fromUserId === toUserId) {
      sendError(res, "Cannot swipe on yourself", 400);
      return;
    }

    const status = action === "like" ? "PENDING" : "REJECTED";

    // Upsert (in case of double-tap)
    await prisma.matchLike.upsert({
      where: { fromUserId_toUserId: { fromUserId, toUserId } },
      create: { fromUserId, toUserId, status },
      update: { status },
    });

    if (action !== "like") {
      sendSuccess(res, { matched: false });
      return;
    }

    // Check for mutual like
    const mutual = await prisma.matchLike.findUnique({
      where: { fromUserId_toUserId: { fromUserId: toUserId, toUserId: fromUserId } },
    });

    if (mutual?.status === "PENDING") {
      // It's a match!
      await prisma.matchLike.updateMany({
        where: {
          OR: [
            { fromUserId, toUserId },
            { fromUserId: toUserId, toUserId: fromUserId },
          ],
        },
        data: { status: "MATCHED" },
      });

      // Trust score boost for both (non-fatal)
      await awardTrustToMany([fromUserId, toUserId], "MATCH_MADE");

      // Push real-time notification to both users
      notifyMatch(fromUserId, toUserId);

      sendSuccess(res, { matched: true, toUserId }, "It's a match! 🎉");
      return;
    }

    sendSuccess(res, { matched: false }, "Like recorded");
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/match/matches
// Returns all mutual matches for the current user
export async function getMatches(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const userId = req.user!.userId;

    const matches = await prisma.matchLike.findMany({
      where: { fromUserId: userId, status: "MATCHED" },
      include: {
        toUser: {
          select: {
            id: true,
            username: true,
            name: true,
            avatar: true,
            bio: true,
            skills: true,
            trustLevel: true,
          },
        },
      },
    });

    sendSuccess(res, { matches: matches.map((m) => m.toUser) });
  } catch (err) {
    next(err);
  }
}
