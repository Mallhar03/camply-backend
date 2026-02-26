import { Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import prisma from "../config/prisma";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { AuthRequest } from "../middleware/auth.middleware";
import { calculateTrustLevel } from "../utils/trustScore";

// GET /api/v1/users/:username
export async function getProfile(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { username: req.params.username },
      select: {
        id: true,
        name: true,
        username: true,
        bio: true,
        avatar: true,
        college: true,
        skills: true,
        trustLevel: true,
        trustScore: true,
        createdAt: true,
        _count: { select: { posts: true, teamMembers: true } },
      },
    });

    if (!user) {
      sendError(res, "User not found", 404);
      return;
    }

    sendSuccess(res, { user });
  } catch (err) {
    next(err);
  }
}

// PATCH /api/v1/users/me
export async function updateProfile(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, bio, college, skills } = req.body;

    const updated = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { name, bio, college, skills },
      select: {
        id: true,
        name: true,
        username: true,
        bio: true,
        avatar: true,
        college: true,
        skills: true,
        trustLevel: true,
      },
    });

    sendSuccess(res, { user: updated }, "Profile updated");
  } catch (err) {
    next(err);
  }
}

// PATCH /api/v1/users/me/avatar
export async function updateAvatar(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const file = req.file as any;
    if (!file?.path) {
      sendError(res, "No image uploaded", 400);
      return;
    }

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: { avatar: file.path },
      select: { id: true, avatar: true },
    });

    sendSuccess(res, { avatar: user.avatar }, "Avatar updated");
  } catch (err) {
    next(err);
  }
}

// PATCH /api/v1/users/me/password
export async function changePassword(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: { passwordHash: true },
    });

    if (!user) {
      sendError(res, "User not found", 404);
      return;
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      sendError(res, "Current password is incorrect", 401);
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: req.user!.userId },
      data: { passwordHash: newHash },
    });

    // Revoke all refresh tokens (force re-login on other devices)
    await prisma.refreshToken.deleteMany({ where: { userId: req.user!.userId } });

    sendSuccess(res, null, "Password changed successfully");
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/users/search?q=
export async function searchUsers(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const q = (req.query.q as string)?.trim();
    if (!q || q.length < 2) {
      sendError(res, "Query too short", 400);
      return;
    }

    const users = await prisma.user.findMany({
      where: {
        OR: [
          { username: { contains: q, mode: "insensitive" } },
          { name: { contains: q, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        username: true,
        name: true,
        avatar: true,
        trustLevel: true,
        college: true,
        skills: true,
      },
      take: 20,
    });

    sendSuccess(res, { users });
  } catch (err) {
    next(err);
  }
}
