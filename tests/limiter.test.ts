import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import Fastify from "fastify";
import { isAllowedMemory, resetAll } from "../src/strategies/memoryStore";
import { expressLimiter } from "../src/middleware/express";
import { fastifyLimiter } from "../src/middleware/fastify";
import { universalLimiter } from "../src/middleware/handler";

// 🧪 Memory Limiter Direct Usage
describe("Memory Rate Limiter (Raw)", () => {
  beforeEach(async () => {
    await resetAll();
  });

  it("allows under limit", async () => {
    const key = "test-user";
    expect(await isAllowedMemory(key, 3, 60)).toBe(true);
    expect(await isAllowedMemory(key, 3, 60)).toBe(true);
    expect(await isAllowedMemory(key, 3, 60)).toBe(true);
  });

  it("blocks after limit", async () => {
    const key = "test-user";
    await isAllowedMemory(key, 2, 60);
    await isAllowedMemory(key, 2, 60);
    expect(await isAllowedMemory(key, 2, 60)).toBe(false);
  });
});

// 🧪 Express Middleware
describe("Express Rate Limiter", () => {
  let app: express.Express;

  beforeEach(() => {
    app = express();
    app.use(
      expressLimiter({
        key: (req) => req.ip,
        limit: 2,
        windowInSeconds: 60,
        limiterConfig: {},
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
        key: (req) => req.ip,
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
      key: (req) => req.ip,
      limit: 2,
      windowInSeconds: 60,
      limiterConfig: {},
    });

    await limiter(req, res, next);
    await limiter(req, res, next);
    await limiter(req, res, next);

    expect(next).toHaveBeenCalledTimes(2);
  });
});
