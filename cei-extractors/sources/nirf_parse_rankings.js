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

const STATE_NAMES = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Pondicherry",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
].sort((a, b) => b.length - a.length);

function getLatestNirfManifestPath() {
  const files = listFiles(MANIFESTS_DIR)
    .filter((name) => name.startsWith("nirf_") && name.endsWith(".json"))
    .sort();

  if (files.length === 0) {
    throw new Error("No NIRF manifest found.");
  }

  return path.join(MANIFESTS_DIR, files[files.length - 1]);
}

function normalizeText(text) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function inferCategoryFromFileName(fileName) {
  const n = fileName.toLowerCase();

  if (n.includes("overall")) return "overall";
  if (n.includes("university")) return "university";
  if (n.includes("college")) return "college";
  if (n.includes("research")) return "research";
  if (n.includes("engineering")) return "engineering";
  if (n.includes("management")) return "management";
  if (n.includes("pharmacy")) return "pharmacy";
  if (n.includes("medical")) return "medical";
  if (n.includes("dental")) return "dental";
  if (n.includes("law")) return "law";
  if (n.includes("architecture")) return "architecture";
  if (n.includes("agriculture")) return "agriculture";
  if (n.includes("innovation")) return "innovation";
  if (n.includes("openuniversity")) return "open_university";
  if (n.includes("skilluniversity")) return "skill_university";
  if (n.includes("statepublicuniversity")) return "state_public_university";

  return "unknown";
}

function isMainRankingTextFile(fileName) {
  const lower = fileName.toLowerCase();

  if (!lower.endsWith(".txt")) return false;
  if (lower === "ranking.txt") return false;
  if (!lower.includes("ranking")) return false;
  if (/\d+\.txt$/i.test(lower)) return false; // skip band pages for now

  return true;
}

function splitCityState(prefix) {
  const clean = prefix.trim();

  for (const state of STATE_NAMES) {
    if (clean.toLowerCase().endsWith(state.toLowerCase())) {
      const city = clean.slice(0, clean.length - state.length).trim();
      return { city, state };
    }
  }

  return { city: clean, state: "" };
}

function parseLocationScoreRankLine(line) {
  const m = line.match(/^(.*?)\s+(\d+\.\d+)\s+(\d+)$/);
  if (!m) return null;

  const locationPart = m[1].trim();
  const score = Number(m[2]);
  const rank = Number(m[3]);

  const { city, state } = splitCityState(locationPart);
  if (!city || !state) return null;

  return { city, state, score, rank };
}

function parseMainRankingText(text, sourceFile) {
  const lines = normalizeText(text)
    .split("\n")
    .map((x) => normalizeText(x))
    .filter(Boolean);

  const category = inferCategoryFromFileName(sourceFile);
  const rows = [];
  const debug = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!/^IR-[A-Z0-9-]+\s+/i.test(line)) continue;

    const head = line.match(/^(IR-[A-Z0-9-]+)\s+(.+)$/i);
    if (!head) continue;

    const instituteId = head[1].trim();
    const instituteName = head[2].trim();

    let j = i + 1;
    const block = [];

    while (j < lines.length && !/^IR-[A-Z0-9-]+\s+/i.test(lines[j])) {
      block.push(lines[j]);
      j++;
    }

    const hasMoreDetails = block.some((x) => /More Details/i.test(x));
    if (!hasMoreDetails) {
      debug.push({
        reason: "skip_no_more_details",
        instituteId,
        instituteName,
        sample: block.slice(0, 10),
      });
      continue;
    }

    let parsedTail = null;
    for (const blockLine of block) {
      const parsed = parseLocationScoreRankLine(blockLine);
      if (parsed) parsedTail = parsed;
    }

    if (!parsedTail) {
      debug.push({
        reason: "skip_no_location_score_rank",
        instituteId,
        instituteName,
        sample: block.slice(0, 15),
      });
      continue;
    }

    rows.push({
      category,
      pageType: "main_ranking",
      instituteId,
      instituteName,
      city: parsedTail.city,
      state: parsedTail.state,
      score: parsedTail.score,
      rank: parsedTail.rank,
      sourceFile,
    });

    i = j - 1;
  }

  return { category, rows, debug, totalLines: lines.length };
}

function dedupeRows(rows) {
  const seen = new Set();

  return rows.filter((row) => {
    const key = [row.category, row.rank, row.instituteId].join("||");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function toCsv(rows) {
  const headers = [
    "category",
    "pageType",
    "rank",
    "score",
    "instituteId",
    "instituteName",
    "city",
    "state",
    "sourceFile",
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

async function main() {
  ensureDir(PARSED_DIR);

  const manifestPath = getLatestNirfManifestPath();
  const manifest = readJson(manifestPath);
  const rawDir = manifest.rawDir;

  if (!rawDir || !fs.existsSync(rawDir)) {
    throw new Error(`Raw dir not found: ${rawDir}`);
  }

  console.log("Using manifest:", manifestPath);
  console.log("Using raw dir  :", rawDir);

  const txtFiles = listFiles(rawDir)
    .filter(isMainRankingTextFile)
    .sort();

  const allRows = [];
  const pageSummaries = [];

  for (const fileName of txtFiles) {
    const filePath = path.join(rawDir, fileName);
    const text = fs.readFileSync(filePath, "utf8");
    const parsed = parseMainRankingText(text, fileName);

    pageSummaries.push({
      fileName,
      category: parsed.category,
      rows: parsed.rows.length,
      totalLines: parsed.totalLines,
    });

    const debugPath = path.join(
      PARSED_DIR,
      `debug_${fileName.replace(/\.txt$/i, "")}.json`
    );
    writeJson(debugPath, parsed.debug);

    allRows.push(...parsed.rows);
    console.log(`Parsed ${fileName} -> ${parsed.rows.length} rows`);
  }

  const finalRows = dedupeRows(allRows).sort((a, b) => {
    const c = String(a.category).localeCompare(String(b.category));
    if (c !== 0) return c;
    return Number(a.rank || 999999) - Number(b.rank || 999999);
  });

  const summary = {
    manifestPath,
    rawDir,
    textFilesParsed: txtFiles.length,
    totalRowsBeforeDedupe: allRows.length,
    totalRowsAfterDedupe: finalRows.length,
    pages: pageSummaries,
    note: "Parses main ranking text files only. Rank-band pages intentionally skipped.",
  };

  const runId = path.basename(rawDir);
  const jsonPath = path.join(PARSED_DIR, `nirf_rankings_${runId}.json`);
  const csvPath = path.join(PARSED_DIR, `nirf_rankings_${runId}.csv`);
  const summaryPath = path.join(PARSED_DIR, `nirf_rankings_summary_${runId}.json`);

  writeJson(jsonPath, finalRows);
  writeText(csvPath, toCsv(finalRows));
  writeJson(summaryPath, summary);

  console.log("\nNIRF TEXT PARSE COMPLETE");
  console.log("TXT files parsed      :", txtFiles.length);
  console.log("Rows before dedupe    :", allRows.length);
  console.log("Rows after dedupe     :", finalRows.length);
  console.log("JSON output           :", jsonPath);
  console.log("CSV output            :", csvPath);
  console.log("Summary output        :", summaryPath);
}

main().catch((err) => {
  console.error("NIRF PARSE FAILED");
  console.error(err);
  process.exit(1);
});