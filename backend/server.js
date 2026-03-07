require('dotenv').config({ path: require('path').resolve(__dirname, '.env.local') });

// ── 1. Lock Environment Validation at Startup ─────────────────────────────
const requiredEnv = [
  "JWT_SECRET",
  "BACKUP_ENCRYPTION_KEY",
  "MONGODB_URI",
  "REDIS_URL",
  "FIREBASE_SERVICE_ACCOUNT_KEY"
];

const missingEnv = requiredEnv.filter(key => !process.env[key]);
const isMaintenanceMode = missingEnv.length > 0;

if (isMaintenanceMode) {
  console.error("⚠️  MAINTENANCE MODE: Missing required environment variables:", missingEnv.join(", "));
}
// ──────────────────────────────────────────────────────────────────────────

const express = require("express");
const cors = require("cors");
const compression = require("compression");
const helmet = require("helmet");
const morgan = require("morgan");
const { rateLimit } = require("express-rate-limit");
const apiKeyAuth = require("./middleware/apiKeys");
const requestLogger = require("./middleware/requestLogger");
const { honeypotMiddleware, honeypotBlockCheck } = require("./middleware/honeypot");
const collegesRoutes = require("./routes/colleges");
const examsRoutes = require("./routes/exams");
const searchRoutes = require("./routes/search");
const statsRoutes = require("./routes/stats");
const adminRoutes = require("./routes/admin");
const userRoutes = require("./routes/user");
const activityRoutes = require("./routes/activity");
const scholarshipRoutes = require("./routes/scholarships");
const newsRoutes = require("./routes/news");
const hypeRoutes = require("./routes/hype");
const predictorRoutes = require("./routes/predictor");
const authRoutes = require("./routes/auth");
const transparencyRoutes = require("./routes/transparency");
const governanceRoutes = require("./routes/governance");
const explainRoutes = require("./routes/explain");
const verificationRoutes = require("./routes/verification");
const adminAuthRoutes = require("./routes/adminAuth");
const reviewsRoutes = require("./routes/reviews");
const connectDB = require("./config/db");
const { getRedisClient } = require("./config/redis");
const logger = require("./lib/logger");
const scheduler = require("./lib/scheduler");

// ── Sentry Backend Error Monitoring ──────────────────────────────────────────
let Sentry = null;
if (process.env.SENTRY_DSN) {
  try {
    Sentry = require("@sentry/node");
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || "production",
      tracesSampleRate: 0.2, // 20% of transactions for performance tracing
    });
    console.log("✅ Sentry backend monitoring active");
  } catch (e) {
    console.warn("⚠️  Sentry failed to initialize:", e.message);
    Sentry = null;
  }
}

const app = express();

// ==========================================
// 🌐 CORS CONFIGURATION (MUST BE FIRST)
// ==========================================
const rawOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : [];
const normalizedOrigins = rawOrigins
  .map(o => o.trim())
  .filter(Boolean)
  .map(o => o.replace(/\/$/, ""));

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3030",
  "https://ce-intelligence-eight.vercel.app",   // Current production domain
  "https://ce-intelligence.vercel.app",         // Alternate production domain
  ...normalizedOrigins
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const isTrustedVercelPreview = /^https:\/\/ce-intelligence-[a-z0-9-]+-jainit-sonis-projects\.vercel\.app$/.test(origin);
    if (isTrustedVercelPreview) return callback(null, true);

    const normalizedOrigin = origin.toLowerCase().replace(/\/$/, "");
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed === "*") return true;
      return allowed.toLowerCase().replace(/\/$/, "") === normalizedOrigin;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`[CORS] Rejected origin: ${origin} (Normalized: ${normalizedOrigin})`);
      callback(null, false);
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key", "X-API-Key", "Accept", "X-Requested-With", "X-Firebase-AppCheck"],
  credentials: true
};

app.use(cors(corsOptions));

// ==========================================
// 🛣️ URL NORMALIZATION MIDDLEWARE
// ==========================================
app.use((req, res, next) => {
  if (req.url.includes("//")) {
    req.url = req.url.replace(/\/+/g, "/");
  }
  next();
});

// ==========================================
// 🚨 DIAGNOSTIC MAINTENANCE MIDDLEWARE
// ==========================================
app.use((req, res, next) => {
  if (isMaintenanceMode) {
    return res.status(503).json({
      error: "Service Temporarily Unavailable (Missing Configuration)",
      diagnostic: {
        missingEnvironmentVariables: missingEnv,
        actionRequired: "Please add these variables to your Vercel Project Settings."
      }
    });
  }
  next();
});

