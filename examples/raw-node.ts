import { RateLimiter } from "zenin-limiter";
import { createServer, IncomingMessage, ServerResponse } from "http";

// Create rate limiter instances for different use cases
const ipLimiter = new RateLimiter({
  limit: 100,
  windowInSeconds: 60,
  strategy: "sliding",
});

const apiKeyLimiter = new RateLimiter({
  limit: 1000,
  windowInSeconds: 3600, // 1 hour
  strategy: "tokenBucket",
});

const userLimiter = new RateLimiter({
  limit: 50,
  windowInSeconds: 300, // 5 minutes
  strategy: "fixed",
});

// Helper function to get client IP
function getClientIP(req: IncomingMessage): string {
  return req.socket.remoteAddress || "unknown";
}

// Helper function to get API key from headers
function getApiKey(req: IncomingMessage): string {
  return (req.headers["x-api-key"] as string) || "anonymous";
}

// Helper function to get user ID from headers
function getUserId(req: IncomingMessage): string {
  return (req.headers["x-user-id"] as string) || "anonymous";
}

// Create HTTP server
const server = createServer(
  async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = req.url || "/";
      const method = req.method || "GET";

      // Set CORS headers
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Content-Type, X-API-KEY, X-USER-ID"
      );

      // Handle preflight requests
      if (method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
      }

      // Rate limiting based on route
      let allowed = true;
      let limiterKey = "";

      if (url.startsWith("/api/")) {
        // API routes - use API key limiting
        limiterKey = getApiKey(req);
        allowed = await apiKeyLimiter.isAllowed(limiterKey, req);
      } else if (url.startsWith("/user/")) {
        // User routes - use user ID limiting
        limiterKey = getUserId(req);
        allowed = await userLimiter.isAllowed(limiterKey, req);
      } else {
        // General routes - use IP limiting
        limiterKey = getClientIP(req);
        allowed = await ipLimiter.isAllowed(limiterKey, req);
      }

      if (!allowed) {
        res.writeHead(429, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            error: "Too many requests",
            retryAfter: 60,
          })
        );
        return;
      }

      // Route handling
      if (url === "/") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ message: "Hello World!" }));
      } else if (url.startsWith("/api/data")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ data: "API response" }));
      } else if (url.startsWith("/user/profile")) {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ user: "Profile data" }));
      } else {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Not found" }));
      }
    } catch (error) {
      console.error("Server error:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  }
);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
