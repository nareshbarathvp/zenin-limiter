import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  SetMetadata,
  Module,
  Global,
  Provider,
} from "@nestjs/common";
import { Request } from "express";
import { RateLimiter } from "../core/RateLimiter";
import { LimiterConfig } from "../types/index";
import { createKeyGenerator } from "../utils/keyGenerator";

export const RATE_LIMIT_METADATA_KEY = "rate_limit_config";
export function RateLimit(config: LimiterConfig) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    Reflect.defineMetadata(RATE_LIMIT_METADATA_KEY, config, descriptor.value);
    return descriptor;
  };
}

@Injectable()
export class NestLimiterGuard implements CanActivate {
  private limiter: RateLimiter;
  private keyFn: (req: any) => string;
  constructor(private readonly config: Partial<LimiterConfig>) {
    this.limiter = new RateLimiter(config);
    this.keyFn = createKeyGenerator({
      keyType: config.customKeyGenerator ? "custom" : config.keyType,
      headerName: config.headerName,
      customKeyGenerator: config.customKeyGenerator,
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    // Check for route-specific config
    const handler = context.getHandler();
    const classRef = context.getClass();
    const routeConfig =
      Reflect.getMetadata(RATE_LIMIT_METADATA_KEY, handler) ||
      Reflect.getMetadata(RATE_LIMIT_METADATA_KEY, classRef);
    let limiter = this.limiter;
    let keyFn = this.keyFn;
    if (routeConfig) {
      limiter = new RateLimiter(routeConfig);
      keyFn = createKeyGenerator({
        keyType: routeConfig.keyType,
        headerName: routeConfig.headerName,
        customKeyGenerator: routeConfig.customKeyGenerator,
      });
    }
    const key = keyFn(request);
    const allowed = await limiter.isAllowed(key, request);
    if (!allowed) {
      throw new UnauthorizedException("Too Many Requests");
    }
    return true;
  }
}

@Global()
@Module({
  providers: [NestLimiterGuard],
  exports: [NestLimiterGuard],
})
export class RateLimitModule {}
