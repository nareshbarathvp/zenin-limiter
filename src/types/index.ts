export interface LimiterConfig {
  /**
   * Key generator system for rate limiting.
   * - keyType: 'ip' | 'user-agent' | 'header:X-API-KEY' | 'path' | 'custom'
   * - headerName: Used if keyType is a header
   * - customKeyGenerator: Custom function for key extraction
   */
  keyType?: "ip" | "user-agent" | "header:X-API-KEY" | "path" | "custom";
  headerName?: string;
  customKeyGenerator?: (req: any) => string;

  /**
   * Maximum number of allowed actions (requests) within the defined time window.
   * Can be a number or a function that returns a number based on request context.
   * Default: 100
   */
  limit?: number | ((req: any) => number);

  /**
   * Duration of the rate limit window in seconds.
   * Default: 60
   * Example: `60` means "limit X requests per 60 seconds".
   */
  windowInSeconds?: number;

  /**
   * Rate limiting strategy to use.
   * - 'fixed': Simple fixed window (default)
   * - 'sliding': Accurate sliding window
   * - 'tokenBucket': Smooth burst control
   */
  strategy?: "fixed" | "sliding" | "tokenBucket";

  /**
   * Event hooks for monitoring and debugging.
   */
  onLimitReached?: (key: string, req?: any) => void;
  onReset?: (key: string) => void;
  onPass?: (key: string, req?: any) => void;
  onError?: (error: Error) => void;

  /**
   * Enable debug logging for all rate limiting decisions.
   */
  debug?: boolean;

  /**
   * Dry run mode - simulate rate limiting without actually blocking requests.
   */
  dryRun?: boolean;

  /**
   * Silent mode - log decisions but don't block requests.
   */
  silent?: boolean;

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
  limiterConfig?: RateLimiterConfig;
}

export type RateLimiterConfig = {
  maxStoreSize?: number; // Max number of keys (default: 1,000,000)
  cleanupInterval?: number; // Calls between cleanups (default: 1000)
  enablePerKeyStats?: boolean; // Track per-key metrics (default: false)
  maxBatchCleanup?: number; // Max keys to clean per batch (default: 1000)
};

export interface RateLimitStrategy {
  isAllowed(key: string, req?: any): boolean | Promise<boolean>;
  getState?(key: string): RateLimitState | Promise<RateLimitState>;
  reset?(key: string): void | Promise<void>;
}

export type RateLimitState = {
  remaining: number;
  resetAt: number;
  limit: number;
};
