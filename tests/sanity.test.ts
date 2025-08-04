import { describe, it, expect, beforeEach, vi } from "vitest";

// Test all imports work correctly
describe("Import Sanity Tests", () => {
  it("should import all Express middleware components", async () => {
    const { expressLimiter } = await import("../src/middleware/express");
    expect(typeof expressLimiter).toBe("function");
  });

  it("should import all Fastify middleware components", async () => {
    const { fastifyLimiter } = await import("../src/middleware/fastify");
    expect(typeof fastifyLimiter).toBe("function");
  });

  it("should import all NestJS components", async () => {
    const { NestLimiterGuard, RateLimit, RateLimitModule } = await import(
      "../src/middleware/nest"
    );
    expect(typeof NestLimiterGuard).toBe("function");
    expect(typeof RateLimit).toBe("function");
    expect(typeof RateLimitModule).toBe("function");
  });

  it("should import all strategies", async () => {
    const { FixedWindowStrategy } = await import(
      "../src/strategies/memoryStore"
    );
    const { SlidingWindowStrategy } = await import(
      "../src/strategies/slidingWindow"
    );
    const { TokenBucketStrategy } = await import(
      "../src/strategies/tokenBucket"
    );

    expect(typeof FixedWindowStrategy).toBe("function");
    expect(typeof SlidingWindowStrategy).toBe("function");
    expect(typeof TokenBucketStrategy).toBe("function");
  });

  it("should import core RateLimiter", async () => {
    const { RateLimiter } = await import("../src/core/RateLimiter");
    expect(typeof RateLimiter).toBe("function");
  });

  it("should import utility functions", async () => {
    const { applyDefaults } = await import("../src/utils/configDefaults");
    const { validateConfig, throwIfInvalid } = await import(
      "../src/utils/configValidator"
    );

    expect(typeof applyDefaults).toBe("function");
    expect(typeof validateConfig).toBe("function");
    expect(typeof throwIfInvalid).toBe("function");
  });

  it("should import types", async () => {
    const types = await import("../src/types");
    // Check that the module exists and has the expected structure
    expect(types).toBeDefined();
    expect(typeof types).toBe("object");
  });
});

