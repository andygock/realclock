require("dotenv").config();
const express = require("express");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const path = require("path");
const { isIP } = require("node:net");
const helmet = require("helmet");
const morgan = require("morgan");

const app = express();

const parseTrustProxy = (value) => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (!normalized || normalized === "false") return false;

  // Trusting every proxy lets directly connected clients spoof X-Forwarded-For
  // and evade per-IP rate limits. Require an exact hop count or known subnet.
  if (normalized === "true") {
    throw new Error(
      "TRUST_PROXY=true is unsafe. Use a proxy hop count or explicit IP/CIDR."
    );
  }

  if (/^\d+$/.test(normalized)) return Number(normalized);

  const namedRanges = new Set(["loopback", "linklocal", "uniquelocal"]);
  const proxies = normalized
    .split(",")
    .map((proxy) => proxy.trim())
    .filter(Boolean);

  const isValidProxy = (proxy) => {
    if (namedRanges.has(proxy)) return true;

    const [address, prefix, ...extra] = proxy.split("/");
    if (extra.length > 0) return false;

    const family = isIP(address);
    if (!family) return false;
    if (prefix === undefined) return true;

    const prefixLength = Number(prefix);
    const maxPrefixLength = family === 4 ? 32 : 128;
    return (
      /^\d+$/.test(prefix) &&
      prefixLength >= 0 &&
      prefixLength <= maxPrefixLength
    );
  };

  if (proxies.length === 0 || !proxies.every(isValidProxy)) {
    throw new Error(
      "TRUST_PROXY must be a hop count or comma-separated IP/CIDR list."
    );
  }

  return proxies;
};

app.set("trust proxy", parseTrustProxy(process.env.TRUST_PROXY));

// Use Helmet for security
app.use(helmet());

// Use Morgan for logging
app.use(morgan("combined"));

// Global API rate limiter middleware
const apiGlobalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 500, // Allow 500 requests per minute across all clients
  keyGenerator: () => "global",
  message: {
    error: "Too Many Requests",
    message:
      "The server is receiving too many requests. Please try again later.",
  },
});

// Per-IP API rate limiter middleware
const apiPerIpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 50, // Allow 50 requests per minute per IP
  message: {
    error: "Too Many Requests",
    message: "You have exceeded the request limit. Please try again later.",
  },
});

// Normalize configuration so whitespace around comma-separated origins is safe.
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean)
);

if (allowedOrigins.size === 0) {
  console.warn(
    "Warning: No allowed origins specified for CORS. All origins will be blocked."
  );
}

// Serve static assets without applying API-specific CORS restrictions.
const staticPath = path.join(__dirname, "./public");
app.use(express.static(staticPath));

// Rate limiting must run before CORS so rejected origins cannot bypass it.
app.use("/api", apiGlobalLimiter);
app.use("/api", apiPerIpLimiter);

app.use(
  "/api",
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
  })
);

// Custom error handler for CORS failures
app.use((err, req, res, next) => {
  if (err.message === "Not allowed by CORS") {
    res.status(403).json({
      error: "CORS Error",
      message: "The origin is not allowed to access this resource.",
    });
  } else {
    next(err); // Pass other errors to the default error handler
  }
});

app.get("/api/time", (req, res) => {
  const now = new Date();
  const milliseconds = now.getTime();
  const datetime = now.toISOString();

  // A cached timestamp is incorrect by definition, including behind a CDN.
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.json({ milliseconds, datetime });
});

// Enhanced 404 handler for API and non-API routes
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    res.status(404).json({
      error: "Not Found",
      message: "The requested API endpoint could not be found.",
    });
  } else {
    res.status(404).send(
      `<!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>404 Not Found</title>
      </head>
      <body>
        <h1>404 Not Found</h1>
        <p>The page you are looking for does not exist.</p>
      </body>
      </html>`
    );
  }
});

// Centralized error handler for unexpected errors
app.use((err, req, res, next) => {
  console.error("Unexpected error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: "An unexpected error occurred. Please try again later.",
  });
});

// Start the server
const PORT = Number(process.env.PORT || 3007);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535.");
}

const server = app.listen(PORT, () =>
  console.log(`Server running on port ${PORT}`)
);

let shuttingDown = false;

const shutdown = (signal) => {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`${signal} received; draining HTTP connections...`);

  // Do not let a stuck keep-alive connection prevent process termination.
  const forceExitTimer = setTimeout(() => {
    console.error("Graceful shutdown timed out; forcing connections closed.");
    server.closeAllConnections?.();
    process.exit(1);
  }, 10_000);
  forceExitTimer.unref();

  server.close((error) => {
    clearTimeout(forceExitTimer);
    if (error) console.error("HTTP server shutdown failed:", error);
    process.exit(error ? 1 : 0);
  });
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
