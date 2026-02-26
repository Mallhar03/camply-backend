import { Request, Response, NextFunction } from "express";
import logger from "../config/logger";

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  logger.error(err.message, { stack: err.stack });

  // Prisma unique constraint
  if (err.code === "P2002") {
    const field = err.meta?.target?.[0] ?? "field";
    res.status(409).json({
      success: false,
      error: { message: `${field} already exists` },
    });
    return;
  }

  // Prisma not found
  if (err.code === "P2025") {
    res.status(404).json({
      success: false,
      error: { message: "Resource not found" },
    });
    return;
  }

  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    success: false,
    error: {
      message:
        statusCode === 500 && process.env.NODE_ENV === "production"
          ? "Internal server error"
          : err.message || "Internal server error",
    },
  });
}
