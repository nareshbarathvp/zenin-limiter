import { RateLimitStrategy, RateLimitState } from "../types";

type SlidingWindowData = {
  timestamps: number[];
  expiresAt: number;
};

const slidingWindowStore = new Map<string, SlidingWindowData>();

let gcInterval: NodeJS.Timeout | null = null;

function sweepExpiredKeys(maxEntries: number = 1000000) {
  const now = Date.now();
  for (const [key, entry] of slidingWindowStore.entries()) {
    entry.timestamps = entry.timestamps.filter(
      (ts) => ts > now - entry.expiresAt
    );
    if (entry.timestamps.length === 0) {
      slidingWindowStore.delete(key);
    }
  }
  // Enforce maxEntries
  while (slidingWindowStore.size > maxEntries) {
    // Remove oldest (not LRU, but simple for now)
    const firstKey = slidingWindowStore.keys().next().value;
    slidingWindowStore.delete(firstKey);
  }
}

export class SlidingWindowStrategy implements RateLimitStrategy {
  private limit: number;
  private windowMs: number;
  private config: any;
  private maxEntries: number;
  private gcStarted = false;
  private getLimitFn?: (req?: any) => number;

  constructor(config: any) {
    this.config = config;
    this.limit = config.limit;
    this.windowMs = config.windowInSeconds * 1000;
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
    return this.limit;
  }

  async isAllowed(key: string, req?: any): Promise<boolean> {
    // Enforce maxEntries before allowing
    while (slidingWindowStore.size >= this.maxEntries) {
      const firstKey = slidingWindowStore.keys().next().value;
      slidingWindowStore.delete(firstKey);
    }
    const now = Date.now();
    const windowStart = now - this.windowMs;
    let entry = slidingWindowStore.get(key);
    if (!entry) {
      entry = { timestamps: [], expiresAt: now + this.windowMs };
      slidingWindowStore.set(key, entry);
    }
    entry.timestamps = entry.timestamps.filter(
      (timestamp) => timestamp > windowStart
    );
    if (entry.timestamps.length < this.getLimit(req)) {
      entry.timestamps.push(now);
      return true;
    }
    return false;
  }

  async getState(key: string, req?: any): Promise<RateLimitState> {
    const now = Date.now();
    const windowStart = now - this.windowMs;
    const entry = slidingWindowStore.get(key);
    const limit = this.getLimit(req);
    if (!entry) {
      return {
        remaining: limit,
        resetAt: now + this.windowMs,
        limit: limit,
      };
    }
    entry.timestamps = entry.timestamps.filter(
      (timestamp) => timestamp > windowStart
    );
    return {
      remaining: Math.max(0, limit - entry.timestamps.length),
      resetAt:
        entry.timestamps.length > 0
          ? entry.timestamps[0] + this.windowMs
          : now + this.windowMs,
      limit: limit,
    };
  }

  async reset(key: string): Promise<void> {
    slidingWindowStore.delete(key);
  }

  static async resetAll(): Promise<void> {
    slidingWindowStore.clear();
  }
}
