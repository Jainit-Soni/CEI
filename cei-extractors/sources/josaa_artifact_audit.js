const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "cei-extractors", "output");
const RAW_DIR = path.join(OUTPUT_DIR, "raw");
const PARSED_DIR = path.join(OUTPUT_DIR, "parsed");
const MANIFESTS_DIR = path.join(OUTPUT_DIR, "manifests");

function clean(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function exists(filePath) {
  return fs.existsSync(filePath);
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function rel(filePath) {
  return path.relative(ROOT, filePath);
}

function normalizeSlashes(value) {
  return String(value || "").replace(/\\/g, "/");
}

function basenameNoExt(filePath) {
  return path.basename(filePath, path.extname(filePath));
}

function statSafe(filePath) {
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function writeText(filePath, text) {
  fs.writeFileSync(filePath, text, "utf8");
}

function readTextSafe(filePath, maxChars = 5000) {
  try {
    return fs.readFileSync(filePath, "utf8").slice(0, maxChars);
  } catch {
    return "";
  }
}

function listFilesRecursive(dirPath) {
  const out = [];
  if (!exists(dirPath)) return out;

  const stack = [dirPath];

  while (stack.length) {
    const current = stack.pop();
    let items = [];
    try {
      items = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const item of items) {
      const fullPath = path.join(current, item.name);
      if (item.isDirectory()) {
        stack.push(fullPath);
      } else if (item.isFile()) {
        out.push(fullPath);
      }
    }
  }

  return out;
}

function isJosaaPath(filePath) {
  const p = normalizeSlashes(filePath).toLowerCase();
  return (
    p.includes("josaa") ||
    p.includes("orcr") ||
    p.includes("seatmatrix") ||
    p.includes("seat_matrix") ||
    p.includes("round1_cfi")
  );
}

function detectArtifactKind(filePath) {
  const name = basenameNoExt(filePath).toLowerCase();
  const full = normalizeSlashes(filePath).toLowerCase();

  if (name.includes("round1_cfi_normalized")) return "cutoff_normalized";
  if (name.includes("normalized") && name.includes("orcr")) return "cutoff_normalized";
  if (name.includes("current_orcr")) return "cutoff_current_orcr";
  if (name.includes("orcr_sample")) return "cutoff_sample";
  if (name.includes("orcr")) return "cutoff_other";

  if (name.includes("seat_matrix")) return "seat_matrix";
  if (name.includes("seatmatrix")) return "seat_matrix";

  if (name.includes("inventory")) return "inventory";
  if (name.includes("progress")) return "progress";
  if (name.includes("report")) return "report";
  if (name.includes("manifest")) return "manifest";
  if (name.includes("probe")) return "probe";
  if (name.includes("sample")) return "sample";

  if (full.includes("seatmatrix")) return "seat_matrix";
  if (full.includes("orcr")) return "cutoff_other";
  if (full.includes("josaa")) return "josaa_other";

  return "other";
}

function inferRowCountFromCsvText(text) {
  if (!text) return 0;
  const lines = text.split(/\r?\n/).filter((line) => clean(line));
  return Math.max(0, lines.length - 1);
}

function summarizeJson(value) {
  if (Array.isArray(value)) {
    const first = value[0];
    return {
      json_type: "array",
      row_count: value.length,
      sample_keys:
        first && typeof first === "object" && !Array.isArray(first)
          ? Object.keys(first).slice(0, 25)
          : [],
    };
  }

  if (value && typeof value === "object") {
    const keys = Object.keys(value);
    const arrayFields = keys
      .map((key) => ({
        key,
        length: Array.isArray(value[key]) ? value[key].length : null,
      }))
      .filter((x) => x.length != null)
      .sort((a, b) => b.length - a.length);

    return {
      json_type: "object",
      key_count: keys.length,
      top_level_keys: keys.slice(0, 30),
      array_fields: arrayFields.slice(0, 20),
      inferred_row_count: arrayFields.length ? arrayFields[0].length : 0,
    };
  }

  return {
    json_type: typeof value,
  };
}

function summarizeFile(filePath) {
  const stats = statSafe(filePath);
  const ext = path.extname(filePath).toLowerCase();

  const summary = {
    path: filePath,
    rel_path: rel(filePath),
    file_name: path.basename(filePath),
    artifact_kind: detectArtifactKind(filePath),
    ext,
    size_bytes: stats ? stats.size : 0,
    mtime_iso: stats ? stats.mtime.toISOString() : "",
    row_count: 0,
  };

  if (ext === ".json") {
    const parsed = readJsonSafe(filePath);
    summary.json_summary = summarizeJson(parsed);
    summary.row_count =
      summary.json_summary.row_count ??
      summary.json_summary.inferred_row_count ??
      0;
  } else if (ext === ".csv") {
    const text = readTextSafe(filePath);
    summary.csv_preview = clean(text).slice(0, 1000);
    summary.row_count = inferRowCountFromCsvText(text);
  } else if (ext === ".txt" || ext === ".md" || ext === ".log" || ext === ".html") {
    const text = readTextSafe(filePath);
    summary.text_preview = clean(text).slice(0, 1000);
    summary.row_count = 0;
  }

  return summary;
}

function candidateScore(fileSummary) {
  const rowScore = (fileSummary.row_count || 0) * 1000;
  const sizeScore = fileSummary.size_bytes || 0;
  let bonus = 0;

  if (fileSummary.artifact_kind === "cutoff_normalized") bonus += 100000000;
  if (fileSummary.artifact_kind === "seat_matrix") bonus += 90000000;
  if (fileSummary.artifact_kind === "inventory") bonus += 80000000;
  if (fileSummary.artifact_kind === "cutoff_current_orcr") bonus += 70000000;
  if (fileSummary.artifact_kind === "progress") bonus += 20000000;

  if (fileSummary.ext === ".json") bonus += 5000000;
  if (fileSummary.ext === ".csv") bonus += 3000000;
  if (fileSummary.ext === ".txt") bonus -= 1000000;
  if (fileSummary.ext === ".html") bonus -= 2000000;

  return rowScore + sizeScore + bonus;
}

function chooseBest(files, predicate) {
  const candidates = files.filter(predicate).sort((a, b) => {
    const diff = candidateScore(b) - candidateScore(a);
    if (diff !== 0) return diff;
    return String(b.mtime_iso).localeCompare(String(a.mtime_iso));
  });

  return candidates[0] || null;
}

function topCandidates(files, predicate, limit = 10) {
  return files
    .filter(predicate)
    .sort((a, b) => {
      const diff = candidateScore(b) - candidateScore(a);
      if (diff !== 0) return diff;
      return String(b.mtime_iso).localeCompare(String(a.mtime_iso));
    })
    .slice(0, limit);
}

function buildStatus(best) {
  if (!best) {
    return {
      status: "missing",
      confidence: "none",
      reason: "No artifact found.",
    };
  }

  if ((best.row_count || 0) > 0) {
    return {
      status: "usable",
      confidence:
        best.artifact_kind === "cutoff_normalized" ||
        best.artifact_kind === "seat_matrix" ||
        best.artifact_kind === "inventory"
          ? "high"
          : "medium",
      reason: `Found ${best.artifact_kind} with row_count=${best.row_count}.`,
    };
  }

  return {
    status: "found_but_empty",
    confidence: "low",
    reason: `Found ${best.artifact_kind} but row_count=${best.row_count || 0}.`,
  };
}

function buildTxtReport(report) {
  const lines = [];

  lines.push("JoSAA Artifact Audit");
  lines.push(`Generated at: ${report.generated_at}`);
  lines.push(`Root: ${report.root}`);
  lines.push("");

  lines.push("Summary:");
  lines.push(`- Total JoSAA-related files found: ${report.summary.total_josaa_related_files}`);
  lines.push(`- Manifest count: ${report.summary.manifest_count}`);
  lines.push(`- Parsed file count: ${report.summary.parsed_count}`);
  lines.push(`- Raw file count: ${report.summary.raw_count}`);
  lines.push("");

  lines.push("Best artifact candidates:");
  lines.push(
    `- Cutoff/ORCR: ${report.best.cutoff ? `${report.best.cutoff.rel_path} | rows=${report.best.cutoff.row_count}` : "(missing)"}`
  );
  lines.push(
    `- Seat matrix: ${report.best.seat_matrix ? `${report.best.seat_matrix.rel_path} | rows=${report.best.seat_matrix.row_count}` : "(missing)"}`
  );
  lines.push(
    `- Inventory: ${report.best.inventory ? `${report.best.inventory.rel_path} | rows=${report.best.inventory.row_count}` : "(missing)"}`
  );
  lines.push("");

  lines.push("Import readiness:");
  lines.push(
    `- Cutoff/ORCR: ${report.readiness.cutoff.status} | confidence=${report.readiness.cutoff.confidence} | ${report.readiness.cutoff.reason}`
  );
  lines.push(
    `- Seat matrix: ${report.readiness.seat_matrix.status} | confidence=${report.readiness.seat_matrix.confidence} | ${report.readiness.seat_matrix.reason}`
  );
  lines.push(
    `- Inventory: ${report.readiness.inventory.status} | confidence=${report.readiness.inventory.confidence} | ${report.readiness.inventory.reason}`
  );
  lines.push("");

  lines.push("Manifest files:");
  for (const row of report.manifests.slice(0, 50)) {
    lines.push(`- ${row.rel_path}`);
  }

  lines.push("");
  lines.push("Top cutoff candidates:");
  for (const row of report.candidates.cutoff) {
    lines.push(
      `- ${row.rel_path} | kind=${row.artifact_kind} | ext=${row.ext} | rows=${row.row_count || 0} | size=${row.size_bytes || 0}`
    );
  }

  lines.push("");
  lines.push("Top seat matrix candidates:");
  for (const row of report.candidates.seat_matrix) {
    lines.push(
      `- ${row.rel_path} | kind=${row.artifact_kind} | ext=${row.ext} | rows=${row.row_count || 0} | size=${row.size_bytes || 0}`
    );
  }

  lines.push("");
  lines.push("Top inventory candidates:");
  for (const row of report.candidates.inventory) {
    lines.push(
      `- ${row.rel_path} | kind=${row.artifact_kind} | ext=${row.ext} | rows=${row.row_count || 0} | size=${row.size_bytes || 0}`
    );
  }

  lines.push("");
  lines.push("Top parsed/raw artifacts overall:");
  for (const row of report.files_sorted.slice(0, 100)) {
    lines.push(
      `- ${row.rel_path} | kind=${row.artifact_kind} | ext=${row.ext} | rows=${row.row_count || 0} | size=${row.size_bytes || 0}`
    );
  }

  return lines.join("\n");
}

async function main() {
  console.log("Scanning:", OUTPUT_DIR);

  const manifestFiles = listFilesRecursive(MANIFESTS_DIR).filter(isJosaaPath);
  const parsedFiles = listFilesRecursive(PARSED_DIR).filter(isJosaaPath);
  const rawFiles = listFilesRecursive(RAW_DIR).filter(isJosaaPath);

  const allFiles = [...manifestFiles, ...parsedFiles, ...rawFiles];
  const uniqueFiles = Array.from(new Set(allFiles));

  const fileSummaries = uniqueFiles.map(summarizeFile);

  const cutoffPredicate = (f) =>
    ["cutoff_normalized", "cutoff_current_orcr", "cutoff_sample", "cutoff_other", "progress"].includes(
      f.artifact_kind
    ) && [".json", ".csv", ".txt"].includes(f.ext);

  const seatPredicate = (f) =>
    f.artifact_kind === "seat_matrix" && [".json", ".csv", ".txt"].includes(f.ext);

  const inventoryPredicate = (f) =>
    f.artifact_kind === "inventory" && [".json", ".csv", ".txt"].includes(f.ext);

  const bestCutoff = chooseBest(fileSummaries, cutoffPredicate);
  const bestSeatMatrix = chooseBest(fileSummaries, seatPredicate);
  const bestInventory = chooseBest(fileSummaries, inventoryPredicate);

  const report = {
    generated_at: new Date().toISOString(),
    root: ROOT,
    summary: {
      total_josaa_related_files: fileSummaries.length,
      manifest_count: manifestFiles.length,
      parsed_count: parsedFiles.length,
      raw_count: rawFiles.length,
    },
    manifests: manifestFiles.map((p) => ({
      path: p,
      rel_path: rel(p),
    })),
    best: {
      cutoff: bestCutoff,
      seat_matrix: bestSeatMatrix,
      inventory: bestInventory,
    },
    readiness: {
      cutoff: buildStatus(bestCutoff),
      seat_matrix: buildStatus(bestSeatMatrix),
      inventory: buildStatus(bestInventory),
    },
    candidates: {
      cutoff: topCandidates(fileSummaries, cutoffPredicate, 15),
      seat_matrix: topCandidates(fileSummaries, seatPredicate, 15),
      inventory: topCandidates(fileSummaries, inventoryPredicate, 15),
    },
    files_sorted: fileSummaries
      .slice()
      .sort((a, b) => {
        const diff = candidateScore(b) - candidateScore(a);
        if (diff !== 0) return diff;
        return String(b.mtime_iso).localeCompare(String(a.mtime_iso));
      }),
  };

  ensureDir(PARSED_DIR);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const jsonPath = path.join(PARSED_DIR, `josaa_artifact_audit_${stamp}.json`);
  const txtPath = path.join(PARSED_DIR, `josaa_artifact_audit_${stamp}.txt`);

  writeJson(jsonPath, report);
  writeText(txtPath, buildTxtReport(report));

  console.log("\nJOSAA ARTIFACT AUDIT COMPLETE");
  console.log("JSON report :", jsonPath);
  console.log("TXT report  :", txtPath);
  console.log(
    "Best cutoff :",
    bestCutoff ? `${bestCutoff.rel_path} | rows=${bestCutoff.row_count || 0}` : "(missing)"
  );
  console.log(
    "Best seat   :",
    bestSeatMatrix ? `${bestSeatMatrix.rel_path} | rows=${bestSeatMatrix.row_count || 0}` : "(missing)"
  );
  console.log(
    "Best inv    :",
    bestInventory ? `${bestInventory.rel_path} | rows=${bestInventory.row_count || 0}` : "(missing)"
  );
}

main().catch((err) => {
  console.error("JOSAA ARTIFACT AUDIT FAILED");
  console.error(err);
  process.exit(1);
});