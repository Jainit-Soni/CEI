import axios from "axios";

// Read raw environment variable
let apiBaseUrl = process.env.NEXT_PUBLIC_API_URL;
if (apiBaseUrl && apiBaseUrl.includes("127.0.0.1")) {
  apiBaseUrl = apiBaseUrl.replace("127.0.0.1", "localhost");
}

// Fallback logic — Centralized Source of Truth
export const API_BASE = (
  apiBaseUrl || 
  (process.env.NODE_ENV === "production" ? "https://ce-intelligence-backend.vercel.app" : "http://localhost:4000")
).replace(/\/$/, "");

// 🚨 Production Guardrail
if (process.env.NODE_ENV === "production" && API_BASE.includes("localhost")) {
  console.error("🔥 CRITICAL DEPLOYMENT ERROR: API_BASE is resolving to localhost in production.");
}

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 20000,
  withCredentials: true,
});

// Interceptor Layer
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error;
    const status = response ? response.status : null;
    
    if ((error.code === 'ECONNABORTED' || status === 500) && !config._retry) {
      config._retry = true;
      return api(config);
    }

    let message = "An unexpected intelligence disruption occurred.";
    let title = "System Anomaly";

    if (status === 401) { title = "Session Expired"; message = "Please sign in again."; }
    else if (status === 403) { title = "Access Restricted"; message = "No permission."; }
    else if (status === 404) { title = "Resource Missing"; message = "Intelligence not found."; }
    else if (status === 500) { title = "Core Failure"; message = "Backend error."; }

    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('api-error', { detail: { title, message, type: 'error' } }));
    }
    return Promise.reject(error);
  }
);

/**
 * CEI Normalization Layer
 */
const normalizeCeiDetail = (res) => {
    if (!res) return null;
    const rawData = res.college || res;
    const canonical = rawData.canonical || {};
    const rawFields = rawData.raw || {};
    
    const name = canonical.canonicalCollegeName || rawFields.name || rawData.name;
    const state = canonical.state || rawFields.state || rawData.state;
    const city = canonical.city || rawFields.district || rawData.city || rawData.district;
    const location = (city && state) ? `${city}, ${state}` : (state || city || null);
    
    return {
        ...rawData,
        id: rawData.id || rawData.institution_id || rawData.stableKey || rawData._id,
        name,
        location,
        state,
        city,
        courses: res.courseOfferings || rawData.courses || [],
        engineeringCutoffs: res.engineeringCutoffsSummary || rawData.engineeringCutoffs || [],
        rankings: res.rankings || rawData.rankings || [],
        meta: { ...(rawData.meta || {}), ...(res.meta || {}) },
        fees: rawData.fees || {},
        placements: rawData.placements || {}
    };
};

// --- API Methods ---

export async function fetchColleges(params = {}, options = {}) {
  const { data } = await api.get("/api/colleges", { params, ...options });
  return data;
}

export async function fetchCollege(id, uid = null) {
  if (!id) return null;
  const params = uid ? { uid } : {};
  const { data } = await api.get(`/api/college/${id}`, { params });
  return normalizeCeiDetail(data);
}

export async function fetchCollegeTruthSeats(id) {
  const { data } = await api.get(`/api/colleges/${id}/truth/seats`);
  return data;
}

export async function fetchCollegeTruthCutoffs(id) {
  const { data } = await api.get(`/api/colleges/${id}/truth/cutoffs`);
  return data;
}

export async function fetchCollegeTruthCourses(id) {
  const { data } = await api.get(`/api/colleges/${id}/truth/courses`);
  return data;
}

export async function fetchCollegeTruthFees(id) {
  const { data } = await api.get(`/api/colleges/${id}/truth/fees`);
  return data;
}

export async function fetchCollegeTruthPlacements(id) {
  const { data } = await api.get(`/api/colleges/${id}/truth/placements`);
  return data;
}

export async function searchAll(params = {}) {
  const { data } = await api.get("/api/search", { params });
  return data;
}

export async function suggest(q, options = {}) {
  const params = typeof q === 'string' ? { q } : q;
  const { data } = await api.get("/api/suggest", { params, ...options });
  return data;
}

export async function fetchFilters(params = {}, options = {}) {
  const { data } = await api.get("/api/filters", { params, ...options });
  return data;
}

export async function fetchBenchmarks(collegeId) {
  const { data } = await api.get(`/api/college/${collegeId}/benchmarks`);
  return data;
}

export async function fetchCompliance(collegeId) {
  const { data } = await api.get(`/api/colleges/${collegeId}/truth/compliance`);
  return data;
}

export async function fetchReviews(collegeId) {
  const { data } = await api.get(`/api/reviews/${collegeId}`);
  return data;
}

export async function postReview(reviewData) {
  const { data } = await api.post("/api/reviews", reviewData);
  return data;
}

// --- Medical Truth API ---

export async function fetchMedicalCutoffs(params = {}) {
  const { data } = await api.get("/api/medical/cutoffs", { params });
  return data;
}

export const fetchMedicalSeatMatrix = async ({ entityId }) => {
    const res = await api.get(`/api/medical/seats?entityId=${entityId}`);
    return res.data;
};

export const fetchMedicalPredictions = async ({ rank, quota, category, programType }) => {
    const res = await api.get(`/api/medical/predict`, {
        params: { rank, quota, category, programType }
    });
    return res.data;
};

// --- Engineering Specifics ---

export async function fetchEngineeringCutoffs(params = {}) {
  const { data } = await api.get("/api/cutoffs/engineering", { params });
  return data;
}

export async function fetchEngineeringSeatMatrix(params = {}) {
  const { data } = await api.get("/api/seats/engineering", { params });
  return data;
}

export async function fetchAggregateStats() {
  const { data } = await api.get("/api/stats/aggregate");
  return data;
}

export async function fetchCollegesBatch(ids) {
  if (!ids || ids.length === 0) return [];
  const { data } = await api.post("/api/colleges/batch", { ids });
  return data.map(c => normalizeCeiDetail(c));
}
