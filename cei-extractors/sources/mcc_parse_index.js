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

function getLatestMccManifestPath() {
  const files = listFiles(MANIFESTS_DIR)
    .filter((name) => name.startsWith("mcc_") && name.endsWith(".json"))
    .sort();

  if (files.length === 0) {
    throw new Error("No MCC manifest found.");
  }

  return path.join(MANIFESTS_DIR, files[files.length - 1]);
}

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function getExtFromUrl(url) {
  const lower = String(url || "").toLowerCase();
  const match = lower.match(/\.([a-z0-9]+)(?:$|\?)/i);
  return match ? match[1] : "";
}

function getHost(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isDirectDocument(url) {
  const ext = getExtFromUrl(url);
  const host = getHost(url);

  if (["pdf", "xls", "xlsx", "csv", "zip", "doc", "docx"].includes(ext)) {
    return true;
  }

  if (host.endsWith("s3waas.gov.in")) {
    return true;
  }

  return false;
}

function inferSection(pageUrl) {
  const u = String(pageUrl || "").toLowerCase();

  if (u.includes("current-events-ug")) return "current_events_ug";
  if (u.includes("current-events-pg")) return "current_events_pg";
  if (u.includes("current-events-mds")) return "current_events_mds";
  if (u.includes("archive-ug")) return "archive_ug";
  if (u.includes("archive-pg")) return "archive_pg";
  if (u.includes("archive-mds")) return "archive_mds";
  if (u.includes("news-events-ug")) return "news_events_ug";
  if (u.includes("news-events-pg")) return "news_events_pg";
  if (u.includes("news-events-mds")) return "news_events_mds";

  return "unknown";
}

function inferTrack(pageUrl, title) {
  const blob = `${pageUrl || ""} ${title || ""}`.toLowerCase();

  if (blob.includes(" ug ") || blob.includes("-ug") || blob.includes("neet ug")) return "ug";
  if (blob.includes(" pg ") || blob.includes("-pg")) return "pg";
  if (blob.includes("mds")) return "mds";
  if (blob.includes("super speciality") || blob.includes("super speciality")) return "super_speciality";

  return "unknown";
}

function inferYear(title, pageUrl) {
  const titleMatch = String(title || "").match(/\b(20\d{2})\b/g);
  if (titleMatch && titleMatch.length) {
    return Number(titleMatch[titleMatch.length - 1]);
  }

  const urlMatch = String(pageUrl || "").match(/\b(20\d{2})\b/g);
  if (urlMatch && urlMatch.length) {
    return Number(urlMatch[urlMatch.length - 1]);
  }

  return null;
}

function inferDocType(title) {
  const t = String(title || "").toLowerCase();

  if (t.includes("seat matrix")) return "seat_matrix";
  if (t.includes("schedule")) return "schedule";
  if (t.includes("result")) return "result";
  if (t.includes("vacancy")) return "vacancy";
  if (t.includes("allotment")) return "allotment";
  if (t.includes("notice")) return "notice";
  if (t.includes("admitted") || t.includes("joined candidates")) return "admitted_joined_list";
  if (t.includes("refund")) return "refund";
  if (t.includes("provisional")) return "provisional_result";
  if (t.includes("final")) return "final_result";
  return "other";
}

function makeStableKey(row) {
  return [
    row.url,
    row.pageUrl,
    row.title,
  ].join("||");
}

function dedupeRows(rows) {
  const seen = new Set();

  return rows.filter((row) => {
    const key = makeStableKey(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toCsv(rows) {
  const headers = [
    "section",
    "track",
    "year",
    "docType",
    "isDirectDocument",
    "host",
    "extension",
    "title",
    "url",
    "pageUrl",
  ];

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

function summarize(rows) {
  const bySection = {};
  const byDocType = {};
  const byTrack = {};
  const byHost = {};
  let directDocuments = 0;
  let nonDirectCandidates = 0;

  for (const row of rows) {
    bySection[row.section] = (bySection[row.section] || 0) + 1;
    byDocType[row.docType] = (byDocType[row.docType] || 0) + 1;
    byTrack[row.track] = (byTrack[row.track] || 0) + 1;
    byHost[row.host] = (byHost[row.host] || 0) + 1;

    if (row.isDirectDocument) directDocuments++;
    else nonDirectCandidates++;
  }

  return {
    totalRows: rows.length,
    directDocuments,
    nonDirectCandidates,
    bySection,
    byDocType,
    byTrack,
    byHost,
  };
}

async function main() {
  ensureDir(PARSED_DIR);

  const manifestPath = getLatestMccManifestPath();
  const manifest = readJson(manifestPath);
  const rawDir = manifest.rawDir;

  if (!rawDir || !fs.existsSync(rawDir)) {
    throw new Error(`Raw dir not found: ${rawDir}`);
  }

  const candidatePath = path.join(rawDir, "candidate_documents.json");

  if (!fs.existsSync(candidatePath)) {
    throw new Error(`candidate_documents.json not found: ${candidatePath}`);
  }

  console.log("Using manifest:", manifestPath);
  console.log("Using raw dir  :", rawDir);
  console.log("Using candidates:", candidatePath);

  const candidates = JSON.parse(fs.readFileSync(candidatePath, "utf8"));

  const rows = dedupeRows(
    candidates.map((doc) => {
      const title = normalizeText(doc.text || doc.title || "");
      const url = String(doc.url || "");
      const pageUrl = String(doc.pageUrl || "");
      const host = getHost(url);
      const extension = getExtFromUrl(url);

      return {
        section: inferSection(pageUrl),
        track: inferTrack(pageUrl, title),
        year: inferYear(title, pageUrl),
        docType: inferDocType(title),
        isDirectDocument: isDirectDocument(url),
        host,
        extension,
        title,
        url,
        pageUrl,
      };
    })
  );

  const directRows = rows.filter((r) => r.isDirectDocument);
  const summary = summarize(rows);

  const runId = path.basename(rawDir);

  const allJson = path.join(PARSED_DIR, `mcc_index_${runId}.json`);
  const allCsv = path.join(PARSED_DIR, `mcc_index_${runId}.csv`);
  const directJson = path.join(PARSED_DIR, `mcc_direct_docs_${runId}.json`);
  const directCsv = path.join(PARSED_DIR, `mcc_direct_docs_${runId}.csv`);
  const summaryJson = path.join(PARSED_DIR, `mcc_index_summary_${runId}.json`);

  writeJson(allJson, rows);
  writeText(allCsv, toCsv(rows));
  writeJson(directJson, directRows);
  writeText(directCsv, toCsv(directRows));
  writeJson(summaryJson, summary);

  console.log("\nMCC INDEX PARSE COMPLETE");
  console.log("Total candidate rows   :", rows.length);
  console.log("Direct document rows   :", directRows.length);
  console.log("All JSON               :", allJson);
  console.log("All CSV                :", allCsv);
  console.log("Direct docs JSON       :", directJson);
  console.log("Direct docs CSV        :", directCsv);
  console.log("Summary JSON           :", summaryJson);
}

main().catch((err) => {
  console.error("MCC INDEX PARSE FAILED");
  console.error(err);
  process.exit(1);
});