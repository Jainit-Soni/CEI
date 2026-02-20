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
const adminRoutes = require("./routes/admin"); // Import admin routes
const userRoutes = require("./routes/user");
const activityRoutes = require("./routes/activity");
const scholarshipRoutes = require("./routes/scholarships");
const newsRoutes = require("./routes/news");
const hypeRoutes = require("./routes/hype");
const predictorRoutes = require("./routes/predictor");

const app = express();


// Security & Infrastructure Middleware
app.use(helmet()); // Secure HTTP headers
app.use(compression()); // Enable gzip compression

// CORS configuration
const isProduction = process.env.NODE_ENV === 'production';

const rawOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : [];
const normalizedOrigins = rawOrigins
  .map(o => o.trim())
  .filter(Boolean)
  .map(o => o.replace(/\/$/, ""));

const allowedOrigins = isProduction
  ? normalizedOrigins
  : ["http://localhost:3030", ...normalizedOrigins];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Fail-safe: Always allow Vercel origins to prevent deployment blocking
    const isVercel = origin.endsWith(".vercel.app") || origin.includes("--ce-intelligence-");

    if (isVercel) {
      return callback(null, true);
    }

    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed === "*") return true;
      const normalizedQuery = origin.toLowerCase().replace(/\/$/, "");
      const normalizedAllowed = allowed.toLowerCase().replace(/\/$/, "");
      return normalizedAllowed === normalizedQuery;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`CORS Reject: Origin [${origin}] not in allowed list`);
      // For local development or non-critical errors, we might want to be more lenient
      // but strictly following the current logic:
      callback(null, false);
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
  credentials: true
};

// Apply CORS early to avoid "CORS masking" of other errors (429s, etc)
app.use(cors(corsOptions));
app.use(express.json());

// Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Relaxed from 100 for production deployment testing
  standardHeaders: true,
  legacyHeaders: false,
});
app.use("/api", globalLimiter);

// Speed Limiter (Throttling)
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 250, // allow 250 requests per 15 minutes (relaxed from 50 for smoother exploration)
  delayMs: () => 500 // begin adding 500ms of delay per request above limits
});

// Rate limiting configuration
const standardLimiter = rateLimit({
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

// Domain Logic Middleware
app.use(apiKeyAuth);   // Check for API Key first
app.use(speedLimiter); // Then throttle
app.use(standardLimiter);      // Then IP rate limit (if no key)

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.get("/", (req, res) => {
  res.send("<h1>CMAT Backend is Running</h1><p>Status: Active</p>");
});

app.use("/api", collegesRoutes);
app.use("/api", examsRoutes);
app.use("/api", searchLimiter, searchRoutes); // Stricter limit for search
app.use("/api/stats", statsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/scholarships", scholarshipRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/hype", hypeRoutes);
app.use("/api/predict", predictorRoutes);
app.use("/api", userRoutes);

const PORT = process.env.PORT || 4000;

// Only listen if not running on Vercel (Vercel exports the app)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`CEI backend running on ${PORT}`);
  });
}

module.exports = app;
