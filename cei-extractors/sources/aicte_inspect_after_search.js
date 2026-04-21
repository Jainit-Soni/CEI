const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "cei-extractors", "output");
const MANIFESTS_DIR = path.join(OUTPUT_DIR, "manifests");
const PARSED_DIR = path.join(OUTPUT_DIR, "parsed");

function clean(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function writeText(filePath, text) {
  fs.writeFileSync(filePath, text, "utf8");
}

function getLatestManifestPath() {
  const files = fs.readdirSync(MANIFESTS_DIR)
    .filter((name) => name.startsWith("aicte_one_state_network_") && name.endsWith(".json"))
    .sort();

  if (!files.length) {
    throw new Error("No aicte_one_state_network manifest found.");
  }

  return path.join(MANIFESTS_DIR, files[files.length - 1]);
}

function loadOptionalJson(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return readJson(filePath);
  } catch {
    return null;
  }
}

function getTableInfoFromDom(dom) {
  return (dom?.tables || []).map((t) => ({
    index: t.index,
    id: t.id || "",
    class: t.class || "",
    rowCount: t.rowCount || 0,
    columnCount: t.columnCount || 0,
    preview: t.preview || [],
  }));
}

function diffTables(beforeTables, afterTables) {
  const maxLen = Math.max(beforeTables.length, afterTables.length);
  const out = [];

  for (let i = 0; i < maxLen; i++) {
    const b = beforeTables[i] || {};
    const a = afterTables[i] || {};

    out.push({
      index: i,
      before: {
        id: b.id || "",
        class: b.class || "",
        rowCount: b.rowCount || 0,
        columnCount: b.columnCount || 0,
      },
      after: {
        id: a.id || "",
        class: a.class || "",
        rowCount: a.rowCount || 0,
        columnCount: a.columnCount || 0,
      },
      rowDelta: (a.rowCount || 0) - (b.rowCount || 0),
      colDelta: (a.columnCount || 0) - (b.columnCount || 0),
    });
  }

  return out;
}

function inspectHtml(html) {
  const $ = cheerio.load(html);

  const text = clean($("body").text());

  const messages = [];
  const messagePatterns = [
    /records found/gi,
    /no records found/gi,
    /search institutes/gi,
    /approved institute/gi,
    /approved institutes/gi,
    /data found/gi,
    /no data available/gi,
    /showing \d+ to \d+ of \d+ entries/gi,
  ];

  for (const regex of messagePatterns) {
    const matches = text.match(regex);
    if (matches) {
      for (const m of matches) messages.push(m);
    }
  }

  const tables = [];
  $("table").each((idx, tableEl) => {
    const $table = $(tableEl);
    const rows = [];

    $table.find("tr").each((_, tr) => {
      const row = [];
      $(tr).find("th,td").each((__, cell) => {
        row.push(clean($(cell).text()));
      });
      if (row.length) rows.push(row);
    });

    tables.push({
      index: idx,
      id: $table.attr("id") || "",
      class: clean($table.attr("class") || ""),
      style: clean($table.attr("style") || ""),
      rowCount: rows.length,
      columnCount: Math.max(0, ...rows.map((r) => r.length)),
      preview: rows.slice(0, 15),
    });
  });

  const hiddenContainers = [];
  $("[style*='display:none'], [style*='display: none'], [hidden]").each((idx, el) => {
    const $el = $(el);
    const nestedTables = $el.find("table").length;
    const nestedRows = $el.find("tr").length;

    hiddenContainers.push({
      index: idx,
      tag: el.tagName.toLowerCase(),
      id: $el.attr("id") || "",
      class: clean($el.attr("class") || ""),
      style: clean($el.attr("style") || ""),
      hiddenAttr: $el.is("[hidden]"),
      nestedTables,
      nestedRows,
      textPreview: clean($el.text()).slice(0, 500),
    });
  });

  const likelyTargets = [];
  $("[id], [class]").each((_, el) => {
    const $el = $(el);
    const id = $el.attr("id") || "";
    const cls = clean($el.attr("class") || "");
    const blob = `${id} ${cls}`.toLowerCase();

    if (
      blob.includes("json") ||
      blob.includes("table") ||
      blob.includes("data") ||
      blob.includes("result") ||
      blob.includes("search") ||
      blob.includes("course")
    ) {
      likelyTargets.push({
        tag: el.tagName.toLowerCase(),
        id,
        class: cls,
        style: clean($el.attr("style") || ""),
        textPreview: clean($el.text()).slice(0, 300),
      });
    }
  });

  const scripts = [];
  $("script").each((idx, el) => {
    const src = $(el).attr("src") || "";
    const inline = $(el).html() || "";
    const blob = inline.toLowerCase();

    const interesting =
      src ||
      blob.includes("datatable") ||
      blob.includes("records found") ||
      blob.includes("no records") ||
      blob.includes("json") ||
      blob.includes("jsontable") ||
      blob.includes("coursetable") ||
      blob.includes("showmessage") ||
      blob.includes("datafound");

    if (interesting) {
      scripts.push({
        index: idx,
        src,
        inlineLength: inline.length,
        preview: clean(inline).slice(0, 1500),
      });
    }
  });

  return {
    textPreview: text.slice(0, 5000),
    messages: Array.from(new Set(messages)),
    tables,
    hiddenContainers: hiddenContainers.slice(0, 100),
    likelyTargets: likelyTargets.slice(0, 100),
    scripts,
  };
}

