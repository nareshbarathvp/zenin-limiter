# 🔥 ZenIn Limiter v2.0

A high-performance, memory-efficient rate limiter with built-in expiration, LRU memory management, optional per-key metrics, and flexible middleware support.

## ✨ Features

- **Multiple Strategies**: Fixed window, sliding window, and token bucket
- **Pluggable Key Extraction**: Limit by IP, user ID, API key, custom logic
- **In-Memory Store**: Super fast, designed for millions of keys
- **LRU-based Memory Capping**: Automatically cleans old keys
- **Min-heap Expiration**: Removes expired entries efficiently
- **Promise-based Locking**: Safe in async Node.js environments
- **Universal Middleware Support**: Express, Fastify, NestJS, and more
- **Optional Per-key Stats**: Track hits and rejections per identity
- **Event Hooks**: Monitor rate limiting decisions
- **Developer Experience**: Debug mode, dry run, silent mode, adaptive limits

## 🚧 Upcoming Features

- **🔥 Throttler**: Advanced request throttling with burst control and smooth traffic shaping
- **🌐 Redis Store**: Distributed rate limiting with Redis backend
- **📊 Advanced Analytics**: Detailed metrics and monitoring dashboard
- **🔐 Authentication Integration**: Built-in support for JWT, OAuth, and custom auth
- **⚡ Edge Computing**: Cloudflare Workers and Vercel Edge Runtime support

## 📦 Installation

```bash
npm install zenin-limiter
```

## 🚀 Quick Start

### Express.js

```typescript
import express from "express";
import { expressLimiter } from "zenin-limiter";

const app = express();

// Basic IP-based rate limiting
app.use(
  expressLimiter({
    keyType: "ip",
    limit: 100,
    windowInSeconds: 60,
  })
);

app.get("/", (req, res) => {
  res.json({ message: "Hello World!" });
});
```

### Fastify

```typescript
import Fastify from "fastify";
import { fastifyLimiter } from "zenin-limiter";

const fastify = Fastify();

fastify.addHook(
  "onRequest",
  fastifyLimiter({
    keyType: "ip",
    limit: 100,
    windowInSeconds: 60,
  })
);

fastify.get("/", async (request, reply) => {
  return { message: "Hello World!" };
});
```

### NestJS

```typescript
import { Module } from "@nestjs/common";
import { RateLimitModule, NestLimiterGuard } from "zenin-limiter";

@Module({
  imports: [RateLimitModule],
  providers: [
    {
      provide: "APP_GUARD",
      useClass: NestLimiterGuard,
    },
  ],
})
export class AppModule {}
```

## 🎯 Rate Limiting Strategies

| Strategy           | Description                                          | Use Case                              |
| ------------------ | ---------------------------------------------------- | ------------------------------------- |
| **Fixed Window**   | Simple time-window based limiting                    | Basic rate limiting, simple use cases |
| **Sliding Window** | Accurate per-window limiting with timestamp tracking | Precise rate limiting, API protection |
| **Token Bucket**   | Smooth burst control with steady refill rate         | Smooth traffic, burst handling        |

### Strategy Comparison

```typescript
// Fixed Window (default) - Simple but less accurate
const fixedLimiter = new RateLimiter({
  limit: 100,
  windowInSeconds: 60,
  strategy: "fixed",
});

// Sliding Window - More accurate per window
const slidingLimiter = new RateLimiter({
  limit: 100,
  windowInSeconds: 60,
  strategy: "sliding",
});

// Token Bucket - Smooth burst control
const tokenBucketLimiter = new RateLimiter({
  limit: 100,
  windowInSeconds: 60,
  strategy: "tokenBucket",
});
```

## 🔑 Key Generation

### Built-in Key Types

```typescript
// IP-based limiting
expressLimiter({ keyType: "ip" });

// User agent-based limiting
expressLimiter({ keyType: "user-agent" });

// Header-based limiting
expressLimiter({ keyType: "header:X-API-KEY" });

// Path-based limiting
expressLimiter({ keyType: "path" });
```

### Custom Key Generator

```typescript
expressLimiter({
  customKeyGenerator: (req) => req.headers["x-user-id"] || "anonymous",
  limit: 50,
  windowInSeconds: 300,
});
```

## 🎛️ Advanced Configuration

### Event Hooks

```typescript
expressLimiter({
  keyType: "ip",
  limit: 100,
  windowInSeconds: 60,
  onLimitReached: (key, req) => {
    console.log(`Rate limit exceeded for ${key}`);
    // Send alert, log to monitoring service, etc.
  },
  onPass: (key, req) => {
    console.log(`Request allowed for ${key}`);
  },
  onError: (error) => {
    console.error("Rate limiter error:", error);
  },
});
```

### Debug Mode

```typescript
expressLimiter({
  keyType: "ip",
  limit: 100,
  windowInSeconds: 60,
  debug: true, // Logs all rate limiting decisions
});
```

### Dry Run Mode

```typescript
expressLimiter({
  keyType: "ip",
  limit: 100,
  windowInSeconds: 60,
  dryRun: true, // Simulates rate limiting without blocking
});
```

### Silent Mode

```typescript
expressLimiter({
  keyType: "ip",
  limit: 100,
  windowInSeconds: 60,
  silent: true, // Logs decisions but doesn't block requests
});
```

### Adaptive Limits

```typescript
expressLimiter({
  keyType: "ip",
  limit: (req) => (req.headers["x-user-type"] === "premium" ? 1000 : 100),
  windowInSeconds: 60,
});
```

### Memory Configuration

```typescript
expressLimiter({
  keyType: "ip",
  limit: 100,
  windowInSeconds: 60,
  limiterConfig: {
    maxStoreSize: 100000, // Max number of keys
    cleanupInterval: 500, // Calls between cleanups
    enablePerKeyStats: true, // Track per-key metrics
    maxBatchCleanup: 500, // Max keys to clean per batch
  },
});
```

