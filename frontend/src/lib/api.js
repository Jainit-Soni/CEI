import axios from "axios";

// Force localhost instead of 127.0.0.1 to avoid CORS and cookie issues in dev
let apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
if (apiBaseUrl && apiBaseUrl.includes("127.0.0.1")) {
  apiBaseUrl = apiBaseUrl.replace("127.0.0.1", "localhost");
}

export const API_BASE = (apiBaseUrl || (process.env.VERCEL || process.env.NODE_ENV === "production" ? "https://ce-intelligence-backend.vercel.app" : "http://localhost:4000")).replace(/\/$/, "");

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  withCredentials: true,
});

// Professional Interceptor Layer
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response ? error.response.status : null;
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
      message = "The request took too long. Please check your connection.";
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

export async function fetchColleges(params = {}) {
  const { data } = await api.get("/api/colleges", { params });
  return data;
}

export async function fetchCollege(id) {
  if (!id || id === "undefined") {
    console.warn("[api] fetchCollege called with invalid id:", id);
    return null;
  }
  const { data } = await api.get(`/api/college/${id}`);
  console.log(`[API] Fetched college ${id} from ${API_BASE}. Score:`, data.ceiScore || data.college?.ceiScore);
  // If the API returns an enriched payload { college, anomalies, ... }, 
  // we return just the college object for component compatibility.
  return data.college || data;
}

export async function fetchExams(params = {}) {
  const { data } = await api.get("/api/exams", { params });
  return data;
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

    // Merge all data arrays
    return results.flatMap(res => res.data || res);
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
