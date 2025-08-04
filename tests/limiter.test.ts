import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import Fastify from "fastify";
import { RateLimiter } from "../src/core/RateLimiter";
import { FixedWindowStrategy } from "../src/strategies/memoryStore";
import { SlidingWindowStrategy } from "../src/strategies/slidingWindow";
import { TokenBucketStrategy } from "../src/strategies/tokenBucket";
import { expressLimiter } from "../src/middleware/express";
import { fastifyLimiter } from "../src/middleware/fastify";
import { universalLimiter } from "../src/middleware/handler";

// 🧪 Core Rate Limiter Tests
describe("Rate Limiter Core", () => {
  beforeEach(async () => {
    // Reset all strategies
    await FixedWindowStrategy.resetAll();
    await SlidingWindowStrategy.resetAll();
    await TokenBucketStrategy.resetAll();
  });

  describe("Fixed Window Strategy", () => {
    it("allows under limit", async () => {
      const limiter = new RateLimiter({
        limit: 3,
        windowInSeconds: 60,
        strategy: "fixed",
      });

      expect(await limiter.isAllowed("test-user")).toBe(true);
      expect(await limiter.isAllowed("test-user")).toBe(true);
      expect(await limiter.isAllowed("test-user")).toBe(true);
    });

    it("blocks after limit", async () => {
      const limiter = new RateLimiter({
        limit: 2,
        windowInSeconds: 60,
        strategy: "fixed",
      });

      expect(await limiter.isAllowed("test-user")).toBe(true);
      expect(await limiter.isAllowed("test-user")).toBe(true);
      expect(await limiter.isAllowed("test-user")).toBe(false);
    });
  });

  describe("Sliding Window Strategy", () => {
    it("allows under limit", async () => {
      const limiter = new RateLimiter({
        limit: 3,
        windowInSeconds: 60,
        strategy: "sliding",
      });

      expect(await limiter.isAllowed("test-user")).toBe(true);
      expect(await limiter.isAllowed("test-user")).toBe(true);
      expect(await limiter.isAllowed("test-user")).toBe(true);
    });

    it("blocks after limit", async () => {
      const limiter = new RateLimiter({
        limit: 2,
        windowInSeconds: 60,
        strategy: "sliding",
      });

      expect(await limiter.isAllowed("test-user")).toBe(true);
      expect(await limiter.isAllowed("test-user")).toBe(true);
      expect(await limiter.isAllowed("test-user")).toBe(false);
    });
  });

  describe("Token Bucket Strategy", () => {
    it("allows under limit", async () => {
      const limiter = new RateLimiter({
        limit: 3,
        windowInSeconds: 60,
        strategy: "tokenBucket",
      });

      expect(await limiter.isAllowed("test-user")).toBe(true);
      expect(await limiter.isAllowed("test-user")).toBe(true);
      expect(await limiter.isAllowed("test-user")).toBe(true);
    });

    it("blocks after limit", async () => {
      const limiter = new RateLimiter({
        limit: 2,
        windowInSeconds: 60,
        strategy: "tokenBucket",
      });

      expect(await limiter.isAllowed("test-user")).toBe(true);
      expect(await limiter.isAllowed("test-user")).toBe(true);
      expect(await limiter.isAllowed("test-user")).toBe(false);
    });
  });

  describe("DX Features", () => {
    it("supports dryRun mode", async () => {
      const limiter = new RateLimiter({
        limit: 1,
        windowInSeconds: 60,
        dryRun: true,
      });

      // Should always allow in dry run mode
      expect(await limiter.isAllowed("test-user")).toBe(true);
      expect(await limiter.isAllowed("test-user")).toBe(true);
      expect(await limiter.isAllowed("test-user")).toBe(true);
    });

    it("supports silent mode", async () => {
      const limiter = new RateLimiter({
        limit: 1,
        windowInSeconds: 60,
        silent: true,
      });

      // Should return actual result but not block
      expect(await limiter.isAllowed("test-user")).toBe(true);
      expect(await limiter.isAllowed("test-user")).toBe(false);
    });

    it("supports adaptive limits", async () => {
      const limiter = new RateLimiter({
        limit: (req: any) => (req?.user?.isPremium ? 1000 : 100),
        windowInSeconds: 60,
      });

      const premiumReq = { user: { isPremium: true } };
      const regularReq = { user: { isPremium: false } };

      // Test with premium user (should have higher limit)
      for (let i = 0; i < 100; i++) {
        expect(await limiter.isAllowed("premium-user", premiumReq)).toBe(true);
      }

      // Test with regular user (should have lower limit)
      for (let i = 0; i < 100; i++) {
        expect(await limiter.isAllowed("regular-user", regularReq)).toBe(true);
      }
      expect(await limiter.isAllowed("regular-user", regularReq)).toBe(false);
    });

    it("provides stats", async () => {
      const limiter = new RateLimiter({
        limit: 2,
        windowInSeconds: 60,
      });

      await limiter.isAllowed("test-user");
      await limiter.isAllowed("test-user");
      await limiter.isAllowed("test-user");

      const stats = limiter.getStats();
      expect(stats.totalRequests).toBe(3);
      expect(stats.hits).toBe(2);
      expect(stats.rejections).toBe(1);
    });
  });
});

// 🧪 Express Middleware
describe("Express Rate Limiter", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(
      expressLimiter({
        keyType: "ip",
        limit: 2,
        windowInSeconds: 60,
      })
    );
    app.get("/", (_, res) => res.send("OK"));
  });

  it("limits requests per IP", async () => {
    const res1 = await request(app).get("/");
    const res2 = await request(app).get("/");
    const res3 = await request(app).get("/");

    expect(res1.statusCode).toBe(200);
    expect(res2.statusCode).toBe(200);
    expect(res3.statusCode).toBe(429);
  });
});

// 🧪 Fastify Middleware
describe("Fastify Rate Limiter", () => {
  it("limits requests per IP", async () => {
    const fastify = Fastify();
    fastify.addHook(
      "onRequest",
      fastifyLimiter({
        keyType: "ip",
        limit: 2,
        windowInSeconds: 60,
        limiterConfig: { enablePerKeyStats: true },
      })
    );

    fastify.get("/", (_, reply) => reply.send("Hello"));

    await fastify.ready();

    const res1 = await fastify.inject({ method: "GET", url: "/" });
    const res2 = await fastify.inject({ method: "GET", url: "/" });
    const res3 = await fastify.inject({ method: "GET", url: "/" });

    expect(res1.statusCode).toBe(200);
    expect(res2.statusCode).toBe(200);
    expect(res3.statusCode).toBe(429);
  });
});

// 🧪 Universal Middleware
describe("Universal Rate Limiter", () => {
  it("blocks after reaching limit", async () => {
    const req = { ip: "123.45.67.89" } as any;
    const res: any = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      send() {},
    };
    const next = vi.fn();

    const limiter = universalLimiter({
      keyType: "ip",
      limit: 2,
      windowInSeconds: 60,
    });

    await limiter(req, res, next);
    await limiter(req, res, next);
    await limiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(2);
  });
});
