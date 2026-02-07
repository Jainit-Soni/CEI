const express = require("express");
const cors = require("cors");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const slowDown = require("express-slow-down");
const helmet = require("helmet");
const apiKeyAuth = require("./middleware/apiKeys");
const collegesRoutes = require("./routes/colleges");
const examsRoutes = require("./routes/exams");
const searchRoutes = require("./routes/search");
const statsRoutes = require("./routes/stats");

const app = express();

// CORS configuration for production
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3030",
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : [])
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1 || allowedOrigins.includes("*")) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
  credentials: true
};

// Speed Limiter (Throttling)
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 50, // allow 50 requests per 15 minutes, then...
  delayMs: 500 // begin adding 500ms of delay per request above 100
});

// Rate limiting configuration
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => !!req.apiKey // Skip IP limit if valid API key present
});

// Stricter rate limit for search endpoints
const searchLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: "Too many search requests, please slow down.",
  skip: (req) => !!req.apiKey // Skip if valid API key present
});

// Middleware
app.use(helmet()); // Secure HTTP headers
app.use(compression()); // Enable gzip compression
app.use(cors(corsOptions));
app.use(express.json());
app.use(apiKeyAuth);   // Check for API Key first
app.use(speedLimiter); // Then throttle
app.use(limiter);      // Then IP rate limit (if no key)

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.use("/api", collegesRoutes);
app.use("/api", examsRoutes);
app.use("/api", searchLimiter, searchRoutes); // Stricter limit for search
app.use("/api/stats", statsRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`CEI backend running on ${PORT}`);
});
