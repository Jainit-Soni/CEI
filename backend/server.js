require('dotenv').config({ path: require('path').resolve(__dirname, '.env.local') });

// --- 1. Lock Environment Validation at Startup ---
// Only strictly blockade the core system if DB or JWT is missing.
// Firebase and Backup keys are handled gracefully by individual routes.
const requiredEnv = [
  "JWT_SECRET"
];

const missingEnv = requiredEnv.filter(key => !process.env[key]);
const isMaintenanceMode = missingEnv.length > 0;

if (isMaintenanceMode) {
  console.error("⚠️  MAINTENANCE MODE: Missing required environment variables:", missingEnv);
} else {
  console.log("✅ All required environment variables present:", requiredEnv);
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
const connectDB = require("./config/db"); // Enabled for Production Database
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
// Robust environment variable parsing: Strip quotes, split, trim, and normalize slashes
const rawOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.replace(/['"]+/g, '').split(",") : [];
const normalizedOrigins = rawOrigins
  .map(o => o.trim().toLowerCase().replace(/\/$/, ""))
  .filter(Boolean);

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

    const normalizedOrigin = origin.toLowerCase().replace(/\/$/, "");
    const isAllowed = allowedOrigins.some(allowed => allowed === normalizedOrigin);

    if (isAllowed) {
      callback(null, true);
    } else {
      // Diagnostic logging for Production debugging without exposing sensitive data
      console.warn(`[CORS] Access Denied: Origin "${origin}" is not in the authorized whitelist.`);
      console.debug(`[CORS] Normalized: "${normalizedOrigin}" | Allowed Count: ${allowedOrigins.length}`);
      callback(null, false);
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key", "X-API-Key", "Accept", "X-Requested-With", "X-Firebase-AppCheck"],
  credentials: true
};

app.use(cors(corsOptions));
// Handle preflight requests for all routes explicitly
app.options('*', cors(corsOptions));

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

// ==========================================
// 📦 WAIT FOR IN-MEMORY NDJSON DATASTORE
// ==========================================
app.use(async (req, res, next) => {
  if (req.path === '/api/health') return next(); // Let health check through immediately
  const dataStore = require("./lib/dataStore");
  try {
    if (!global.dbReady) {
      await dataStore.ready;
    }
    next();
  } catch (err) {
    console.error("[DataStore] Readiness error:", err);
    res.status(500).json({ error: "Internal Server Error: Dataset unavailable" });
  }
});

// Connect to MongoDB & Start Services
if (process.env.NODE_ENV !== 'test' && !isMaintenanceMode) {
  connectDB(); // Re-activate Mongoose connection
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
  validate: false,           // Disable all validations for local/dev environments
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
    database: {
      status: "disconnected", // MongoDB replaced with in-memory NDJSON
      state: 0,
      host: "local-ndjson",
      name: "file-system"
    },
    cache: cacheStatus
  });
});

app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>CEI Core Intelligence Engine</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
          color: white;
          overflow: hidden;
        }
        .container {
          text-align: center;
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          padding: 3rem 4rem;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.1);
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
          animation: float 6s ease-in-out infinite;
        }
        h1 {
          font-size: 2.5rem;
          margin-bottom: 0.5rem;
          background: linear-gradient(to right, #818cf8, #c084fc);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        .status {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 1.1rem;
          font-weight: 500;
          color: #a7f3d0;
          background: rgba(16, 185, 129, 0.1);
          padding: 8px 16px;
          border-radius: 9999px;
          border: 1px solid rgba(16, 185, 129, 0.2);
          margin-top: 1rem;
        }
        .status-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background-color: #10b981;
          box-shadow: 0 0 10px #10b981, 0 0 20px #10b981;
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .version {
          margin-top: 2rem;
          font-size: 0.85rem;
          color: #94a3b8;
          letter-spacing: 0.05em;
        }
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
          100% { transform: translateY(0px); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: .5; }
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>CEI Core Intelligence Engine</h1>
        <div class="status">
          <div class="status-dot"></div>
          Backend Services Active & Secure
        </div>
        <div class="version">VERSION 1.0.0 | ENVIRONMENT: ${process.env.NODE_ENV || 'development'}</div>
      </div>
    </body>
    </html>
  `);
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

const dataStore = require("./lib/dataStore");
const PORT = process.env.PORT || 4000;

if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, async () => {
    // Force Data Load on Startup
    try {
      await dataStore.loadDataFromNDJSON();
      console.log(`[Server] global.colleges.length after load: ${global.colleges?.length}`);
      // Initialize the Redis/L1 cache services from the loaded memory data
      const cacheService = require("./services/dataStore");
      await cacheService.initializeCache();
    } catch (e) {
      console.error("❌ Critical Ingestion Failure:", e.message);
    }

    const c = { cyan: '\x1b[36m', green: '\x1b[32m', yellow: '\x1b[33m', magenta: '\x1b[35m', reset: '\x1b[0m', bold: '\x1b[1m', blue: '\x1b[34m' };
    const isMissingEnv = missingEnv.length > 0 ? `${c.yellow}ACTIVE ⚠️ (Missing Env Vars)${c.reset}` : `${c.green}Inactive (Healthy)${c.reset}`;
    console.log(`\n${c.cyan}${c.bold}================================================================${c.reset}`);
    console.log(`${c.magenta}${c.bold}   ✨ CEI CORE INTELLIGENCE ENGINE ONLINE ✨${c.reset}`);
    console.log(`${c.cyan}${c.bold}================================================================${c.reset}\n`);
    console.log(`  ${c.bold}🚀 API Base URL     :${c.reset} ${c.blue}http://localhost:${PORT}${c.reset}`);
    console.log(`  ${c.bold}🌍 Environment      :${c.reset} ${c.cyan}${process.env.NODE_ENV || 'development'}${c.reset}`);
    console.log(`  ${c.bold}🛡️  Maintenance Mode :${c.reset} ${isMissingEnv}`);
    console.log(`\n${c.cyan}${c.bold}================================================================${c.reset}\n`);
    console.log(`${c.green}Ready to accept connections...${c.reset}\n`);
  });
}

module.exports = app;
