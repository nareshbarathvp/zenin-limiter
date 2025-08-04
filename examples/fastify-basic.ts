import Fastify from "fastify";
import { fastifyLimiter } from "zenin-limiter";

const fastify = Fastify({ logger: true });

// Basic IP-based rate limiting
fastify.addHook(
  "onRequest",
  fastifyLimiter({
    keyType: "ip",
    limit: 100,
    windowInSeconds: 60,
  })
);

// Header-based rate limiting for API keys
fastify.addHook("onRequest", async (request, reply) => {
  if (request.url.startsWith("/api")) {
    return fastifyLimiter({
      keyType: "header:X-API-KEY",
      limit: 1000,
      windowInSeconds: 3600, // 1 hour
      strategy: "sliding",
    })(request, reply);
  }
});

// Custom key generator for user-based limiting
fastify.addHook("onRequest", async (request, reply) => {
  if (request.url.startsWith("/user")) {
    return fastifyLimiter({
      customKeyGenerator: (req) => req.headers["x-user-id"] || "anonymous",
      limit: 50,
      windowInSeconds: 300, // 5 minutes
      strategy: "tokenBucket",
    })(request, reply);
  }
});

// Advanced configuration with hooks and debugging
fastify.addHook("onRequest", async (request, reply) => {
  if (request.url.startsWith("/admin")) {
    return fastifyLimiter({
      keyType: "ip",
      limit: 10,
      windowInSeconds: 60,
      strategy: "fixed",
      debug: true,
      onLimitReached: (key, req) => {
        console.log(`Rate limit exceeded for ${key}`);
      },
      onPass: (key, req) => {
        console.log(`Request allowed for ${key}`);
      },
      limiterConfig: {
        maxStoreSize: 10000,
        enablePerKeyStats: true,
      },
    })(request, reply);
  }
});

// Adaptive rate limiting based on user type
fastify.addHook("onRequest", async (request, reply) => {
  if (request.url.startsWith("/premium")) {
    return fastifyLimiter({
      keyType: "ip",
      limit: (req) => (req.headers["x-user-type"] === "premium" ? 1000 : 100),
      windowInSeconds: 60,
    })(request, reply);
  }
});

fastify.get("/", async (request, reply) => {
  return { message: "Hello World!" };
});

fastify.get("/api/data", async (request, reply) => {
  return { data: "API response" };
});

fastify.get("/user/profile", async (request, reply) => {
  return { user: "Profile data" };
});

fastify.get("/admin/dashboard", async (request, reply) => {
  return { admin: "Dashboard data" };
});

fastify.get("/premium/content", async (request, reply) => {
  return { premium: "Premium content" };
});

const start = async () => {
  try {
    await fastify.listen({ port: 3000 });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
