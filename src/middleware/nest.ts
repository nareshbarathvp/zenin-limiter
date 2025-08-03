// nestLimiter.middleware.ts
import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { isAllowedMemory } from "../strategies/memoryStore";
import { LimiterConfig } from "../types/index";

@Injectable()
export class NestLimiterMiddleware implements NestMiddleware {
  constructor(private readonly config: LimiterConfig) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const key = this.config.key(req);
    const allowed = await isAllowedMemory(
      key,
      this.config.limit,
      this.config.windowInSeconds,
      this.config.limiterConfig
    );

    if (!allowed) {
      return res.status(429).json({ message: "Too Many Requests" });
    }

    next();
  }
}