// Test basic functionality
describe("Basic Functionality Tests", () => {
  beforeEach(async () => {
    const { FixedWindowStrategy } = await import(
      "../src/strategies/memoryStore"
    );
    const { SlidingWindowStrategy } = await import(
      "../src/strategies/slidingWindow"
    );
    const { TokenBucketStrategy } = await import(
      "../src/strategies/tokenBucket"
    );
    await FixedWindowStrategy.resetAll();
    await SlidingWindowStrategy.resetAll();
    await TokenBucketStrategy.resetAll();
  });

  it("should create RateLimiter with default config", async () => {
    const { RateLimiter } = await import("../src/core/RateLimiter");
    const limiter = new RateLimiter({});
    expect(limiter).toBeInstanceOf(RateLimiter);
  });

  it("should create RateLimiter with custom config", async () => {
    const { RateLimiter } = await import("../src/core/RateLimiter");
    const limiter = new RateLimiter({
      limit: 10,
      windowInSeconds: 60,
      strategy: "fixed",
    });
    expect(limiter).toBeInstanceOf(RateLimiter);
  });

  it("should work with all strategies", async () => {
    const { RateLimiter } = await import("../src/core/RateLimiter");

    const fixedLimiter = new RateLimiter({
      strategy: "fixed",
      limit: 5,
      windowInSeconds: 60,
    });
    const slidingLimiter = new RateLimiter({
      strategy: "sliding",
      limit: 5,
      windowInSeconds: 60,
    });
    const tokenBucketLimiter = new RateLimiter({
      strategy: "tokenBucket",
      limit: 5,
      windowInSeconds: 60,
    });

    expect(await fixedLimiter.isAllowed("test")).toBe(true);
    expect(await slidingLimiter.isAllowed("test")).toBe(true);
    expect(await tokenBucketLimiter.isAllowed("test")).toBe(true);
  });

  it("should handle adaptive limits", async () => {
    const { RateLimiter } = await import("../src/core/RateLimiter");
    const limiter = new RateLimiter({
      limit: (req) => (req?.user?.isPremium ? 1000 : 100),
      windowInSeconds: 60,
    });

    const premiumReq = { user: { isPremium: true } };
    const regularReq = { user: { isPremium: false } };

    expect(await limiter.isAllowed("premium", premiumReq)).toBe(true);
    expect(await limiter.isAllowed("regular", regularReq)).toBe(true);
  });

  it("should work with hooks", async () => {
    const { RateLimiter } = await import("../src/core/RateLimiter");
    const onPass = vi.fn();
    const onLimitReached = vi.fn();

    const limiter = new RateLimiter({
      limit: 1,
      windowInSeconds: 60,
      onPass,
      onLimitReached,
    });

    await limiter.isAllowed("test");
    await limiter.isAllowed("test");

    expect(onPass).toHaveBeenCalled();
    expect(onLimitReached).toHaveBeenCalled();
  });

  it("should work with debug mode", async () => {
    const { RateLimiter } = await import("../src/core/RateLimiter");
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const limiter = new RateLimiter({
      limit: 10,
      windowInSeconds: 60,
      debug: true,
    });

    await limiter.isAllowed("test");

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("should work with dryRun mode", async () => {
    const { RateLimiter } = await import("../src/core/RateLimiter");
    const limiter = new RateLimiter({
      limit: 1,
      windowInSeconds: 60,
      dryRun: true,
    });

    // Should always return true in dry run mode
    expect(await limiter.isAllowed("test")).toBe(true);
    expect(await limiter.isAllowed("test")).toBe(true);
  });

  it("should provide stats", async () => {
    const { RateLimiter } = await import("../src/core/RateLimiter");
    const limiter = new RateLimiter({
      limit: 1,
      windowInSeconds: 60,
    });

    await limiter.isAllowed("test1");
    await limiter.isAllowed("test1"); // Should be rejected

    const stats = limiter.getStats();
    expect(stats.totalRequests).toBe(2);
    expect(stats.hits).toBe(1);
    expect(stats.rejections).toBe(1);
    // activeKeys might be 0 due to immediate cleanup, which is fine
  });
});

// Test middleware creation
describe("Middleware Creation Tests", () => {
  it("should create Express middleware", async () => {
    const { expressLimiter } = await import("../src/middleware/express");
    const middleware = expressLimiter({
      limit: 100,
      windowInSeconds: 60,
    });
    expect(typeof middleware).toBe("function");
  });

  it("should create Fastify middleware", async () => {
    const { fastifyLimiter } = await import("../src/middleware/fastify");
    const middleware = fastifyLimiter({
      limit: 100,
      windowInSeconds: 60,
    });
    expect(typeof middleware).toBe("function");
  });

  it("should create NestJS guard", async () => {
    const { NestLimiterGuard } = await import("../src/middleware/nest");
    const guard = new NestLimiterGuard({
      limit: 100,
      windowInSeconds: 60,
    });
    expect(guard).toBeInstanceOf(NestLimiterGuard);
  });

  it("should create universal middleware", async () => {
    const { universalLimiter } = await import("../src/middleware/handler");
    const middleware = universalLimiter({
      limit: 100,
      windowInSeconds: 60,
    });
    expect(typeof middleware).toBe("function");
  });
});

// Test utility functions
describe("Utility Function Tests", () => {
  it("should apply defaults correctly", async () => {
    const { applyDefaults } = await import("../src/utils/configDefaults");
    const config = applyDefaults({ limit: 50 });
    expect(config.limit).toBe(50);
    expect(config.windowInSeconds).toBe(60); // default
    expect(config.strategy).toBe("fixed"); // default
  });

  it("should validate config correctly", async () => {
    const { validateConfig, throwIfInvalid } = await import(
      "../src/utils/configValidator"
    );

    // Valid config
    const validConfig = { limit: 100, windowInSeconds: 60 };
    const validErrors = validateConfig(validConfig);
    expect(validErrors).toHaveLength(0);

    // Invalid config
    const invalidConfig = { limit: -1, windowInSeconds: 60 };
    const invalidErrors = validateConfig(invalidConfig);
    expect(invalidErrors.length).toBeGreaterThan(0);

    // Should throw for invalid config
    expect(() => throwIfInvalid(invalidConfig)).toThrow();
  });
});
