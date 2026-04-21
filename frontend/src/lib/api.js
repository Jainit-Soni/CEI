import axios from "axios";

// Read raw environment variable
let apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
if (apiBaseUrl && apiBaseUrl.includes("127.0.0.1")) {
  apiBaseUrl = apiBaseUrl.replace("127.0.0.1", "localhost");
}

// Fallback logic — Centralized Source of Truth
// Standardize to the backend precisely specified by the user
export const API_BASE = (
  apiBaseUrl || 
  (process.env.NODE_ENV === "production" ? "https://ce-intelligence-backend.vercel.app" : "http://localhost:4000")
).replace(/\/$/, "");

// 🚨 Production Guardrail: Ensure localhost never leaks into the live site
if (process.env.NODE_ENV === "production" && API_BASE.includes("localhost")) {
  console.error(
    "🔥 CRITICAL DEPLOYMENT ERROR: API_BASE is resolving to localhost in production. " +
    "Please check your Vercel Environment Variables to ensure NEXT_PUBLIC_API_URL is " +
    "set to your live backend domain."
  );
}

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
  withCredentials: true,
});

// Professional Interceptor Layer with Automated Resilience
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    const status = response ? response.status : null;
    
    // Resilience: Silent Retry once for timeouts or server blips
    if ((error.code === 'ECONNABORTED' || status === 500) && !config._retry) {
      config._retry = true;
      console.warn(`[API Resilience] Retrying ${config.url} due to ${error.code || status}...`);
      return api(config);
    }

    let message = "An unexpected intelligence disruption occurred.";
    let title = "System Anomaly";

    if (status === 401) {
      title = "Session Expired";
      message = "Please sign in again to continue your session.";
    } else if (status === 403) {
      title = "Access Restricted";
      message = "You don't have permission for this strategic data.";
    } else if (status === 404) {
      title = "Resource Missing";
      message = "The requested intelligence could not be located.";
    } else if (status === 500) {
      title = "Core Failure";
      message = "The backend processing unit encountered an error.";
    } else if (error.code === 'ECONNABORTED') {
      title = "Network Timeout";
      message = "The request took too long. We're retrying once...";
    }

    // Dispatch global event for Toast system to pick up
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('api-error', { 
            detail: { title, message, type: 'error' } 
        }));
    }

    return Promise.reject(error);
  }
);

const isDev = process.env.NODE_ENV === 'development';

const ceiLog = (context, msg, data) => {
    if (isDev) {
        console.log(`[CEI][UI][${context}] ${msg}`, data || '');
    }
};

/**
 * CEI v2 Normalization Layer
 * Ensures UI components receive predictable data structures.
 */
const normalizeCeiDetail = (res) => {
    if (!res) return null;
    const rawData = res.college || res;
    const canonical = rawData.canonical || {};
    const rawFields = rawData.raw || {};
    
    // Safety check for location/meta
    const name = canonical.canonicalCollegeName || rawFields.name || rawData.name;
    const state = canonical.state || rawFields.state || rawData.state;
    const city = canonical.city || rawFields.district || rawData.city || rawData.district;
    const location = (city && state) ? `${city}, ${state}` : (state || city || null);
    
    return {
        ...rawData,
        id: rawData.stableKey || rawData._id || rawData.id,
        stableKey: rawData.stableKey || rawData._id,
        name,
        location,
        state,
        city,
        collegeType: canonical.collegeType || rawFields.profile?.instituteType,
        ownership: canonical.ownership || rawFields.profile?.ownership || rawData.meta?.ownership,
        courses: res.courseOfferings || rawData.courseOfferings || rawData.courses || [],
        engineeringCutoffs: res.engineeringCutoffsSummary || rawData.engineeringCutoffs || [],
        rankings: res.rankings || rawData.rankings || [],
        medicalCounselling: res.medicalCounsellingSummary || rawData.medicalCounselling || null,
        meta: rawData.meta || {},
        fees: rawData.fees || {},
        placements: rawData.placements || {},
        tuition: rawData.tuition || null
    };
};

