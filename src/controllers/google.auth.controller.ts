import { Request, Response, NextFunction } from "express";
import { generateAccessToken, generateRefreshToken, refreshTokenTtlMs } from "../utils/jwt";
import prisma from "../config/prisma";
import { sendError } from "../utils/apiResponse";

// Helper from auth.controller.ts
function setRefreshCookie(res: Response, token: string) {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: refreshTokenTtlMs(),
    path: "/api/v1/auth",
  });
}

export async function googleCallback(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const user: any = req.user;

    if (!user) {
      sendError(res, "Google authentication failed", 401);
      return;
    }

    const tokenPayload = { userId: user.id, username: user.username };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Rotate refresh tokens
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

    const redirectUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(`${redirectUrl}/auth/callback?token=${accessToken}`);
  } catch (err) {
    next(err);
  }
}
