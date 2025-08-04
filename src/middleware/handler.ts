import { RateLimiter } from "../core/RateLimiter";
import { LimiterConfig } from "../types/index";
import { createKeyGenerator } from "../utils/keyGenerator";

export function universalLimiter(config: Partial<LimiterConfig>) {
  const limiter = new RateLimiter(config);
  const keyFn = createKeyGenerator({
    keyType: config.customKeyGenerator ? "custom" : config.keyType,
    headerName: config.headerName,
    customKeyGenerator: config.customKeyGenerator,
  });
  return async function (req: any, res: any, next: () => void) {
    const key = keyFn(req);
    const allowed = await limiter.isAllowed(key, req);
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
