import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Request } from "express";
import { isAllowedMemory } from "../strategies/memoryStore";
import { LimiterConfig } from "../types/index";

@Injectable()
export class NestLimiterGuard implements CanActivate {
  constructor(private readonly config: LimiterConfig) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();

    const key = this.config.key(request);
    const allowed = await isAllowedMemory(
      key,
      this.config.limit,
      this.config.windowInSeconds,
      this.config.limiterConfig
    );

    if (!allowed) {
      // Fastify will also handle this correctly
      throw new UnauthorizedException("Too Many Requests");
    }

    return true;
  }
}
