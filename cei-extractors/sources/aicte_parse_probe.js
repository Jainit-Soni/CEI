const fs = require("fs");
const path = require("path");

const {
  ensureDir,
  writeText,
  writeJson,
  listFiles,
  readJson,
} = require("../core/io");

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "cei-extractors", "output");
const MANIFESTS_DIR = path.join(OUTPUT_DIR, "manifests");
const PARSED_DIR = path.join(OUTPUT_DIR, "parsed");

function clean(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function getLatestAicteProbeManifestPath() {
  const files = listFiles(MANIFESTS_DIR)
    .filter((name) => name.startsWith("aicte_probe_approved_dashboard_") && name.endsWith(".json"))
    .sort();

  if (!files.length) {
    throw new Error("No AICTE probe manifest found.");
  }

  return path.join(MANIFESTS_DIR, files[files.length - 1]);
}

function safeJsonRead(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function parseUrl(url) {
  try {
    const u = new URL(url);
    return {
      host: u.hostname,
      path: u.pathname,
      query: u.search,
      origin: u.origin,
    };
  } catch {
    return {
      host: "",
      path: "",
      query: "",
      origin: "",
    };
  }
}

function looksInteresting(item) {
  const url = String(item.url || "").toLowerCase();
  const method = String(item.method || "").toLowerCase();
  const resourceType = String(item.resourceType || "").toLowerCase();
  const contentType = String(item.contentType || "").toLowerCase();
  const postData = String(item.requestPostData || item.postData || "").toLowerCase();

  let score = 0;

  if (resourceType === "xhr" || resourceType === "fetch") score += 20;
  if (method === "post") score += 8;

  if (url.includes("fetchdata")) score += 25;
  if (url.includes("approved")) score += 18;
  if (url.includes("dashboard")) score += 12;
  if (url.includes("institute")) score += 12;
  if (url.includes("course")) score += 12;
  if (url.includes("program")) score += 10;
  if (url.includes("api")) score += 12;
  if (url.includes("json")) score += 12;
  if (url.includes("php")) score += 10;

  if (contentType.includes("json")) score += 15;
  if (contentType.includes("html")) score += 5;
  if (contentType.includes("csv")) score += 8;

  if (postData.includes("institute")) score += 8;
  if (postData.includes("course")) score += 8;
  if (postData.includes("program")) score += 8;
  if (postData.includes("approved")) score += 8;
  if (postData.includes("fetch")) score += 6;

  if (item.savedBodyPath) score += 10;
  if (item.status && item.status >= 200 && item.status < 300) score += 4;

  if (url.includes("google-analytics")) score -= 50;
  if (url.includes("gstatic")) score -= 20;
  if (url.includes("fonts")) score -= 20;
  if (url.endsWith(".css")) score -= 20;
  if (url.endsWith(".js")) score -= 15;
  if (url.endsWith(".png") || url.endsWith(".jpg") || url.endsWith(".jpeg") || url.endsWith(".svg")) score -= 20;

  return score;
}

function summarizeBodies(responses) {
  const rows = [];

  for (const r of responses) {
    if (!r.savedBodyPath) continue;

    const ext = path.extname(r.savedBodyPath).toLowerCase();
    const sizeBytes = fs.existsSync(r.savedBodyPath)
      ? fs.statSync(r.savedBodyPath).size
      : null;

    let preview = "";
    if (fs.existsSync(r.savedBodyPath) && [".json", ".txt", ".html", ".csv"].includes(ext)) {
      try {
        preview = fs.readFileSync(r.savedBodyPath, "utf8").slice(0, 5000);
      } catch {
        preview = "";
      }
    }

    rows.push({
      url: r.url,
      method: r.method,
      resourceType: r.resourceType,
      contentType: r.contentType,
      status: r.status,
      savedBodyPath: r.savedBodyPath,
      ext,
      sizeBytes,
      preview,
    });
  }

  return rows;
}

function groupByPath(items) {
  const map = new Map();

  for (const item of items) {
    const parsed = parseUrl(item.url);
    const key = `${item.method || ""} ${parsed.origin}${parsed.path}`;

    if (!map.has(key)) {
      map.set(key, {
        key,
        origin: parsed.origin,
        host: parsed.host,
        path: parsed.path,
        method: item.method || "",
        count: 0,
        resourceTypes: new Set(),
        contentTypes: new Set(),
        statuses: new Set(),
        sampleUrls: [],
        savedBodyPaths: [],
        maxScore: -Infinity,
        samplePostData: [],
      });
    }

    const row = map.get(key);
    row.count += 1;
    row.resourceTypes.add(item.resourceType || "");
    row.contentTypes.add(item.contentType || "");
    row.statuses.add(String(item.status || ""));
    row.maxScore = Math.max(row.maxScore, looksInteresting(item));

    if (row.sampleUrls.length < 5) row.sampleUrls.push(item.url);
    if (item.savedBodyPath && row.savedBodyPaths.length < 10) row.savedBodyPaths.push(item.savedBodyPath);

    const pd = clean(item.requestPostData || item.postData || "");
    if (pd && row.samplePostData.length < 5) row.samplePostData.push(pd);
  }

  return Array.from(map.values())
    .map((row) => ({
      ...row,
      resourceTypes: Array.from(row.resourceTypes),
      contentTypes: Array.from(row.contentTypes),
      statuses: Array.from(row.statuses),
    }))
    .sort((a, b) => b.maxScore - a.maxScore || b.count - a.count);
}

function summarizeDom(rawDir) {
  const domFiles = listFiles(rawDir)
    .filter((name) => name.endsWith("__dom.json"))
    .sort();

  return domFiles.map((fileName) => {
    const filePath = path.join(rawDir, fileName);
    const data = safeJsonRead(filePath, {});

    return {
      fileName,
      selects: (data.selects || []).length,
      inputs: (data.inputs || []).length,
      buttons: (data.buttons || []).length,
      tables: (data.tables || []).length,
      selectPreview: (data.selects || []).slice(0, 10),
      buttonPreview: (data.buttons || []).slice(0, 20),
      tablePreview: (data.tables || []).slice(0, 10),
    };
  });
}

function toCsv(rows) {
  if (!rows.length) return "";

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((k) => set.add(k));
      return set;
    }, new Set())
  );

  const escape = (value) => {
    const s = String(value ?? "");
    if (s.includes('"') || s.includes(",") || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => escape(row[h])).join(","));
  }
  return lines.join("\n");
}

