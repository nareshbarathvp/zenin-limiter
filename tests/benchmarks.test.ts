import { describe, it, expect, beforeEach } from "vitest";
import { RateLimiter } from "../src/core/RateLimiter";
import { FixedWindowStrategy } from "../src/strategies/memoryStore";
import { SlidingWindowStrategy } from "../src/strategies/slidingWindow";
import { TokenBucketStrategy } from "../src/strategies/tokenBucket";

// 🧪 Performance Benchmarks
describe("Performance Benchmarks", () => {
  beforeEach(async () => {
    // Reset all strategies
    await FixedWindowStrategy.resetAll();
    await SlidingWindowStrategy.resetAll();
    await TokenBucketStrategy.resetAll();
  });

  describe("Throughput Tests", () => {
    it("handles high throughput with fixed window", async () => {
      const limiter = new RateLimiter({
        limit: 1000,
        windowInSeconds: 60,
        strategy: "fixed",
      });

      const start = Date.now();
      const promises: Promise<boolean>[] = [];

      // Test 10,000 requests
      for (let i = 0; i < 10000; i++) {
        promises.push(limiter.isAllowed(`user-${i % 100}`));
      }

      const results = await Promise.all(promises);
      const end = Date.now();

      const allowed = results.filter((r) => r).length;
      const rejected = results.filter((r) => !r).length;

      console.log(
        `Fixed Window - Time: ${
          end - start
        }ms, Allowed: ${allowed}, Rejected: ${rejected}`
      );

      expect(end - start).toBeLessThan(5000); // Should complete within 5 seconds
      expect(allowed).toBeGreaterThan(0);
    });

    it("handles high throughput with sliding window", async () => {
      const limiter = new RateLimiter({
        limit: 1000,
        windowInSeconds: 60,
        strategy: "sliding",
      });

      const start = Date.now();
      const promises: Promise<boolean>[] = [];

      // Test 10,000 requests
      for (let i = 0; i < 10000; i++) {
        promises.push(limiter.isAllowed(`user-${i % 100}`));
      }

      const results = await Promise.all(promises);
      const end = Date.now();

      const allowed = results.filter((r) => r).length;
      const rejected = results.filter((r) => !r).length;

      console.log(
        `Sliding Window - Time: ${
          end - start
        }ms, Allowed: ${allowed}, Rejected: ${rejected}`
      );

      expect(end - start).toBeLessThan(5000); // Should complete within 5 seconds
      expect(allowed).toBeGreaterThan(0);
    });

    it("handles high throughput with token bucket", async () => {
      const limiter = new RateLimiter({
        limit: 1000,
        windowInSeconds: 60,
        strategy: "tokenBucket",
      });

      const start = Date.now();
      const promises: Promise<boolean>[] = [];

      // Test 10,000 requests
      for (let i = 0; i < 10000; i++) {
        promises.push(limiter.isAllowed(`user-${i % 100}`));
      }

      const results = await Promise.all(promises);
      const end = Date.now();

      const allowed = results.filter((r) => r).length;
      const rejected = results.filter((r) => !r).length;

      console.log(
        `Token Bucket - Time: ${
          end - start
        }ms, Allowed: ${allowed}, Rejected: ${rejected}`
      );

      expect(end - start).toBeLessThan(5000); // Should complete within 5 seconds
      expect(allowed).toBeGreaterThan(0);
    });
  });

  describe("Memory Usage Tests", () => {
    it("manages memory efficiently with many keys", async () => {
      const limiter = new RateLimiter({
        limit: 100,
        windowInSeconds: 60,
        strategy: "fixed",
        limiterConfig: {
          maxStoreSize: 10000,
        },
      });

      const startMemory = process.memoryUsage().heapUsed;

      // Create 10,000 unique keys
      for (let i = 0; i < 10000; i++) {
        await limiter.isAllowed(`key-${i}`);
      }

      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = endMemory - startMemory;

      console.log(
        `Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB`
      );

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });

    it("cleans up expired entries", async () => {
      const limiter = new RateLimiter({
        limit: 10,
        windowInSeconds: 1, // Short window for testing
        strategy: "fixed",
      });

      // Create many keys
      for (let i = 0; i < 1000; i++) {
        await limiter.isAllowed(`key-${i}`);
      }

      // Wait for some entries to expire
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Create more keys to trigger cleanup
      for (let i = 0; i < 100; i++) {
        await limiter.isAllowed(`new-key-${i}`);
      }

      const stats = limiter.getStats();
      console.log(`Stats after cleanup:`, stats);

      expect(stats.totalRequests).toBeGreaterThan(0);
    });
  });

  describe("Strategy Comparison", () => {
    it("compares accuracy of different strategies", async () => {
      const fixedLimiter = new RateLimiter({
        limit: 5,
        windowInSeconds: 60,
        strategy: "fixed",
      });

      const slidingLimiter = new RateLimiter({
        limit: 5,
        windowInSeconds: 60,
        strategy: "sliding",
      });

      const tokenBucketLimiter = new RateLimiter({
        limit: 5,
        windowInSeconds: 60,
        strategy: "tokenBucket",
      });

      const key = "test-user";

      // Test all strategies with same parameters
      const fixedResults: boolean[] = [];
      const slidingResults: boolean[] = [];
      const tokenBucketResults: boolean[] = [];

      for (let i = 0; i < 10; i++) {
        fixedResults.push(await fixedLimiter.isAllowed(key));
        slidingResults.push(await slidingLimiter.isAllowed(key));
        tokenBucketResults.push(await tokenBucketLimiter.isAllowed(key));
      }

      const fixedAllowed = fixedResults.filter((r) => r).length;
      const slidingAllowed = slidingResults.filter((r) => r).length;
      const tokenBucketAllowed = tokenBucketResults.filter((r) => r).length;

      console.log(`Fixed: ${fixedAllowed}/10 allowed`);
      console.log(`Sliding: ${slidingAllowed}/10 allowed`);
      console.log(`Token Bucket: ${tokenBucketAllowed}/10 allowed`);

      // All should allow exactly 5 requests
      expect(fixedAllowed).toBe(5);
      expect(slidingAllowed).toBe(5);
      expect(tokenBucketAllowed).toBe(5);
    });
  });

  describe("Concurrent Access", () => {
    it("handles concurrent requests safely", async () => {
      const limiter = new RateLimiter({
        limit: 100,
        windowInSeconds: 60,
        strategy: "fixed",
      });

      const key = "concurrent-user";
      const concurrentRequests = 1000;
      const promises: Promise<boolean>[] = [];

      // Make many concurrent requests
      for (let i = 0; i < concurrentRequests; i++) {
        promises.push(limiter.isAllowed(key));
      }

      const results = await Promise.all(promises);
      const allowed = results.filter((r) => r).length;
      const rejected = results.filter((r) => !r).length;

      console.log(`Concurrent - Allowed: ${allowed}, Rejected: ${rejected}`);

      // Should allow exactly 100 requests
      expect(allowed).toBe(100);
      expect(rejected).toBe(concurrentRequests - 100);
    });
  });
});
