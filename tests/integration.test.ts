import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import Fastify from "fastify";
import { RateLimit, NestLimiterGuard } from "../src/middleware/nest";
import { expressLimiter } from "../src/middleware/express";
import { fastifyLimiter } from "../src/middleware/fastify";
import { universalLimiter } from "../src/middleware/handler";
import { UnauthorizedException } from "@nestjs/common";
import { FixedWindowStrategy } from "../src/strategies/memoryStore";
import { SlidingWindowStrategy } from "../src/strategies/slidingWindow";
import { TokenBucketStrategy } from "../src/strategies/tokenBucket";

// 🧪 Integration Tests
describe("Integration Tests", () => {
  beforeEach(async () => {
    // Reset all rate limiters for test isolation
    await FixedWindowStrategy.resetAll();
    await SlidingWindowStrategy.resetAll();
    await TokenBucketStrategy.resetAll();
  });

  describe("Express Integration", () => {
    let app: express.Express;

    beforeEach(() => {
      app = express();
    });

    it("works with IP-based limiting", async () => {
      app.use(
        expressLimiter({
          keyType: "ip",
          limit: 2,
          windowInSeconds: 60,
        })
      );
      app.get("/", (_, res) => res.send("OK"));

      const res1 = await request(app).get("/");
      const res2 = await request(app).get("/");
      const res3 = await request(app).get("/");

      expect(res1.statusCode).toBe(200);
      expect(res2.statusCode).toBe(200);
      expect(res3.statusCode).toBe(429);
    });

    it("works with header-based limiting", async () => {
      app.use(
        expressLimiter({
          keyType: "header:X-API-KEY",
          limit: 2,
          windowInSeconds: 60,
        })
      );
      app.get("/", (_, res) => res.send("OK"));

      const res1 = await request(app).get("/").set("X-API-KEY", "key1");
      const res2 = await request(app).get("/").set("X-API-KEY", "key1");
      const res3 = await request(app).get("/").set("X-API-KEY", "key1");

      expect(res1.statusCode).toBe(200);
      expect(res2.statusCode).toBe(200);
      expect(res3.statusCode).toBe(429);
    });

    it("works with custom key generator", async () => {
      app.use(
        expressLimiter({
          customKeyGenerator: (req) => req.headers["x-user-id"] || "anonymous",
          limit: 2,
          windowInSeconds: 60,
        })
      );
      app.get("/", (_, res) => res.send("OK"));

      const res1 = await request(app).get("/").set("X-User-ID", "user1");
      const res2 = await request(app).get("/").set("X-User-ID", "user1");
      const res3 = await request(app).get("/").set("X-User-ID", "user1");

      expect(res1.statusCode).toBe(200);
      expect(res2.statusCode).toBe(200);
      expect(res3.statusCode).toBe(429);
    });

    it("supports hooks", async () => {
      const onLimitReached = vi.fn();
      const onPass = vi.fn();

      app.use(
        expressLimiter({
          keyType: "ip",
          limit: 1,
          windowInSeconds: 60,
          onLimitReached,
          onPass,
        })
      );
      app.get("/", (_, res) => res.send("OK"));

      await request(app).get("/");
      await request(app).get("/");

      // Add a small delay to ensure hooks are called
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(onPass).toHaveBeenCalledTimes(1);
      expect(onLimitReached).toHaveBeenCalledTimes(1);
    });
  });

  describe("Fastify Integration", () => {
    it("works with IP-based limiting", async () => {
      const fastify = Fastify();
      fastify.addHook(
        "onRequest",
        fastifyLimiter({
          keyType: "ip",
          limit: 2,
          windowInSeconds: 60,
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

    it("supports different strategies", async () => {
      const fastify = Fastify();
      fastify.addHook(
        "onRequest",
        fastifyLimiter({
          keyType: "ip",
          limit: 2,
          windowInSeconds: 60,
          strategy: "sliding",
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

  describe("NestJS Integration", () => {
    it("works with guard-based limiting", async () => {
      const guard = new NestLimiterGuard({
        keyType: "ip",
        limit: 2,
        windowInSeconds: 60,
      });

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({ ip: "192.168.1.100" }), // Unique IP
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      };

      expect(await guard.canActivate(mockContext as any)).toBe(true);
      expect(await guard.canActivate(mockContext as any)).toBe(true);
      await expect(guard.canActivate(mockContext as any)).rejects.toThrow(
        UnauthorizedException
      );
    });

    it("supports decorator-based limiting", async () => {
      const guard = new NestLimiterGuard({
        keyType: "ip",
        limit: 2,
        windowInSeconds: 60,
      });

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({ ip: "192.168.1.200" }), // Different unique IP
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      };

      // Mock Reflect.getMetadata to return route-specific config
      const originalGetMetadata = Reflect.getMetadata;
      Reflect.getMetadata = vi.fn().mockReturnValue({
        keyType: "ip",
        limit: 1,
        windowInSeconds: 60,
      });

      expect(await guard.canActivate(mockContext as any)).toBe(true);
      await expect(guard.canActivate(mockContext as any)).rejects.toThrow(
        UnauthorizedException
      );

      Reflect.getMetadata = originalGetMetadata;
    });
  });

  describe("Universal Integration", () => {
    it("works with custom request objects", async () => {
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

  describe("Error Handling", () => {
    it("handles invalid configurations gracefully", () => {
      expect(() => {
        expressLimiter({
          limit: -1, // Invalid limit
          windowInSeconds: 60,
        });
      }).toThrow();
    });

    it("handles missing configurations with defaults", () => {
      expect(() => {
        expressLimiter({}); // Should use defaults
      }).not.toThrow();
    });
  });
});
