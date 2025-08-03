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

### 3. **NestJS Middleware(`Comming soon`)**

```ts
// app.module.ts
import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { NestLimiterMiddleware } from "zenin-limiter/middlewares/nest";

@Module({})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(
        new NestLimiterMiddleware({
          key: (req) => req.ip,
          limit: 20,
          windowInSeconds: 60,
          limiterConfig: { enablePerKeyStats: true },
        })
      )
      .forRoutes("*");
  }
}
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

## ⚙️ API

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

Made with ❤️ by Naresh Barath VP – [@nareshbarath](https://github.com/nareshbarath)
