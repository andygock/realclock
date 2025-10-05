require("dotenv").config();
const express = require("express");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const path = require("path");
const helmet = require("helmet");
const morgan = require("morgan");

const app = express();

// Global rate limiter middleware
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 1000, // Allow 1000 requests per minute globally
  message: {
    error: "Too Many Requests",
    message:
      "The server is receiving too many requests. Please try again later.",
  },
});

// Per-IP rate limiter middleware
const perIpLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // Allow 100 requests per minute per IP
  message: {
    error: "Too Many Requests",
    message: "You have exceeded the request limit. Please try again later.",
  },
});

// CORS middleware to allow only specific domains to access the time server
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",");

if (
  allowedOrigins.length === 0 ||
  (allowedOrigins.length === 1 && allowedOrigins[0] === "")
) {
  console.warn(
    "Warning: No allowed origins specified for CORS. All origins will be blocked."
  );
}

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps, curl, etc.)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(null, false); // Let the error handler handle the response
      }
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

// Serve static files from the realclock directory
const staticPath = path.join(__dirname, "./public");
app.use(express.static(staticPath));

// Apply global rate limiter to all routes
app.use(globalLimiter);

// Apply per-IP rate limiter only to the /api/time endpoint
app.get("/api/time", perIpLimiter, (req, res) => {
  const now = new Date();
  const milliseconds = now.getTime();
  const datetime = now.toISOString();
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

// Use Helmet for security
app.use(helmet());

// Use Morgan for logging
app.use(morgan("combined"));

// Validate required environment variables
if (!process.env.PORT) {
  console.error("Error: PORT environment variable is not set.");
  process.exit(1);
}

// Centralized error handler for unexpected errors
app.use((err, req, res, next) => {
  console.error("Unexpected error:", err);
  res.status(500).json({
    error: "Internal Server Error",
    message: "An unexpected error occurred. Please try again later.",
  });
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("Shutting down server...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Shutting down server...");
  process.exit(0);
});

// Start the server
const PORT = process.env.PORT || 3007;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
