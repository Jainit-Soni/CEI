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

function safeReadJson(filePath, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function normalizeHeader(text, index) {
  const base = clean(text)
    .toLowerCase()
    .replace(/[^\w]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return base || `col_${index + 1}`;
}

function chooseBestTable(tables) {
  const scored = (tables || []).map((t) => {
    const headers = (t.headers || []).map((h) => clean(h).toLowerCase());
    const blob = `${headers.join(" ")} ${(t.rowsPreview || []).flat().join(" ")}`.toLowerCase();

    let score = 0;

    if ((t.purpose || "") === "approved_institutes_listing") score += 30;
    if (headers.includes("institute")) score += 12;
    if (headers.includes("state")) score += 10;
    if (blob.includes("institute")) score += 8;
    if (blob.includes("state")) score += 6;
    if (blob.includes("program")) score += 4;
    if (blob.includes("course")) score += 4;
    if ((t.rowCount || 0) > 1) score += 6;
    if ((t.columnCount || 0) >= 3) score += 4;

    return { ...t, score };
  });

  scored.sort((a, b) => b.score - a.score || (b.rowCount || 0) - (a.rowCount || 0));
  return scored[0] || null;
}

function tableToObjects(table) {
  if (!table || !Array.isArray(table.rows) || table.rows.length < 2) {
    return [];
  }

  let headerRowIndex = -1;
  for (let i = 0; i < table.rows.length; i++) {
    const row = table.rows[i] || [];
    const nonBlank = row.filter((x) => clean(x)).length;
    if (nonBlank >= 2) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) return [];

  const headers = (table.rows[headerRowIndex] || []).map((cell, idx) =>
    normalizeHeader(cell, idx)
  );

  const out = [];
  for (let i = headerRowIndex + 1; i < table.rows.length; i++) {
    const row = table.rows[i] || [];
    if (!row.some((x) => clean(x))) continue;

    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = clean(row[idx] || "");
    });

    out.push(obj);
  }

  return out;
}

