import { FastifyRequest, FastifyReply } from "fastify";
import { isAllowedMemory } from "../strategies/memoryStore";
import { LimiterConfig } from "../types/index";

export function fastifyLimiter(config: LimiterConfig) {
  return async function (req: FastifyRequest, reply: FastifyReply) {
    const key = config.key(req);

    const allowed = await isAllowedMemory(
      key,
      config.limit,
      config.windowInSeconds,
      config.limiterConfig
    );

    if (!allowed) {
      reply.status(429).send({ message: "Too Many Requests" });
    }
  };
}