async function main() {
  ensureDir(PARSED_DIR);

  const manifestPath = getLatestManifestPath();
  const manifest = readJson(manifestPath);
  const rawDir = manifest.rawDir;

  if (!rawDir || !fs.existsSync(rawDir)) {
    throw new Error(`Raw dir not found: ${rawDir}`);
  }

  const afterHtmlPath = path.join(rawDir, "step4_after_search.html");
  const afterTxtPath = path.join(rawDir, "step4_after_search.txt");
  const beforeDomPath = path.join(rawDir, "step3_program_selected__dom.json");
  const afterDomPath = path.join(rawDir, "step4_after_search__dom.json");
  const summaryPath = path.join(rawDir, "summary.json");
  const deltaPath = path.join(rawDir, "search_delta_responses.json");

  if (!fs.existsSync(afterHtmlPath)) {
    throw new Error(`Missing file: ${afterHtmlPath}`);
  }

  const afterHtml = fs.readFileSync(afterHtmlPath, "utf8");
  const afterTxt = fs.existsSync(afterTxtPath)
    ? fs.readFileSync(afterTxtPath, "utf8")
    : "";

  const beforeDom = loadOptionalJson(beforeDomPath);
  const afterDom = loadOptionalJson(afterDomPath);
  const summary = loadOptionalJson(summaryPath);
  const deltaResponses = loadOptionalJson(deltaPath, []);

  const beforeTables = getTableInfoFromDom(beforeDom);
  const afterTables = getTableInfoFromDom(afterDom);
  const tableDiff = diffTables(beforeTables, afterTables);

  const htmlInspection = inspectHtml(afterHtml);

  const verdict = {
    networkTriggered: Array.isArray(deltaResponses) && deltaResponses.length > 0,
    rowCountFromCurrentParser: summary?.rowCount ?? null,
    tableRowIncreaseDetected: tableDiff.some((x) => x.rowDelta > 0),
    hiddenTableRowsDetected: htmlInspection.hiddenContainers.some((x) => x.nestedRows > 0),
    recordsFoundMessagePresent: htmlInspection.messages.some((m) => /records found/i.test(m)),
    noRecordsMessagePresent: htmlInspection.messages.some((m) => /no records found/i.test(m)),
  };

  let likelyConclusion = "";
  if (verdict.recordsFoundMessagePresent && verdict.hiddenTableRowsDetected) {
    likelyConclusion = "Results likely exist in hidden DOM/table containers.";
  } else if (verdict.recordsFoundMessagePresent && !verdict.tableRowIncreaseDetected) {
    likelyConclusion = "Results may be rendered in a non-table structure or inside a JS-managed wrapper.";
  } else if (verdict.noRecordsMessagePresent) {
    likelyConclusion = "This exact filter combination appears to show an empty result state.";
  } else if (!verdict.networkTriggered) {
    likelyConclusion = "Search is likely client-side within already loaded HTML/JS state.";
  } else {
    likelyConclusion = "Need to inspect the saved after-search HTML structure more closely.";
  }

  const runId = path.basename(rawDir);
  const outJson = path.join(PARSED_DIR, `aicte_after_search_inspection_${runId}.json`);
  const outTxt = path.join(PARSED_DIR, `aicte_after_search_inspection_${runId}.txt`);

  const result = {
    manifestPath,
    rawDir,
    files: {
      afterHtmlPath,
      afterTxtPath,
      beforeDomPath,
      afterDomPath,
      summaryPath,
      deltaPath,
    },
    summary,
    deltaResponsesCount: Array.isArray(deltaResponses) ? deltaResponses.length : 0,
    verdict,
    likelyConclusion,
    tableDiff,
    htmlInspection,
    visibleTextPreview: clean(afterTxt).slice(0, 5000),
  };

  writeJson(outJson, result);

  const lines = [];
  lines.push(`Manifest: ${manifestPath}`);
  lines.push(`Raw Dir : ${rawDir}`);
  lines.push("");
  lines.push(`Delta responses: ${result.deltaResponsesCount}`);
  lines.push(`Parser rows    : ${summary?.rowCount ?? "(unknown)"}`);
  lines.push(`Conclusion     : ${likelyConclusion}`);
  lines.push("");
  lines.push("Verdict:");
  lines.push(`- networkTriggered=${verdict.networkTriggered}`);
  lines.push(`- tableRowIncreaseDetected=${verdict.tableRowIncreaseDetected}`);
  lines.push(`- hiddenTableRowsDetected=${verdict.hiddenTableRowsDetected}`);
  lines.push(`- recordsFoundMessagePresent=${verdict.recordsFoundMessagePresent}`);
  lines.push(`- noRecordsMessagePresent=${verdict.noRecordsMessagePresent}`);
  lines.push("");
  lines.push("Messages:");
  for (const msg of htmlInspection.messages) {
    lines.push(`- ${msg}`);
  }
  lines.push("");
  lines.push("Table diff:");
  for (const row of tableDiff.slice(0, 20)) {
    lines.push(
      `- index=${row.index} | beforeRows=${row.before.rowCount} | afterRows=${row.after.rowCount} | rowDelta=${row.rowDelta} | afterId=${row.after.id || "(blank)"} | afterClass=${row.after.class || "(blank)"}`
    );
  }
  lines.push("");
  lines.push("After-search tables:");
  for (const t of htmlInspection.tables.slice(0, 20)) {
    lines.push(
      `- table#${t.index} | id=${t.id || "(blank)"} | class=${t.class || "(blank)"} | rows=${t.rowCount} | cols=${t.columnCount}`
    );
  }
  lines.push("");
  lines.push("Hidden containers with rows/tables:");
  for (const h of htmlInspection.hiddenContainers.slice(0, 20)) {
    lines.push(
      `- tag=${h.tag} | id=${h.id || "(blank)"} | class=${h.class || "(blank)"} | nestedTables=${h.nestedTables} | nestedRows=${h.nestedRows}`
    );
    lines.push(`  text=${h.textPreview}`);
  }
  lines.push("");
  lines.push("Likely targets:");
  for (const t of htmlInspection.likelyTargets.slice(0, 30)) {
    lines.push(`- ${t.tag} | id=${t.id || "(blank)"} | class=${t.class || "(blank)"}`);
    lines.push(`  text=${t.textPreview}`);
  }
  lines.push("");
  lines.push("Script hints:");
  for (const s of htmlInspection.scripts.slice(0, 20)) {
    lines.push(`- script#${s.index} | src=${s.src || "(inline)"} | inlineLength=${s.inlineLength}`);
    if (s.preview) lines.push(`  preview=${s.preview}`);
  }
  lines.push("");
  lines.push("Visible text preview:");
  lines.push(result.visibleTextPreview);

  writeText(outTxt, lines.join("\n"));

  console.log("\nAICTE AFTER-SEARCH INSPECTION COMPLETE");
  console.log("Inspection JSON :", outJson);
  console.log("Inspection TXT  :", outTxt);
}

main().catch((err) => {
  console.error("AICTE AFTER-SEARCH INSPECTION FAILED");
  console.error(err);
  process.exit(1);
});