function dedupeRows(rows) {
  const seen = new Set();

  return rows.filter((row) => {
    const key = JSON.stringify(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rowsToCsv(rows) {
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

function summarizeRows(rows) {
  const byState = {};
  const byInstitution = {};

  for (const row of rows) {
    const state =
      clean(row.state) ||
      clean(row.state_name) ||
      clean(row.col_3) ||
      "(blank)";

    const institute =
      clean(row.institute) ||
      clean(row.institute_name) ||
      clean(row.name) ||
      clean(row.col_2) ||
      "(blank)";

    byState[state] = (byState[state] || 0) + 1;
    byInstitution[institute] = (byInstitution[institute] || 0) + 1;
  }

  const topN = (obj, n = 25) =>
    Object.entries(obj)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, n)
      .map(([key, count]) => ({ key, count }));

  return {
    totalRows: rows.length,
    topStates: topN(byState),
    topInstitutions: topN(byInstitution),
  };
}

async function main() {
  ensureDir(PARSED_DIR);

  const manifestPath = getLatestAicteProbeManifestPath();
  const manifest = readJson(manifestPath);
  const rawDir = manifest.rawDir;

  if (!rawDir || !fs.existsSync(rawDir)) {
    throw new Error(`Raw dir not found: ${rawDir}`);
  }

  const runId = path.basename(rawDir);

  const tablesPath = path.join(PARSED_DIR, `aicte_approvedinstitutes_tables_${runId}.json`);
  const selectsPath = path.join(PARSED_DIR, `aicte_approvedinstitutes_selects_${runId}.json`);
  const formsPath = path.join(PARSED_DIR, `aicte_approvedinstitutes_forms_${runId}.json`);
  const controlsPath = path.join(PARSED_DIR, `aicte_approvedinstitutes_controls_${runId}.json`);
  const scriptsPath = path.join(PARSED_DIR, `aicte_approvedinstitutes_scripts_${runId}.json`);
  const summaryPath = path.join(PARSED_DIR, `aicte_approvedinstitutes_summary_${runId}.json`);

  const tables = safeReadJson(tablesPath, []);
  const selects = safeReadJson(selectsPath, []);
  const forms = safeReadJson(formsPath, []);
  const controls = safeReadJson(controlsPath, []);
  const scripts = safeReadJson(scriptsPath, []);
  const summary = safeReadJson(summaryPath, {});

  console.log("Using manifest:", manifestPath);
  console.log("Using raw dir  :", rawDir);
  console.log("Using tables   :", tablesPath);

  const bestTable = chooseBestTable(tables);
  const extractedRowsRaw = tableToObjects(bestTable);
  const extractedRows = dedupeRows(extractedRowsRaw);

  const rowsJsonPath = path.join(PARSED_DIR, `aicte_approvedinstitutes_rows_${runId}.json`);
  const rowsCsvPath = path.join(PARSED_DIR, `aicte_approvedinstitutes_rows_${runId}.csv`);
  const decisionJsonPath = path.join(PARSED_DIR, `aicte_approvedinstitutes_decision_${runId}.json`);
  const reportTxtPath = path.join(PARSED_DIR, `aicte_approvedinstitutes_next_report_${runId}.txt`);

  const decision = {
    manifestPath,
    rawDir,
    runId,
    bestTable: bestTable
      ? {
          index: bestTable.index,
          id: bestTable.id,
          class: bestTable.class,
          rowCount: bestTable.rowCount,
          columnCount: bestTable.columnCount,
          purpose: bestTable.purpose,
          headers: bestTable.headers,
          score: bestTable.score,
        }
      : null,
    extractedRowCount: extractedRows.length,
    likelyDataTables: !!summary.likelyDataTables,
    likelyServerSideDataTables: !!summary.likelyServerSideDataTables,
    likelyAjaxInScripts: !!summary.likelyAjaxInScripts,
    selectsCount: (selects || []).length,
    formsCount: (forms || []).length,
    controlsCount: (controls || []).length,
    nextAction:
      extractedRows.length > 0
        ? "approvedinstitutes fragment already contains extractable listing rows"
        : "no listing rows extracted; next step should probe controls/selects to trigger deeper data load",
    rowSummary: summarizeRows(extractedRows),
    topSelects: (selects || []).slice(0, 20),
    topControls: (summary.likelyActions || []).slice(0, 20),
    scriptHints: (summary.scriptSummary || []).slice(0, 20),
  };

  writeJson(rowsJsonPath, extractedRows);
  writeText(rowsCsvPath, rowsToCsv(extractedRows));
  writeJson(decisionJsonPath, decision);

  const lines = [];
  lines.push(`Manifest: ${manifestPath}`);
  lines.push(`Raw Dir : ${rawDir}`);
  lines.push(`Run ID  : ${runId}`);
  lines.push("");
  lines.push(`Extracted rows: ${extractedRows.length}`);
  lines.push(`DataTables detected    : ${decision.likelyDataTables}`);
  lines.push(`Server-side DataTables : ${decision.likelyServerSideDataTables}`);
  lines.push(`Ajax in scripts        : ${decision.likelyAjaxInScripts}`);
  lines.push("");
  lines.push("Best table:");
  if (decision.bestTable) {
    lines.push(`- index=${decision.bestTable.index}`);
    lines.push(`  purpose=${decision.bestTable.purpose}`);
    lines.push(`  rows=${decision.bestTable.rowCount} | cols=${decision.bestTable.columnCount} | score=${decision.bestTable.score}`);
    lines.push(`  id=${decision.bestTable.id || "(blank)"} | class=${decision.bestTable.class || "(blank)"}`);
    lines.push(`  headers=${(decision.bestTable.headers || []).join(" | ")}`);
  } else {
    lines.push("- none");
  }
  lines.push("");

  lines.push("Top selects:");
  for (const s of decision.topSelects.slice(0, 10)) {
    lines.push(`- select#${s.index} | id=${s.id || "(blank)"} | name=${s.name || "(blank)"} | options=${s.optionCount}`);
    for (const opt of (s.options || []).slice(0, 10)) {
      lines.push(`    * value="${opt.value}" | text="${opt.text}"`);
    }
  }
  lines.push("");

  lines.push("Top likely controls:");
  for (const c of decision.topControls.slice(0, 15)) {
    lines.push(`- score=${c.score} | tag=${c.tag} | text=${c.text || "(blank)"}`);
    lines.push(`  id=${c.id || "(blank)"} | name=${c.name || "(blank)"} | href=${c.href || "(blank)"}`);
    lines.push(`  onclick=${c.onclick || "(blank)"}`);
  }
  lines.push("");

  lines.push("Row summary:");
  lines.push(`- totalRows=${decision.rowSummary.totalRows}`);
  for (const item of decision.rowSummary.topStates.slice(0, 15)) {
    lines.push(`  state: ${item.key} -> ${item.count}`);
  }
  lines.push("");

  if (!extractedRows.length) {
    lines.push("Decision:");
    lines.push("- The fragment did not yield direct listing rows.");
    lines.push("- Next step should be an interaction probe that manipulates the fragment controls.");
    lines.push("- Most likely targets are institute / course / program related controls and DataTables triggers.");
  }

  writeText(reportTxtPath, lines.join("\n"));

  console.log("\nAICTE APPROVEDINSTITUTES V1 COMPLETE");
  console.log("Extracted rows        :", extractedRows.length);
  console.log("Rows JSON             :", rowsJsonPath);
  console.log("Rows CSV              :", rowsCsvPath);
  console.log("Decision JSON         :", decisionJsonPath);
  console.log("Next report TXT       :", reportTxtPath);
}

main().catch((err) => {
  console.error("AICTE APPROVEDINSTITUTES V1 FAILED");
  console.error(err);
  process.exit(1);
});