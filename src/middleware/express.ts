import { Request, Response, NextFunction } from "express";
import { LimiterConfig } from "../types";
import { RateLimiter } from "../core/RateLimiter";
import { createKeyGenerator } from "../utils/keyGenerator";

/**
 * Express middleware for rate limiting.
 */
export function expressLimiter(config: Partial<LimiterConfig>) {
  const limiter = new RateLimiter(config);
  const keyFn = createKeyGenerator({
    keyType: config.customKeyGenerator ? "custom" : config.keyType,
    headerName: config.headerName,
    customKeyGenerator: config.customKeyGenerator,
  });
  return async function limiterMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    try {
      const key = keyFn(req);
      const allowed = await limiter.isAllowed(key, req);
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
