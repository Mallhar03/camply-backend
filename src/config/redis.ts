import { createClient } from "redis";
import logger from "./logger";

export const redisClient = createClient({
  url: process.env.REDIS_URL || "redis://localhost:6379",
});

redisClient.on("error", (err) => logger.error("Redis error", err));
redisClient.on("connect", () => logger.info("Redis connected"));

export async function connectRedis() {
  await redisClient.connect();
}

/**
 * Cache helper – returns null if Redis is unavailable.
 */
export async function getCached<T>(key: string): Promise<T | null> {
  try {
    const data = await redisClient.get(key);
    return data ? (JSON.parse(data) as T) : null;
  } catch {
    return null;
  }
}

export async function setCache(
  key: string,
  value: unknown,
  ttlSeconds = 300
): Promise<void> {
  try {
    await redisClient.set(key, JSON.stringify(value), { EX: ttlSeconds });
  } catch {
    // Silently fail – cache is best-effort
  }
}

export async function invalidateCache(pattern: string): Promise<void> {
  try {
    if (pattern.includes('*')) {
      const matchPattern = pattern;
      for await (const key of redisClient.scanIterator({ MATCH: matchPattern, COUNT: 100 })) {
        await redisClient.del(key);
      }
    } else {
      await redisClient.del(pattern);
    }
  } catch {
    // no-op
  }
}