export async function fetchColleges(params = {}) {
  const startTime = Date.now();
  ceiLog('search', 'Fetching colleges...', params);
  try {
    const { data } = await api.get("/api/colleges", { params });
    const count = data.data?.length || 0;
    ceiLog('search', `Success. ${count} results in ${Date.now() - startTime}ms`);
    return data;
  } catch (err) {
    console.error(`[CEI][UI][search] Error:`, err.message);
    throw err;
  }
}

export async function fetchCollege(id, uid = null) {
  if (!id || id === "undefined") {
    if (isDev) console.warn("[CEI][UI][detail] Invalid id requested:", id);
    return null;
  }
  const startTime = Date.now();
  ceiLog('detail', `Fetching college: ${id} (uid: ${uid || 'none'})`);
  try {
    const params = uid ? { uid } : {};
    const { data } = await api.get(`/api/college/${id}`, { params });
    const normalized = normalizeCeiDetail(data);
    
    ceiLog('detail', `Success in ${Date.now() - startTime}ms.`, {
        offerings: normalized.courses.length,
        cutoffs: normalized.engineeringCutoffs.length,
        rankings: normalized.rankings.length
    });
    
    return normalized;
  } catch (err) {
    console.error(`[CEI][UI][detail] Error:`, err.message);
    throw err;
  }
}

export async function fetchCollegeTruthSeats(id) {
  if (!id) return null;
  const { data } = await api.get(`/api/colleges/${id}/truth/seats`);
  return data;
}

export async function fetchCollegeTruthCutoffs(id) {
  if (!id) return null;
  const { data } = await api.get(`/api/colleges/${id}/truth/cutoffs`);
  return data;
}

export async function fetchCollegeTruthCourses(id) {
  if (!id) return null;
  const { data } = await api.get(`/api/colleges/${id}/truth/courses`);
  return data;
}

export async function fetchCollegeTruthFees(id) {
  if (!id) return null;
  const { data } = await api.get(`/api/colleges/${id}/truth/fees`);
  return data;
}

export async function fetchCollegeTruthPlacements(id) {
  if (!id) return null;
  const { data } = await api.get(`/api/colleges/${id}/truth/placements`);
  return data;
}

export async function fetchExams(params = {}) {
  try {
    const { data } = await api.get("/api/exams", { params });
    console.log("[CEI][UI][exams] fetchExams result:", Array.isArray(data) ? data.length : "Not an array");
    return data;
  } catch (err) {
    console.error("[CEI][UI][exams] fetchExams failed:", err.message);
    throw err;
  }
}

export async function fetchExam(id) {
  const { data } = await api.get(`/api/exam/${id}`);
  return data;
}

export async function fetchExamColleges(id, params = {}) {
  const { data } = await api.get(`/api/exam/${id}/colleges`, { params });
  return data;
}

export async function searchAll(params = {}) {
  const { data } = await api.get("/api/search", { params });
  return data;
}

export async function suggest(q) {
  // Support both string or { q: '...' } object for flexibility
  const params = typeof q === 'string' ? { q } : q;
  const { data } = await api.get("/api/suggest", { params });
  return data;
}

export async function fetchStateStats(params = {}) {
  const { data } = await api.get("/api/states/stats", { params });
  return data;
}

export async function fetchAggregateStats() {
  const { data } = await api.get("/api/stats/aggregate");
  return data;
}

export async function fetchFilters(params = {}) {
  const { data } = await api.get("/api/filters", { params });
  return data;
}

