import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 12000,
});

export async function fetchColleges(params = {}) {
  const { data } = await api.get("/api/colleges", { params });
  return data;
}

export async function fetchCollege(id) {
  const { data } = await api.get(`/api/college/${id}`);
  return data;
}

export async function fetchExams(params = {}) {
  const { data } = await api.get("/api/exams", { params });
  return data;
}

export async function fetchExam(id) {
  const { data } = await api.get(`/api/exam/${id}`);
  return data;
}

export async function searchAll(params = {}) {
  const { data } = await api.get("/api/search", { params });
  return data;
}

export async function suggest(params = {}) {
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
