export interface LimiterConfig {
  /**
   * A function that extracts a unique identifier from the request/context.
   *
   * Examples:
   * - (req) => req.ip                   // IP-based limiting
   * - (req) => req.user?.id            // Authenticated user-based
   * - (req) => req.headers['x-api-key'] // API key-based
   * - () => '__global__'               // Global limit (no identity)
   */
  key: (context: any) => string;

  /**
   * Maximum number of allowed actions (requests) within the defined time window.
   */
  limit: number;

  /**
   * Duration of the rate limit window in seconds.
   *
   * Example: `60` means "limit X requests per 60 seconds".
   */
  windowInSeconds: number;

  /**
   * Configuration for rate limiter.
   * This includes settings for memory store, cleanup intervals, and more.
   * If not provided, defaults will be used.
   *
   *  Max number of keys (default: 1,000,000)
   * Calls between cleanups (default: 1000)
   * Enable per-key metrics (default: false)
   * Max keys to clean per batch (default: 1000)
   */
  limiterConfig: RateLimiterConfig;
}

export type RateLimiterConfig = {
  maxStoreSize?: number; // Max number of keys (default: 1,000,000)
  cleanupInterval?: number; // Calls between cleanups (default: 1000)
  enablePerKeyStats?: boolean; // Track per-key metrics (default: false)
  maxBatchCleanup?: number; // Max keys to clean per batch (default: 1000)
};
