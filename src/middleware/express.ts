import { Request, Response, NextFunction } from "express";
import { LimiterConfig } from "../types";
import { isAllowedMemory } from "../strategies/memoryStore";

/**
 * Express middleware for rate limiting.
 */
export function expressLimiter(config: LimiterConfig) {
  return async function limiterMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const key = config.key(req);
      const allowed = await isAllowedMemory(
        key,
        config.limit,
        config.windowInSeconds,
        config.limiterConfig
      );

      if (!allowed) {
        return res.status(429).json({
          error: "Too many requests. Please try again later.",
        });
      }

      next();
    } catch (err) {
      console.error("Rate limiter error:", err);
      res.status(500).json({ error: "Internal rate limiter error" });
    }
  };
}
