import express from "express";
import { expressLimiter, LimiterConfig } from "zenin-limiter";

const app = express();

// Basic IP-based rate limiting
app.use(
  expressLimiter({
    keyType: "ip",
    limit: 100,
    windowInSeconds: 60,
  })
);

// Header-based rate limiting for API keys
app.use(
  "/api",
  expressLimiter({
    keyType: "header:X-API-KEY",
    limit: 1000,
    windowInSeconds: 3600, // 1 hour
    strategy: "sliding",
  })
);

// Custom key generator for user-based limiting
app.use(
  "/user",
  expressLimiter({
    customKeyGenerator: (req) => req.headers["x-user-id"] || "anonymous",
    limit: 50,
    windowInSeconds: 300, // 5 minutes
    strategy: "tokenBucket",
  })
);

// Advanced configuration with hooks and debugging
app.use(
  "/admin",
  expressLimiter({
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
  })
);

// Adaptive rate limiting based on user type
app.use(
  "/premium",
  expressLimiter({
    keyType: "ip",
    limit: (req: any) =>
      req.headers["x-user-type"] === "premium" ? 1000 : 100,
    windowInSeconds: 60,
  })
);

app.get("/", (req, res) => {
  res.json({ message: "Hello World!" });
});

app.get("/api/data", (req, res) => {
  res.json({ data: "API response" });
});

app.get("/user/profile", (req, res) => {
  res.json({ user: "Profile data" });
});

app.get("/admin/dashboard", (req, res) => {
  res.json({ admin: "Dashboard data" });
});

app.get("/premium/content", (req, res) => {
  res.json({ premium: "Premium content" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
