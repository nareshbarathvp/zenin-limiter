// NestJS Rate Limiting Examples
// This file shows how to use zenin-limiter with NestJS

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Module,
} from "@nestjs/common";
import { RateLimiter, NestLimiterGuard } from "zenin-limiter";

// Example 1: Using RateLimiter directly in a service
@Injectable()
export class ApiService {
  private limiter = new RateLimiter({
    keyType: "ip",
    limit: 100,
    windowInSeconds: 60,
  });

  async processRequest(req: any) {
    const allowed = await this.limiter.isAllowed(req.ip);
    if (!allowed) {
      throw new Error("Rate limit exceeded");
    }
    return { message: "Request processed!" };
  }
}

// Example 2: Custom rate limiting guard
@Injectable()
export class CustomRateLimitGuard implements CanActivate {
  private limiter = new RateLimiter({
    keyType: "ip",
    limit: 50,
    windowInSeconds: 300,
    strategy: "sliding",
  });

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const allowed = await this.limiter.isAllowed(request.ip);
    return allowed;
  }
}

// Example 3: Using the built-in NestLimiterGuard
@Module({
  providers: [
    {
      provide: "APP_GUARD",
      useClass: NestLimiterGuard,
    },
  ],
})
export class AppModule {}

// Example 4: Different rate limiting strategies
export class RateLimitExamples {
  // Fixed window strategy
  private fixedLimiter = new RateLimiter({
    keyType: "ip",
    limit: 100,
    windowInSeconds: 60,
    strategy: "fixed",
  });

  // Sliding window strategy
  private slidingLimiter = new RateLimiter({
    keyType: "ip",
    limit: 100,
    windowInSeconds: 60,
    strategy: "sliding",
  });

  // Token bucket strategy
  private tokenBucketLimiter = new RateLimiter({
    keyType: "ip",
    limit: 100,
    windowInSeconds: 60,
    strategy: "tokenBucket",
  });

  // Header-based rate limiting
  private apiKeyLimiter = new RateLimiter({
    keyType: "header:X-API-KEY",
    limit: 1000,
    windowInSeconds: 3600,
  });

  // Custom key generator
  private userLimiter = new RateLimiter({
    customKeyGenerator: (req) => req.headers["x-user-id"] || "anonymous",
    limit: 50,
    windowInSeconds: 300,
  });
}