async function main() {
  ensureDir(PARSED_DIR);

  const manifestPath = getLatestAicteProbeManifestPath();
  const manifest = readJson(manifestPath);
  const rawDir = manifest.rawDir;

  if (!rawDir || !fs.existsSync(rawDir)) {
    throw new Error(`Raw dir not found: ${rawDir}`);
  }

  const requestPath = path.join(rawDir, "request_log.json");
  const responsePath = path.join(rawDir, "response_log.json");
  const summaryPath = path.join(rawDir, "probe_summary.json");

  const requests = safeJsonRead(requestPath, []);
  const responses = safeJsonRead(responsePath, []);
  const probeSummary = safeJsonRead(summaryPath, {});

  console.log("Using manifest:", manifestPath);
  console.log("Using raw dir  :", rawDir);
  console.log("Requests       :", requests.length);
  console.log("Responses      :", responses.length);

  const scoredResponses = responses
    .map((r) => ({
      score: looksInteresting(r),
      url: r.url,
      method: r.method,
      resourceType: r.resourceType,
      status: r.status,
      contentType: r.contentType,
      savedBodyPath: r.savedBodyPath || "",
      requestPostData: clean(r.requestPostData || ""),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score);

  const grouped = groupByPath(responses);
  const bodies = summarizeBodies(responses);
  const domSummary = summarizeDom(rawDir);

  const runId = path.basename(rawDir);

  const scoredJson = path.join(PARSED_DIR, `aicte_probe_scored_${runId}.json`);
  const scoredCsv = path.join(PARSED_DIR, `aicte_probe_scored_${runId}.csv`);
  const groupedJson = path.join(PARSED_DIR, `aicte_probe_grouped_${runId}.json`);
  const bodiesJson = path.join(PARSED_DIR, `aicte_probe_bodies_${runId}.json`);
  const domJson = path.join(PARSED_DIR, `aicte_probe_dom_${runId}.json`);
  const reportTxt = path.join(PARSED_DIR, `aicte_probe_report_${runId}.txt`);

  writeJson(scoredJson, scoredResponses);
  writeText(scoredCsv, toCsv(scoredResponses));
  writeJson(groupedJson, grouped);
  writeJson(bodiesJson, bodies);
  writeJson(domJson, domSummary);

  const lines = [];
  lines.push(`Manifest: ${manifestPath}`);
  lines.push(`Raw Dir : ${rawDir}`);
  lines.push(`Requests: ${requests.length}`);
  lines.push(`Responses: ${responses.length}`);
  lines.push(`Probe final URL: ${probeSummary.finalUrl || ""}`);
  lines.push("");

  lines.push("Top candidate endpoints:");
  for (const row of grouped.slice(0, 25)) {
    lines.push(`- ${row.key}`);
    lines.push(`  host=${row.host}`);
    lines.push(`  count=${row.count}`);
    lines.push(`  maxScore=${row.maxScore}`);
    lines.push(`  resourceTypes=${row.resourceTypes.join(" | ")}`);
    lines.push(`  contentTypes=${row.contentTypes.join(" | ")}`);
    lines.push(`  statuses=${row.statuses.join(" | ")}`);
    if (row.samplePostData.length) {
      lines.push(`  samplePostData=${row.samplePostData[0]}`);
    }
    if (row.savedBodyPaths.length) {
      lines.push(`  savedBody=${row.savedBodyPaths[0]}`);
    }
    lines.push("");
  }

  lines.push("Saved response bodies:");
  for (const body of bodies.slice(0, 20)) {
    lines.push(`- ${body.url}`);
    lines.push(`  method=${body.method} | type=${body.resourceType} | status=${body.status}`);
    lines.push(`  contentType=${body.contentType}`);
    lines.push(`  file=${body.savedBodyPath}`);
    lines.push(`  size=${body.sizeBytes}`);
    lines.push("");
  }

  lines.push("DOM summary:");
  for (const dom of domSummary) {
    lines.push(`- ${dom.fileName}`);
    lines.push(`  selects=${dom.selects} | inputs=${dom.inputs} | buttons=${dom.buttons} | tables=${dom.tables}`);
    lines.push("");
  }

  writeText(reportTxt, lines.join("\n"));

  console.log("\nAICTE PROBE PARSE COMPLETE");
  console.log("Scored responses JSON :", scoredJson);
  console.log("Scored responses CSV  :", scoredCsv);
  console.log("Grouped endpoints JSON:", groupedJson);
  console.log("Saved bodies JSON     :", bodiesJson);
  console.log("DOM summary JSON      :", domJson);
  console.log("Report TXT            :", reportTxt);
}

main().catch((err) => {
  console.error("AICTE PROBE PARSE FAILED");
  console.error(err);
  process.exit(1);
});