export async function fetchCollegesBatch(ids) {
  if (!ids || ids.length === 0) return [];

  // Chunking to prevent URL overflow (max 40 IDs per request)
  const CHUNK_SIZE = 40;
  const chunks = [];
  for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
    chunks.push(ids.slice(i, i + CHUNK_SIZE));
  }

  try {
    const results = await Promise.all(
      chunks.map(chunk =>
        api.get("/api/colleges/batch", {
          params: { ids: chunk.join(',') }
        })
      )
    );

    // Each item from batch is a full page-cache object: { college, rankings, anomalies, ... }
    // Pass the full item so normalizeCeiDetail can read top-level fields correctly
    const rawItems = results.flatMap(res => res.data || res);
    return rawItems.map(item => {
        // Handle both wrapped { college: {...} } and bare college objects
        return normalizeCeiDetail(item);
    }).filter(c => c && (c.id || c._id));
  } catch (err) {
    console.error("Batch fetch failed", err);
    throw err;
  }
}

export async function fetchUserChoices(uid) {
  if (!uid) return [];
  const { data } = await api.get("/api/user/choices", { params: { uid } });
  return data;
}

export async function saveUserChoices(uid, choices) {
  if (!uid) return;
  const { data } = await api.post("/api/user/choices", { uid, choices });
  return data;
}

export async function shareUserChoices(choices, userName) {
  const { data } = await api.post("/api/user/share", { choices, userName });
  return data;
}

export async function fetchSharedList(shareId) {
  const { data } = await api.get(`/api/user/share/${shareId}`);
  return data;
}

// News API
export async function fetchNews() {
  const { data } = await api.get("/api/news");
  return data;
}

export async function postNews(newsData) {
  const { data } = await api.post("/api/news", newsData);
  return data;
}

// Hype API
export async function fetchHypeStats() {
  const { data } = await api.get("/api/hype/stats");
  return data;
}

export async function postHypeVote(voteData) {
  const { data } = await api.post("/api/hype/vote", voteData);
  return data;
}

// Predictor API
export async function postPredict(scoreData) {
  const { data } = await api.post("/api/predict", scoreData);
  return data;
}

// Scholarships API
export async function fetchScholarships() {
  const { data } = await api.get("/api/scholarships");
  return data;
}

export async function fetchScholarship(id) {
  const { data } = await api.get(`/api/scholarships/${id}`);
  return data;
}

// Activity / Live Pulse API
export async function fetchLiveActivity(collegeId) {
  const { data } = await api.get("/api/activity/stats", { params: { collegeId } });
  return data;
}

export async function postActivityPing(collegeId) {
  const { data } = await api.post("/api/activity/ping", { collegeId });
  return data;
}

// Battle Arena API
export async function fetchBattleData() {
  // Assuming battle has its own data endpoint or uses hype stats
  const { data } = await api.get("/api/hype/stats");
  return data;
}

// ── Phase XVI — Reviews API ──────────────────────────────────────────────
export async function fetchReviews(collegeId) {
  const { data } = await api.get(`/api/reviews/${collegeId}`);
  return data;
}

export async function postReview(reviewData) {
  const { data } = await api.post("/api/reviews", reviewData);
  return data;
}

// ── Trust & Reporting ─────────────────────────────────────────────────────
export async function postReport(reportData) {
  const { data } = await api.post("/api/trust/report", reportData);
  return data;
}

export async function fetchReports(collegeId) {
  const { data } = await api.get(`/api/trust/reports/${collegeId}`);
  return data;
}

// ── Benchmarking ──────────────────────────────────────────────────────────
export async function fetchBenchmarks(collegeId) {
  const { data } = await api.get(`/api/college/${collegeId}/benchmarks`);
  return data;
}

export async function fetchCompliance(collegeId) {
  const { data } = await api.get(`/api/colleges/${collegeId}/truth/compliance`);
  return data;
}
export async function fetchEngineeringCutoffs(params = {}) {
  const { data } = await api.get("/api/cutoffs/engineering", { params });
  return data;
}

export async function fetchEngineeringCutoffMeta(params = {}) {
  const { data } = await api.get("/api/cutoffs/engineering/meta", { params });
  return data;
}

export async function fetchEngineeringSeatMatrix(params = {}) {
  const { data } = await api.get("/api/seats/engineering", { params });
  return data;
}

export async function fetchEngineeringSeatMatrixMeta(params = {}) {
  const { data } = await api.get("/api/seats/engineering/meta", { params });
  return data;
}
