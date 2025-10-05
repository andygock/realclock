require("dotenv").config();
const express = require("express");
const rateLimit = require("express-rate-limit");
const cors = require("cors");
const path = require("path");

const app = express();

// Rate limiter middleware
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // limit each IP to 30 requests per minute
});

// Apply rate limiter to all requests
app.use(limiter);

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

// Endpoint to return current milliseconds past Unix epoch and datetime in UTC with milliseconds
app.get("/api/time", (req, res) => {
  const now = new Date();
  const milliseconds = now.getTime();
  const datetime = now.toISOString();
  res.json({ milliseconds, datetime });
});

// Start the server
const PORT = process.env.PORT || 3007;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