// Connect to MongoDB & Start Services
if (process.env.NODE_ENV !== 'test' && !isMaintenanceMode) {
  connectDB();
  if (!process.env.VERCEL) {
    scheduler.start();
  }
}

// ==========================================
// 🛡️ SECURITY & INFRASTRUCTURE MIDDLEWARE
// ==========================================
app.set("trust proxy", 1); // Trust Vercel's reverse proxy for accurate client IP detection
app.use(helmet());          // Secure HTTP headers against common web vulnerabilities
app.use(compression());     // Enable gzip compression to reduce payload sizes

// ── Morgan HTTP Request Logging ───────────────────────────────────────────────
// Logs every request: method, URL, status, latency, user-agent.
// Helps track API abuse, slow routes, and traffic spikes in Vercel logs.
app.use(morgan("combined"));

app.use(express.json({ limit: "1mb" })); // Limit body size to prevent memory attacks

// ==========================================
// 🚦 IP-BASED RATE LIMITING (Anonymous)
// Applied before API key auth to throttle unauthenticated scrapers/DDoS
// ==========================================
const anonymousLimiter = rateLimit({
  windowMs: 60 * 1000,      // 1 minute window
  max: 60,                   // 60 requests per minute per IP
  standardHeaders: true,     // Return standard RateLimit-* headers
  legacyHeaders: false,
  message: { error: "Too many requests from this IP, please try again in a minute." },
  skip: (req) => !!req.header("X-API-Key") // Skip if API key is present (handled separately)
});

app.use(anonymousLimiter);

// ==========================================
// 🔍 REQUEST TRACING (UUID per request)
// ==========================================
app.use(requestLogger);

// ==========================================
// 🍯 HONEYPOT BLOCK CHECK (before all routes)
// ==========================================
app.use(honeypotBlockCheck);

// ==========================================
// 🔑  API KEY AUTHENTICATION
// ==========================================
app.use(apiKeyAuth); // Per-key rate limiting on top of IP limiting

// ==========================================
// 🏥 HEALTH CHECK — enriched status
// ==========================================
app.get("/api/health", async (req, res) => {
  const { getRedisStatus } = require("./services/dataStore");
  const cacheStatus = await getRedisStatus().catch(() => ({ status: "error" }));
  res.json({
    status: "ok",
    time: new Date().toISOString(),
    cache: cacheStatus
  });
});

app.get("/", (req, res) => {
  res.send("<h1>CEI Backend</h1><p>Status: Active</p>");
});

// ==========================================
// 🚀 APPLICATION ROUTES
// ==========================================
app.use("/api", collegesRoutes);
app.use("/api", examsRoutes);
app.use("/api", searchRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/activity", activityRoutes);
app.use("/api/scholarships", scholarshipRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/hype", hypeRoutes);
app.use("/api/predict", predictorRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/transparency", transparencyRoutes);
app.use("/api/governance", governanceRoutes);
app.use("/api/explain", explainRoutes);
app.use("/api/verification", verificationRoutes);
app.use("/api/admin-auth", adminAuthRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/forecast", require("./routes/forecast"));
app.use("/api/simulator", require("./routes/simulator"));
app.use("/api/decision", require("./routes/decision"));
app.use("/api/v1", require("./routes/publicApi"));
app.use("/api/verify", require("./routes/verify"));
app.use("/api/evidence", require("./routes/evidence"));
// ── Phase XVI — National Data Truth Engine ────────────────────────────────
app.use("/api/verified", require("./routes/verifiedData"));
app.use("/api/placement-reality", require("./routes/placementReality"));
app.use("/api/trust", require("./routes/trust"));
app.use("/api", userRoutes);

// ==========================================
// 🍯 HONEYPOT TRAP ROUTES (last, after real routes)
// ==========================================
app.use(honeypotMiddleware);

// ==========================================
// ❌ GLOBAL ERROR HANDLER
// ==========================================
app.use((err, req, res, next) => {
  console.error("[Global Error]", err.message, err.stack);
  res.status(err.status || 500).json({ error: err.message || "Internal server error" });
});

const PORT = process.env.PORT || 4000;

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`CEI backend running on port ${PORT}`);
  });
}

module.exports = app;
