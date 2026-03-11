import { Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import prisma from "../config/prisma";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  refreshTokenTtlMs,
} from "../utils/jwt";
import { sendSuccess, sendError } from "../utils/apiResponse";
import { AuthRequest } from "../middleware/auth.middleware";
import logger from "../config/logger";

const SALT_ROUNDS = 12;

// ── Helper: set httpOnly refresh token cookie ──────────────
function setRefreshCookie(res: Response, token: string) {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: refreshTokenTtlMs(),
    path: "/api/v1/auth",
  });
}

// ── Helper: build user response (no passwordHash) ─────────
function safeUser(user: any) {
  const { passwordHash: _passwordHash, ...rest } = user;
  return rest;
}

// ─────────────────────────────────────────────────────────
// POST /api/v1/auth/register
// ─────────────────────────────────────────────────────────
export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { name, username, email, password } = req.body;

    // Check duplicates
    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
      select: { email: true, username: true },
    });

    if (existing) {
      const field = existing.email === email ? "email" : "username";
      sendError(res, `${field} already in use`, 409);
      return;
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await prisma.user.create({
      data: { name, username, email, passwordHash },
    });

    // Issue tokens
    const tokenPayload = { userId: user.id, username: user.username };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + refreshTokenTtlMs()),
      },
    });

    setRefreshCookie(res, refreshToken);
    logger.info(`New user registered: ${username}`);

    sendSuccess(
      res,
      { user: safeUser(user), accessToken },
      "Registration successful",
      201
    );
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────
// POST /api/v1/auth/login
// ─────────────────────────────────────────────────────────
export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { identifier, password } = req.body;
    // identifier = email OR username

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
    });

    if (!user) {
      sendError(res, "Invalid credentials", 401);
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      sendError(res, "Invalid credentials", 401);
      return;
    }

    const tokenPayload = { userId: user.id, username: user.username };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Rotate: remove old tokens for this user (keep last 3 devices)
    const tokens = await prisma.refreshToken.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (tokens.length >= 3) {
      const toDelete = tokens.slice(2).map((t) => t.id);
      await prisma.refreshToken.deleteMany({ where: { id: { in: toDelete } } });
    }

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + refreshTokenTtlMs()),
      },
    });

    setRefreshCookie(res, refreshToken);
    sendSuccess(res, { user: safeUser(user), accessToken }, "Login successful");
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────
// POST /api/v1/auth/refresh
// ─────────────────────────────────────────────────────────
export async function refresh(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!token) {
      sendError(res, "Refresh token required", 401);
      return;
    }

    // Verify token signature first
    try {
      verifyRefreshToken(token);
    } catch {
      sendError(res, "Invalid or expired refresh token", 401);
      return;
    }

    // Check DB (rotation + revocation support)
    const stored = await prisma.refreshToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!stored || stored.expiresAt < new Date()) {
      sendError(res, "Refresh token revoked or expired", 401);
      return;
    }

    // Rotate refresh token
    await prisma.refreshToken.delete({ where: { token } });

    const newRefreshToken = generateRefreshToken({
      userId: stored.user.id,
      username: stored.user.username,
    });
    const accessToken = generateAccessToken({
      userId: stored.user.id,
      username: stored.user.username,
    });

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: stored.userId,
        expiresAt: new Date(Date.now() + refreshTokenTtlMs()),
      },
    });

    setRefreshCookie(res, newRefreshToken);
    sendSuccess(res, { accessToken }, "Token refreshed");
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────
// POST /api/v1/auth/logout
// ─────────────────────────────────────────────────────────
export async function logout(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;

    if (token) {
      await prisma.refreshToken.deleteMany({ where: { token } }).catch(() => {});
    }

    res.clearCookie("refreshToken", { path: "/api/v1/auth" });
    sendSuccess(res, null, "Logged out successfully");
  } catch (err) {
    next(err);
  }
}

// ─────────────────────────────────────────────────────────
// GET /api/v1/auth/me
// ─────────────────────────────────────────────────────────
export async function me(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        bio: true,
        avatar: true,
        college: true,
        skills: true,
        trustLevel: true,
        trustScore: true,
        createdAt: true,
        _count: {
          select: { posts: true, teamMembers: true },
        },
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
