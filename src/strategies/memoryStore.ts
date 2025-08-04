import { RateLimiterConfig } from "../types";

/**
 * A record to track individual key usage, expiration, and LRU node.
 */
type MemoryStoreData = {
  count: number;
  expiresAt: number;
  lruNode: LruNode;
};

/**
 * A node in the expiry min-heap.
 */
type HeapNode = {
  key: string;
  expiresAt: number;
};

/**
 * A node in the LRU doubly-linked list.
 */
type LruNode = {
  key: string;
  prev: LruNode | null;
  next: LruNode | null;
};

/**
 * Rate limiter state.
 */
const memoryStore = new Map<string, MemoryStoreData>();
const heap: HeapNode[] = []; // Min-heap for expirations
let hits = 0;
let rejections = 0;
let callCount = 0;
let lruHead: LruNode | null = null; // LRU list head
let lruTail: LruNode | null = null; // LRU list tail
const perKeyStats = new Map<string, { hits: number; rejections: number }>(); // Optional per-key metrics
let lockPromise: Promise<void> = Promise.resolve(); // Concurrency lock
let gcInterval: NodeJS.Timeout | null = null;

/**
 * Min-heap operations for expiry queue.
 */
function heapPush(node: HeapNode): void {
  heap.push(node);
  let i = heap.length - 1;
  while (i > 0) {
    const parent = Math.floor((i - 1) / 2);
    if (heap[parent].expiresAt <= node.expiresAt) break;
    heap[i] = heap[parent];
    i = parent;
  }
  heap[i] = node;
}

function heapPop(): HeapNode | undefined {
  if (heap.length === 0) return undefined;
  const result = heap[0];
  const last = heap.pop()!;
  if (heap.length > 0) {
    heap[0] = last;
    let i = 0;
    while (true) {
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      let smallest = i;
      if (
        left < heap.length &&
        heap[left].expiresAt < heap[smallest].expiresAt
      ) {
        smallest = left;
      }
      if (
        right < heap.length &&
        heap[right].expiresAt < heap[smallest].expiresAt
      ) {
        smallest = right;
      }
      if (smallest === i) break;
      [heap[i], heap[smallest]] = [heap[smallest], heap[i]];
      i = smallest;
    }
  }
  return result;
}

/**
 * LRU operations for memory capping.
 */
function addLruNode(key: string): LruNode {
  const node: LruNode = { key, prev: null, next: lruHead };
  if (lruHead) lruHead.prev = node;
  lruHead = node;
  if (!lruTail) lruTail = node;
  return node;
}

function moveToFront(node: LruNode): void {
  if (node === lruHead) return;
  if (node.prev) node.prev.next = node.next;
  if (node.next) node.next.prev = node.prev;
  if (node === lruTail) lruTail = node.prev;
  node.next = lruHead;
  node.prev = null;
  if (lruHead) lruHead.prev = node;
  lruHead = node;
  if (!lruTail) lruTail = node;
}

function removeLruTail(): void {
  if (!lruTail) return;
  memoryStore.delete(lruTail.key);
  perKeyStats.delete(lruTail.key);
  if (lruTail.prev) {
    lruTail.prev.next = null;
    lruTail = lruTail.prev;
  } else {
    lruHead = null;
    lruTail = null;
  }
}

/**
 * Resets the rate limit for a specific key.
 * @param key The key to reset
 * @throws Error if key is invalid
 */
export async function resetKey(key: string): Promise<void> {
  if (typeof key !== "string" || key.trim() === "") {
    throw new Error("Invalid key");
  }
  const unlock = await acquireLock();
  try {
    const entry = memoryStore.get(key);
    if (entry) {
      if (entry.lruNode.prev) entry.lruNode.prev.next = entry.lruNode.next;
      if (entry.lruNode.next) entry.lruNode.next.prev = entry.lruNode.prev;
      if (entry.lruNode === lruHead) lruHead = entry.lruNode.next;
      if (entry.lruNode === lruTail) lruTail = entry.lruNode.prev;
      memoryStore.delete(key);
      perKeyStats.delete(key);
    }
  } finally {
    unlock();
  }
}

/**
 * Resets all rate limit state.
 */
export async function resetAll(): Promise<void> {
  const unlock = await acquireLock();
  try {
    memoryStore.clear();
    heap.length = 0;
    hits = 0;
    rejections = 0;
    callCount = 0;
    lruHead = null;
    lruTail = null;
    perKeyStats.clear();
  } finally {
    unlock();
  }
}

