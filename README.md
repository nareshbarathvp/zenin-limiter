# 🔥 ZenIn Limiter

A high-performance, memory-efficient rate limiter with built-in expiration, LRU memory management, optional per-key metrics, and flexible middleware support.

---

## ✨ Features

- **Pluggable key extractor** — limit by IP, user ID, API key, etc.
- **In-memory store** — super fast, designed for millions of keys
- **LRU-based memory capping** — automatically cleans old keys
- **Min-heap expiration** — removes expired entries efficiently
- **Promise-based locking** — safe in async Node.js environments
- **Universal middleware support** — Express, Fastify, NestJS, etc.
- **Optional per-key stats** — track hits and rejections per identity

---

## 🚀 Coming Soon: Request Throttler

We're working on adding **advanced throttling** support to `zenin-limiter` for even greater control over your traffic:

### 🔜 Throttling Support (Next Release)

- ✅ **Custom Throttler Middleware**

  - Fine-grained control over burst and steady request rates
  - Supports advanced strategies like token bucket / leaky bucket

- 🔧 **Express Throttler**

  - Seamless integration with Express using middleware
  - Configure burst and steady rate limits per IP or custom key

- ⚡️ **Fastify Throttler**

  - Fastify-compatible hook-based throttling
  - Easy to plug into any route or global scope

- 🧱 **NestJS Guard-Based Throttler**

  - Guard-style decorator for NestJS routes and controllers
  - Full control with DI and metadata support

- 🛠 **Universal Throttler Handler**
  - Works with any custom framework or HTTP implementation
  - Use it in microservices, CLI servers, or raw Node apps

### 🎯 Use Cases

- Burst traffic protection
- Smoother user experience vs hard rate limits
- Customizable throttling strategies for API consumers

---

## 📦 Installation

```bash
npm install zenin-limiter
```

---

## 🧠 How It Works

1. The `LimiterConfig` defines how the limiter behaves.
2. You provide a `key()` extractor — based on request IP, user, etc.
3. You call `isAllowedMemory()` with this key to determine access.
4. The limiter auto-cleans expired keys and trims memory via LRU.

---

## 🧩 Usage Examples

### 1. **Express Middleware**

```ts
import express from "express";
import { expressLimiter } from "zenin-limiter/middlewares/express";

const app = express();

app.use(
  expressLimiter({
    key: (req) => req.ip,
    limit: 5,
    windowInSeconds: 60,
    limiterConfig: { enablePerKeyStats: true },
  })
);

app.get("/", (req, res) => {
  res.send("Hello, world!");
});
```

---

### 2. **Fastify Middleware**

```ts
import Fastify from "fastify";
import { fastifyLimiter } from "zenin-limiter/middlewares/fastify";

const fastify = Fastify();

fastify.addHook(
  "onRequest",
  fastifyLimiter({
    key: (req) => req.ip,
    limit: 10,
    windowInSeconds: 60,
    limiterConfig: { enablePerKeyStats: true },
  })
);
```

---

### 3. **NestJS Middleware**

```ts
// app.module.ts
import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { NestLimiterMiddleware } from "zenin-limiter/middlewares/nest";

@Module({
  imports: [],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useValue: new NestLimiterGuard({
        key: (req) => req.ip || "nest-ip",
        limit: 5,
        windowInSeconds: 60,
        limiterConfig: {
          // You can pass additional config here
        },
      }),
    },
  ],
})
export class AppModule {}
```

---

### 4. **Universal Limiter (Express or Fastify)**

```ts
import { universalLimiter } from "zenin-limiter/middlewares/universal";

app.use(
  universalLimiter({
    key: (req) => req.headers["x-api-key"] || "__anon__",
    limit: 15,
    windowInSeconds: 30,
    limiterConfig: {},
  })
);
```

---

## ⚙️ Types

### `LimiterConfig`

```ts
interface LimiterConfig {
  key: (context: any) => string;
  limit: number;
  windowInSeconds: number;
  limiterConfig?: RateLimiterConfig;
}
```

### `RateLimiterConfig`

```ts
interface RateLimiterConfig {
  maxStoreSize?: number; // Default: 1,000,000
  cleanupInterval?: number; // Default: 1000 calls
  enablePerKeyStats?: boolean; // Default: false
  maxBatchCleanup?: number; // Default: 1000
}
```

---

## 👨‍💻 Author

Made with ❤️ by Naresh Barath VP – [@nareshbarathvp](https://github.com/nareshbarathvp)

## License

This project is licensed under the ISC License - see the [LICENSE](./LICENSE) file for details.
