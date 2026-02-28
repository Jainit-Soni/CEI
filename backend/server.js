require('dotenv').config({ path: require('path').resolve(__dirname, '.env.local') });
const express = require("express");
const cors = require("cors");
const compression = require("compression");
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
const authRoutes = require("./routes/auth");
const connectDB = require("./config/db");

const app = express();

// Connect to MongoDB
if (process.env.NODE_ENV !== 'test') {
  connectDB();
}


// ==========================================
// 🛡️ SECURITY & INFRASTRUCTURE MIDDLEWARE
// ==========================================
app.set("trust proxy", 1); // Trust Vercel's reverse proxy for accurate client IP detection
app.use(helmet()); // Secure HTTP headers against common web vulnerabilities
app.use(compression()); // Enable gzip compression to reduce payload sizes

// ==========================================
// 🌐 CORS CONFIGURATION
// ==========================================
const isProduction = process.env.NODE_ENV === 'production';

// Parse allowed origins from environment variables
const rawOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : [];
const normalizedOrigins = rawOrigins
  .map(o => o.trim())
  .filter(Boolean)
  .map(o => o.replace(/\/$/, ""));

// Define explicitly allowed frontend URLs
const allowedOrigins = [
  "http://localhost:3030", // Local development frontend
  "https://ce-intelligence.vercel.app", // Production Vercel domain
  "https://cmat-problem-frontend.vercel.app", // Legacy Vercel domain
  ...normalizedOrigins
];

const corsOptions = {
  origin: function (origin, callback) {
    // 1. Allow non-browser requests (e.g., mobile apps, cURL, desktop clients)
    if (!origin) return callback(null, true);

    // 2. Allow Vercel preview environments dynamically
    const isVercel = origin.endsWith(".vercel.app") || origin.includes("--ce-intelligence-");
    if (isVercel) {
      return callback(null, true);
    }

    // 3. Check against strictly defined allowed domains
    const isAllowed = allowedOrigins.some(allowed => {
      if (allowed === "*") return true; // Wildcard bypass
      const normalizedQuery = origin.toLowerCase().replace(/\/$/, "");
      const normalizedAllowed = allowed.toLowerCase().replace(/\/$/, "");
      return normalizedAllowed === normalizedQuery;
    });

    if (isAllowed) {
      callback(null, true);
    } else {
      console.warn(`CORS Reject: Origin [${origin}] not in allowed list`);
      callback(null, false);
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-api-key"],
  credentials: true
};

// Apply CORS early in the middleware stack to avoid "CORS masking" of other errors
app.use(cors(corsOptions));
app.use(express.json());

// ==========================================
// 🔑 DOMAIN LOGIC & API KEY AUTHENTICATION
// ==========================================
app.use(apiKeyAuth); // Enforce API Key validation on all incoming requests

// Database Health Check Endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Root Endpoint
app.get("/", (req, res) => {
  res.send("<h1>CEI Backend is Running</h1><p>Status: Active, Secured by API Key</p>");
});

// ==========================================
// 🚀 APPLICATION ROUTES
// ==========================================
// Core Entities
app.use("/api", collegesRoutes);      // College profiles and queries
app.use("/api", examsRoutes);         // Competitive exam details
app.use("/api", searchRoutes);        // Global search endpoint

// Specialized Features
app.use("/api/stats", statsRoutes);           // Analytics and map aggregated stats
app.use("/api/admin", adminRoutes);           // Administrative dashboard tools
app.use("/api/activity", activityRoutes);     // Real-time tracking and logs
app.use("/api/scholarships", scholarshipRoutes); // Scholarship lookup
app.use("/api/news", newsRoutes);             // Edu news scraper
app.use("/api/hype", hypeRoutes);             // Fan-wars upvoting system
app.use("/api/predict", predictorRoutes);     // Admissions predictor algorithm
app.use("/api/auth", authRoutes);             // User authentication (JWT/OAuth)
app.use("/api", userRoutes);                  // User profile management

const PORT = process.env.PORT || 4000;

// Only listen if not running on Vercel (Vercel exports the app)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`CEI backend running on ${PORT}`);
  });
}

module.exports = app;