/**
 * Returns current rate limit metrics.
 * @param key Optional key for per-key stats
 * @returns Object containing hits and rejections (global or per-key)
 */
export async function getMetrics(
  key?: string
): Promise<{ hits: number; rejections: number }> {
  const unlock = await acquireLock();
  try {
    if (key && perKeyStats.has(key)) {
      return { ...perKeyStats.get(key)! };
    }
    return { hits, rejections };
  } finally {
    unlock();
  }
}

/**
 * Acquires a lock for concurrency safety in JavaScript's event loop.
 * @returns A function to release the lock
 */
async function acquireLock(): Promise<() => void> {
  const currentLock = lockPromise;
  let resolveLock: () => void;
  lockPromise = new Promise((resolve) => {
    resolveLock = resolve;
  });
  await currentLock;
  return () => resolveLock!();
}

function sweepExpiredKeys(maxBatchCleanup: number = 1000) {
  const now = Date.now();
  let cleaned = 0;
  while (
    heap.length > 0 &&
    heap[0].expiresAt <= now &&
    cleaned < maxBatchCleanup
  ) {
    const expired = heapPop()!;
    const current = memoryStore.get(expired.key);
    if (current && current.expiresAt === expired.expiresAt) {
      if (current.lruNode.prev)
        current.lruNode.prev.next = current.lruNode.next;
      if (current.lruNode.next)
        current.lruNode.next.prev = current.lruNode.prev;
      if (current.lruNode === lruHead) lruHead = current.lruNode.next;
      if (current.lruNode === lruTail) lruTail = current.lruNode.prev;
      memoryStore.delete(expired.key);
      perKeyStats.delete(expired.key);
    }
    cleaned++;
  }
}

/**
 * Checks if a key is allowed based on rate limit.
 * Uses a min-heap for expirations, LRU for memory capping, and Promise-based locking.
 * Handles millions of users with hybrid cleanup (on-demand + periodic).
 * @param key Unique identifier for rate limiting
 * @param limit Maximum requests allowed in window
 * @param windowInSeconds Time window in seconds
 * @param config Optional configuration (maxStoreSize, cleanupInterval, enablePerKeyStats, maxBatchCleanup)
 * @param now Optional time source for testing (defaults to Date.now)
 * @returns True if allowed, false if rate limit exceeded
 * @throws Error if inputs are invalid
 */
