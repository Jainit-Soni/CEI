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

const app = express();

// CORS configuration
const isProduction = process.env.NODE_ENV === 'production';

const rawOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : [];
const normalizedOrigins = rawOrigins
  .map(o => o.trim())
  .filter(Boolean)
  .map(o => o.replace(/\/$/, ""));

const allowedOrigins = isProduction
  ? normalizedOrigins
  : ["http://localhost:3000", "http://localhost:3030", ...normalizedOrigins];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed === "*") return true;
      return allowed.toLowerCase() === origin.toLowerCase().replace(/\/$/, "");
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`CORS Reject: Origin [${origin}] not in allowed list: [${allowedOrigins.join(", ")}]`);
      // Calling callback(null, false) allows the cors middleware to handle the rejection
      // by simply not adding the Access-Control-Allow-Origin header, which is the standard behavior.
      // Throwing an Error here (as it was before) crashes the request before headers are set correctly.
      callback(null, false);
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
  credentials: true
};

// Speed Limiter (Throttling)
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 250, // allow 250 requests per 15 minutes (relaxed from 50 for smoother exploration)
  delayMs: () => 500 // begin adding 500ms of delay per request above limits
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

app.get("/", (req, res) => {
  res.send("<h1>CMAT Backend is Running</h1><p>Status: Active</p>");
});

app.use("/api", collegesRoutes);
app.use("/api", examsRoutes);
app.use("/api", searchLimiter, searchRoutes); // Stricter limit for search
app.use("/api/stats", statsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", userRoutes);

const PORT = process.env.PORT || 4000;

// Only listen if not running on Vercel (Vercel exports the app)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`CEI backend running on ${PORT}`);
  });
}

module.exports = app;
