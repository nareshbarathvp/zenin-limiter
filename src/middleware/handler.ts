import { isAllowedMemory } from "../strategies/memoryStore";
import { LimiterConfig } from "../types/index";

export function universalLimiter(config: LimiterConfig) {
  return async function (req: any, res: any, next: () => void) {
    const key = config.key(req);
    const allowed = await isAllowedMemory(
      key,
      config.limit,
      config.windowInSeconds,
      config.limiterConfig
    );

    if (!allowed) {
      if (res?.status && res?.send) {
        return res.status(429).send({ message: "Too Many Requests" });
      } else if (res?.code && res?.send) {
        return res.code(429).send({ message: "Too Many Requests" });
      } else {
        throw new Error("Rate limit exceeded");
      }
    }

    next();
  };
}
