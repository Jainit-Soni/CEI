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


// Security & Infrastructure Middleware
app.set("trust proxy", 1); // Trust Vercel's reverse proxy for accurate client IPs
app.use(helmet()); // Secure HTTP headers
app.use(compression()); // Enable gzip compression

// CORS configuration
const isProduction = process.env.NODE_ENV === 'production';

const rawOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : [];
const normalizedOrigins = rawOrigins
  .map(o => o.trim())
  .filter(Boolean)
  .map(o => o.replace(/\/$/, ""));

const allowedOrigins = [
  "http://localhost:3030",
  "https://ce-intelligence.vercel.app",
  "https://cmat-problem-frontend.vercel.app",
  ...normalizedOrigins
];

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

// Apply CORS early to avoid "CORS masking" of other errors
app.use(cors(corsOptions));
app.use(express.json());

// Domain Logic Middleware
app.use(apiKeyAuth);   // Check for API Key first

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

app.get("/", (req, res) => {
  res.send("<h1>CMAT Backend is Running</h1><p>Status: Active</p>");
});

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
app.use("/api", userRoutes);

const PORT = process.env.PORT || 4000;

// Only listen if not running on Vercel (Vercel exports the app)
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`CEI backend running on ${PORT}`);
  });
}

module.exports = app;
