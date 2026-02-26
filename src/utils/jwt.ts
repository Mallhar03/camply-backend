import jwt from "jsonwebtoken";

export interface JwtPayload {
  userId: string;
  username: string;
}

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, process.env.JWT_ACCESS_SECRET!, {
    expiresIn: (process.env.JWT_ACCESS_EXPIRES_IN || "15m") as any,
  });
}

export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: (process.env.JWT_REFRESH_EXPIRES_IN || "7d") as any,
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, process.env.JWT_ACCESS_SECRET!) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET!) as JwtPayload;
}

/** Expiry in ms — used to set cookie maxAge */
export function refreshTokenTtlMs(): number {
  const raw = process.env.JWT_REFRESH_EXPIRES_IN || "7d";
  const unit = raw.slice(-1);
  const amount = parseInt(raw.slice(0, -1), 10);
  const multipliers: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };
  return amount * (multipliers[unit] || 86_400_000);
}