export async function isAllowedMemory(
  key: string,
  limit: number,
  windowInSeconds: number,
  config: RateLimiterConfig = {},
  now: () => number = Date.now
): Promise<boolean> {
  /* Validate inputs start*/
  if (typeof key !== "string" || key.trim() === "")
    throw new Error("Invalid key");

  if (
    !Number.isFinite(limit) ||
    limit <= 0 ||
    !Number.isFinite(windowInSeconds) ||
    windowInSeconds <= 0
  )
    throw new Error("Invalid limit or windowInSeconds");

  if (windowInSeconds * 1000 > Number.MAX_SAFE_INTEGER) {
    throw new Error("Window too large for safe expiration");
  }
  /* Validate inputs start*/

  const {
    maxStoreSize = 1000000,
    cleanupInterval = 1000,
    enablePerKeyStats = false,
    maxBatchCleanup = 1000,
  } = config;
  const unlock = await acquireLock();
  try {
    const currentTime = now();
    callCount++;

    // Step 1: On-demand cleanup for recent expirations
    let cleanupCount = 0;
    while (
      heap.length > 0 &&
      heap[0].expiresAt <= currentTime &&
      cleanupCount < maxBatchCleanup
    ) {
      const expired = heapPop()!;
      const current = memoryStore.get(expired.key);
      if (current && current.expiresAt === expired.expiresAt) {
        if (current.lruNode.prev)
          current.lruNode.prev.next = current.lruNode.next;
        if (current.lruNode.next)
          current.lruNode.next.prev = current.lruNode.prev;
        if (current.lruNode === lruHead) lruHead = current.lruNode.next;
        if (current.lruNode === lruTail) lruTail = current.lruNode.prev;
        memoryStore.delete(expired.key);
        perKeyStats.delete(expired.key);
      }
      cleanupCount++;
    }

    // Step 2: Periodic cleanup for older expirations
    if (callCount % cleanupInterval === 0 && heap.length > 0) {
      const threshold = currentTime - windowInSeconds * 1000;
      cleanupCount = 0;
      while (
        heap.length > 0 &&
        heap[0].expiresAt <= threshold &&
        cleanupCount < maxBatchCleanup
      ) {
        const expired = heapPop()!;
        const current = memoryStore.get(expired.key);
        if (current && current.expiresAt === expired.expiresAt) {
          if (current.lruNode.prev)
            current.lruNode.prev.next = current.lruNode.next;
          if (current.lruNode.next)
            current.lruNode.next.prev = current.lruNode.prev;
          if (current.lruNode === lruHead) lruHead = current.lruNode.next;
          if (current.lruNode === lruTail) lruTail = current.lruNode.prev;
          memoryStore.delete(expired.key);
          perKeyStats.delete(expired.key);
        }
        cleanupCount++;
      }
    }

    // Step 3: Enforce memory cap
    while (memoryStore.size >= maxStoreSize) {
      removeLruTail();
    }

    // Step 4: Process the current key
    let entry = memoryStore.get(key);
    if (!entry) {
      // New entry
      const expiresAt = currentTime + windowInSeconds * 1000;
      const lruNode = addLruNode(key);
      entry = { count: 1, expiresAt, lruNode };
      memoryStore.set(key, entry);
      heapPush({ key, expiresAt });
      hits++;
      if (enablePerKeyStats) {
        perKeyStats.set(key, {
          hits: (perKeyStats.get(key)?.hits || 0) + 1,
          rejections: perKeyStats.get(key)?.rejections || 0,
        });
      }
      return true;
    }

    moveToFront(entry.lruNode);

    if (entry.expiresAt <= currentTime) {
      // Expired entry
      const expiresAt = currentTime + windowInSeconds * 1000;
      entry.count = 1;
      entry.expiresAt = expiresAt;
      heapPush({ key, expiresAt });
      hits++;
      if (enablePerKeyStats) {
        perKeyStats.set(key, {
          hits: (perKeyStats.get(key)?.hits || 0) + 1,
          rejections: perKeyStats.get(key)?.rejections || 0,
        });
      }
      return true;
    }

    if (entry.count < limit) {
      entry.count++;
      hits++;
      if (enablePerKeyStats) {
        perKeyStats.set(key, {
          hits: (perKeyStats.get(key)?.hits || 0) + 1,
          rejections: perKeyStats.get(key)?.rejections || 0,
        });
      }
      return true;
    }

    rejections++;
    if (enablePerKeyStats) {
      perKeyStats.set(key, {
        hits: perKeyStats.get(key)?.hits || 0,
        rejections: (perKeyStats.get(key)?.rejections || 0) + 1,
      });
    }
    return false; // Rate limit exceeded
  } finally {
    unlock();
  }
}

import { RateLimitStrategy, RateLimitState } from "../types";

export class FixedWindowStrategy implements RateLimitStrategy {
  private config: any;
  private maxEntries: number;
  private gcStarted = false;
  private getLimitFn?: (req?: any) => number;

  constructor(config: any) {
    this.config = config;
    this.maxEntries = config.limiterConfig?.maxStoreSize || 1000000;
    this.getLimitFn =
      typeof config.limit === "function" ? config.limit : undefined;
    this.startGC();
  }

  private getLimit(req?: any): number {
    if (this.getLimitFn) {
      return this.getLimitFn(req);
    }
    return this.config.limit;
  }

  private startGC() {
    if (this.gcStarted) return;
    gcInterval = setInterval(() => {
      sweepExpiredKeys(this.config.limiterConfig?.maxBatchCleanup || 1000);
      // Enforce maxEntries
      while (memoryStore.size > this.maxEntries) {
        removeLruTail();
      }
    }, 30000); // 30 seconds
    this.gcStarted = true;
  }

  stopGC() {
    if (gcInterval) clearInterval(gcInterval);
    this.gcStarted = false;
  }

  async isAllowed(key: string, req?: any): Promise<boolean> {
    // Enforce maxEntries before allowing
    while (memoryStore.size >= this.maxEntries) {
      removeLruTail();
    }
    return isAllowedMemory(
      key,
      this.getLimit(req),
      this.config.windowInSeconds,
      this.config.limiterConfig
    );
  }

  async reset(key: string): Promise<void> {
    return resetKey(key);
  }

  async getState(key: string): Promise<RateLimitState> {
    // Not implemented in original logic, return dummy for now
    return {
      remaining: 0,
      resetAt: 0,
      limit: this.config.limit,
    };
  }

  static async resetAll(): Promise<void> {
    await resetAll();
  }
}
