import { RateLimitStrategy, RateLimitState } from "../types";

type TokenBucketData = {
  tokens: number;
  lastRefill: number;
  capacity: number;
  refillRate: number; // tokens per millisecond
};

const tokenBucketStore = new Map<string, TokenBucketData>();

let gcInterval: NodeJS.Timeout | null = null;

function sweepExpiredKeys(maxEntries: number = 1000000) {
  const now = Date.now();
  for (const [key, entry] of tokenBucketStore.entries()) {
    // If tokens are 0 and lastRefill is older than a window, delete
    if (
      entry.tokens <= 0 &&
      now - entry.lastRefill > entry.capacity / entry.refillRate
    ) {
      tokenBucketStore.delete(key);
    }
  }
  // Enforce maxEntries
  while (tokenBucketStore.size > maxEntries) {
    const firstKey = tokenBucketStore.keys().next().value;
    tokenBucketStore.delete(firstKey);
  }
}

export class TokenBucketStrategy implements RateLimitStrategy {
  private capacity: number;
  private refillRate: number;
  private config: any;
  private maxEntries: number;
  private gcStarted = false;
  private getLimitFn?: (req?: any) => number;

  constructor(config: any) {
    this.config = config;
    this.capacity = config.limit;
    this.refillRate = config.limit / (config.windowInSeconds * 1000);
    this.maxEntries = config.limiterConfig?.maxStoreSize || 1000000;
    this.getLimitFn =
      typeof config.limit === "function" ? config.limit : undefined;
    this.startGC();
  }

  private startGC() {
    if (this.gcStarted) return;
    gcInterval = setInterval(() => {
      sweepExpiredKeys(this.maxEntries);
    }, 30000);
    this.gcStarted = true;
  }

  stopGC() {
    if (gcInterval) clearInterval(gcInterval);
    this.gcStarted = false;
  }

  private getLimit(req?: any): number {
    if (this.getLimitFn) {
      return this.getLimitFn(req);
    }
    return this.capacity;
  }

  async isAllowed(key: string, req?: any): Promise<boolean> {
    // Enforce maxEntries before allowing
    while (tokenBucketStore.size >= this.maxEntries) {
      const firstKey = tokenBucketStore.keys().next().value;
      tokenBucketStore.delete(firstKey);
    }
    const now = Date.now();
    const limit = this.getLimit(req);
    let entry = tokenBucketStore.get(key);
    if (!entry) {
      entry = {
        tokens: limit,
        lastRefill: now,
        capacity: limit,
        refillRate: limit / (this.config.windowInSeconds * 1000),
      };
      tokenBucketStore.set(key, entry);
    }
    const timeElapsed = now - entry.lastRefill;
    const tokensToAdd = timeElapsed * entry.refillRate;
    entry.tokens = Math.min(entry.capacity, entry.tokens + tokensToAdd);
    entry.lastRefill = now;
    if (entry.tokens >= 1) {
      entry.tokens -= 1;
      return true;
    }
    return false;
  }

  async getState(key: string, req?: any): Promise<RateLimitState> {
    const now = Date.now();
    const limit = this.getLimit(req);
    const entry = tokenBucketStore.get(key);
    if (!entry) {
      return {
        remaining: limit,
        resetAt: now + limit / (limit / (this.config.windowInSeconds * 1000)),
        limit: limit,
      };
    }
    const timeElapsed = now - entry.lastRefill;
    const tokensToAdd = timeElapsed * entry.refillRate;
    const currentTokens = Math.min(entry.capacity, entry.tokens + tokensToAdd);
    return {
      remaining: Math.floor(currentTokens),
      resetAt: now + (limit - currentTokens) / entry.refillRate,
      limit: limit,
    };
  }

  async reset(key: string): Promise<void> {
    tokenBucketStore.delete(key);
  }

  static async resetAll(): Promise<void> {
    tokenBucketStore.clear();
  }
}
