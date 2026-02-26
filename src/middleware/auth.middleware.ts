import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/jwt";
import { sendError } from "../utils/apiResponse";

export interface AuthRequest extends Request {
  user?: { userId: string; username: string };
}

export function authenticate(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    sendError(res, "Access token required", 401);
    return;
  }

  const token = authHeader.split(" ")[1];

  try {
    const payload = verifyAccessToken(token);
    req.user = payload;
    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      sendError(res, "Access token expired", 401);
    } else {
      sendError(res, "Invalid access token", 401);
    }
  }
}

/** Middleware for routes that work both authed and unauthed */
export function optionalAuth(
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    try {
      req.user = verifyAccessToken(authHeader.split(" ")[1]);
    } catch {
      // ignore – optional
    }
  }
  next();
}