## 📊 Monitoring & Statistics

### Get Rate Limiter Stats

```typescript
import { RateLimiter } from "zenin-limiter";

const limiter = new RateLimiter({
  limit: 100,
  windowInSeconds: 60,
});

// Make some requests
await limiter.isAllowed("user1");
await limiter.isAllowed("user2");

// Get statistics
const stats = limiter.getStats();
console.log(stats);
// {
//   totalRequests: 2,
//   hits: 2,
//   rejections: 0,
//   activeKeys: 2
// }
```

### Per-key State

```typescript
const state = await limiter.getState("user1");
console.log(state);
// {
//   remaining: 99,
//   resetAt: 1640995200000,
//   limit: 100
// }
```

## 🏗️ Framework Integration

### Express.js

```typescript
import express from "express";
import { expressLimiter } from "zenin-limiter";

const app = express();

// Global rate limiting
app.use(
  expressLimiter({
    keyType: "ip",
    limit: 100,
    windowInSeconds: 60,
  })
);

// Route-specific rate limiting
app.use(
  "/api",
  expressLimiter({
    keyType: "header:X-API-KEY",
    limit: 1000,
    windowInSeconds: 3600,
    strategy: "sliding",
  })
);

// Custom key generator
app.use(
  "/user",
  expressLimiter({
    customKeyGenerator: (req) => req.headers["x-user-id"] || "anonymous",
    limit: 50,
    windowInSeconds: 300,
  })
);
```

### Fastify

```typescript
import Fastify from "fastify";
import { fastifyLimiter } from "zenin-limiter";

const fastify = Fastify();

fastify.addHook(
  "onRequest",
  fastifyLimiter({
    keyType: "ip",
    limit: 100,
    windowInSeconds: 60,
  })
);

// Route-specific limiting
fastify.addHook("onRequest", async (request, reply) => {
  if (request.url.startsWith("/api")) {
    return fastifyLimiter({
      keyType: "header:X-API-KEY",
      limit: 1000,
      windowInSeconds: 3600,
    })(request, reply);
  }
});
```

### NestJS

```typescript
import { Module, Controller, Get, UseGuards } from "@nestjs/common";
import { RateLimit, NestLimiterGuard } from "zenin-limiter";

@Controller("api")
export class ApiController {
  @Get()
  @RateLimit({
    keyType: "ip",
    limit: 100,
    windowInSeconds: 60,
  })
  getData() {
    return { message: "Hello World!" };
  }

  @Get("premium")
  @RateLimit({
    keyType: "ip",
    limit: (req) => (req.headers["x-user-type"] === "premium" ? 1000 : 100),
    windowInSeconds: 60,
  })
  getPremiumData() {
    return { message: "Premium content!" };
  }
}

@Module({
  controllers: [ApiController],
  providers: [
    {
      provide: "APP_GUARD",
      useClass: NestLimiterGuard,
    },
  ],
})
export class AppModule {}
```

### Raw Node.js

```typescript
import { RateLimiter } from "zenin-limiter";

const limiter = new RateLimiter({
  limit: 100,
  windowInSeconds: 60,
  strategy: "sliding",
});

// Check if request is allowed
const allowed = await limiter.isAllowed("user123");
if (!allowed) {
  // Handle rate limit exceeded
  return res.status(429).json({ error: "Too many requests" });
}

// Get current state
const state = await limiter.getState("user123");
console.log(`Remaining requests: ${state.remaining}`);

// Reset rate limit for a user
await limiter.reset("user123");
```

## 🔧 Configuration Options

### LimiterConfig

```typescript
interface LimiterConfig {
  // Key generation
  keyType?: "ip" | "user-agent" | "header:X-API-KEY" | "path" | "custom";
  headerName?: string;
  customKeyGenerator?: (req: any) => string;

  // Rate limiting
  limit?: number | ((req: any) => number);
  windowInSeconds?: number;
  strategy?: "fixed" | "sliding" | "tokenBucket";

  // Event hooks
  onLimitReached?: (key: string, req?: any) => void;
  onReset?: (key: string) => void;
  onPass?: (key: string, req?: any) => void;
  onError?: (error: Error) => void;

  // Debugging
  debug?: boolean;
  dryRun?: boolean;
  silent?: boolean;

  // Memory management
  limiterConfig?: {
    maxStoreSize?: number;
    cleanupInterval?: number;
    enablePerKeyStats?: boolean;
    maxBatchCleanup?: number;
  };
}
```

## 📈 Performance

### Benchmarks

- **Fixed Window**: ~100ms for 10,000 requests
- **Sliding Window**: ~30ms for 10,000 requests
- **Token Bucket**: ~20ms for 10,000 requests
- **Memory Usage**: Efficient cleanup with LRU eviction
- **Concurrent Safety**: Thread-safe with promise-based locking

### Memory Management

- **Automatic Cleanup**: Expired entries are removed automatically
- **LRU Eviction**: Least recently used keys are removed when memory cap is reached
- **Configurable Limits**: Set maximum number of keys and cleanup intervals
- **Background GC**: Periodic cleanup every 30 seconds

## 🛠️ Development

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

### Development Mode

```bash
npm run dev
```

## 📝 Examples

See the `/examples` directory for complete examples:

- `express-basic.ts` - Express.js integration
- `fastify-basic.ts` - Fastify integration
- `nestjs-basic.ts` - NestJS integration
- `raw-node.ts` - Raw Node.js usage

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License - see the [LICENSE](./LICENSE) file for details.

## 👨‍💻 Author

Made with ❤️ by Naresh Barath VP – [@nareshbarathvp](https://github.com/nareshbarathvp)
