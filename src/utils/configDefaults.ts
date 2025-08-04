import { LimiterConfig, RateLimiterConfig } from "../types";

export function applyDefaults(config: Partial<LimiterConfig>): LimiterConfig {
  const defaultLimiterConfig = {
    maxStoreSize: 1000000,
    cleanupInterval: 1000,
    enablePerKeyStats: false,
    maxBatchCleanup: 1000,
  };

  return {
    limit: 100,
    windowInSeconds: 60,
    strategy: "fixed",
    keyType: "ip",
    debug: false,
    dryRun: false,
    silent: false,
    limiterConfig: {
      ...defaultLimiterConfig,
      ...config.limiterConfig,
    },
    ...config,
  };
}
