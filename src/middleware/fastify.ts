import { FastifyRequest, FastifyReply } from "fastify";
import { RateLimiter } from "../core/RateLimiter";
import { LimiterConfig } from "../types/index";
import { createKeyGenerator } from "../utils/keyGenerator";

export function fastifyLimiter(config: Partial<LimiterConfig>) {
  const limiter = new RateLimiter(config);
  const keyFn = createKeyGenerator({
    keyType: config.customKeyGenerator ? "custom" : config.keyType,
    headerName: config.headerName,
    customKeyGenerator: config.customKeyGenerator,
  });
  return async function (req: FastifyRequest, reply: FastifyReply) {
    const key = keyFn(req);
    const allowed = await limiter.isAllowed(key, req);
    if (!allowed) {
      reply.status(429).send({ message: "Too Many Requests" });
    }
  };
}
