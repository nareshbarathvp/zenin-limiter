import { LimiterConfig } from "../types";
import { RateLimitStrategy } from "../types";
import { FixedWindowStrategy } from "../strategies/memoryStore";
import { SlidingWindowStrategy } from "../strategies/slidingWindow";
import { TokenBucketStrategy } from "../strategies/tokenBucket";
import { applyDefaults } from "../utils/configDefaults";
import { throwIfInvalid } from "../utils/configValidator";

export interface RateLimiterStats {
  totalRequests: number;
  hits: number;
  rejections: number;
  activeKeys: number;
  memoryUsage?: number;
}

export class RateLimiter {
  private strategy: RateLimitStrategy;
  private config: LimiterConfig;
  private stats = {
    totalRequests: 0,
    hits: 0,
    rejections: 0,
  };

  constructor(config: Partial<LimiterConfig>, strategy?: RateLimitStrategy) {
    this.config = applyDefaults(config);
    throwIfInvalid(this.config);
    this.strategy = strategy || this.createStrategy(this.config);
  }

  private createStrategy(config: LimiterConfig): RateLimitStrategy {
    const strategyType = config.strategy || "fixed";

    switch (strategyType) {
      case "sliding":
        return new SlidingWindowStrategy(config);
      case "tokenBucket":
        return new TokenBucketStrategy(config);
      case "fixed":
      default:
        return new FixedWindowStrategy(config);
    }
  }

  private getLimit(req?: any): number {
    const limit = this.config.limit;
    if (typeof limit === "function") {
      return limit(req);
    }
    return limit || 100;
  }

  private callHook(
    hookName: keyof Pick<
      LimiterConfig,
      "onPass" | "onLimitReached" | "onReset" | "onError"
    >,
    ...args: any[]
  ): void {
    const hook = this.config[hookName];
    if (hook) {
      try {
        (hook as Function)(...args);
      } catch (error) {
        if (this.config.onError) {
          this.config.onError(error as Error);
        }
      }
    }
  }

  private logDebug(message: string, data?: any) {
    if (this.config.debug) {
      console.log(`[RateLimiter] ${message}`, data || "");
    }
  }

  async isAllowed(key: string, req?: any): Promise<boolean> {
    this.stats.totalRequests++;
    this.logDebug(`Checking rate limit for key: ${key}`);

    try {
      const allowed = await this.strategy.isAllowed(key, req);

      if (allowed) {
        this.stats.hits++;
        this.callHook("onPass", key, req);
        this.logDebug(`Request allowed for key: ${key}`);
      } else {
        this.stats.rejections++;
        this.callHook("onLimitReached", key, req);
        this.logDebug(`Request rejected for key: ${key}`);
      }

      // Handle dryRun and silent modes
      if (this.config.dryRun) {
        this.logDebug(
          `Dry run mode - would ${
            allowed ? "allow" : "reject"
          } request for key: ${key}`
        );
        return true; // Always allow in dry run mode
      }

      if (this.config.silent) {
        this.logDebug(
          `Silent mode - ${
            allowed ? "allowing" : "rejecting"
          } request for key: ${key}`
        );
        return allowed; // Return actual result but don't block
      }

      return allowed;
    } catch (error) {
      this.callHook("onError", error as Error);
      this.logDebug(`Error checking rate limit for key: ${key}`, error);
      throw error;
    }
  }

  async reset(key: string): Promise<void> {
    this.logDebug(`Resetting rate limit for key: ${key}`);
    if (this.strategy.reset) {
      await this.strategy.reset(key);
      this.callHook("onReset", key);
    }
  }

  async getState(key: string): Promise<any> {
    if (this.strategy.getState) {
      return this.strategy.getState(key);
    }
    return null;
  }

  getStats(): RateLimiterStats {
    return {
      ...this.stats,
      activeKeys: this.getActiveKeysCount(),
    };
  }

  private getActiveKeysCount(): number {
    // This would need to be implemented in each strategy
    // For now, return a placeholder
    return 0;
  }
}
