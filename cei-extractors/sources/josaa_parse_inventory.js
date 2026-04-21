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

function getLatestJosaaManifestPath() {
  const files = listFiles(MANIFESTS_DIR)
    .filter((name) => name.startsWith("josaa_") && name.endsWith(".json"))
    .sort();

  if (files.length === 0) {
    throw new Error("No JOSAA manifest found.");
  }

  return path.join(MANIFESTS_DIR, files[files.length - 1]);
}

function normalizeText(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function summarizeSelects(selects) {
  return selects.map((sel) => {
    const cleanedOptions = (sel.options || []).map((opt) => ({
      value: normalizeText(opt.value),
      text: normalizeText(opt.text),
    }));

    const nonBlankOptions = cleanedOptions.filter(
      (opt) => opt.value || opt.text
    );

    return {
      index: sel.index,
      id: sel.id || "",
      name: sel.name || "",
      optionCount: cleanedOptions.length,
      nonBlankOptionCount: nonBlankOptions.length,
      first20Options: nonBlankOptions.slice(0, 20),
    };
  });
}

function summarizeAnchors(anchors) {
  const cleaned = anchors.map((a) => ({
    url: a.url || "",
    text: normalizeText(a.text),
    title: normalizeText(a.title),
    onclick: a.onclick || "",
  }));

  const interesting = cleaned.filter((a) => {
    const blob = `${a.url} ${a.text} ${a.title} ${a.onclick}`.toLowerCase();
    return (
      blob.includes("or-cr") ||
      blob.includes("opening") ||
      blob.includes("closing") ||
      blob.includes("seat matrix") ||
      blob.includes("seatmatrix") ||
      blob.includes("view") ||
      blob.includes("download") ||
      blob.includes("business rule") ||
      blob.includes("schedule")
    );
  });

  return {
    totalAnchors: cleaned.length,
    interestingAnchors: interesting.length,
    first50Interesting: interesting.slice(0, 50),
  };
}

function detectPageKind(fileName) {
  const lower = fileName.toLowerCase();

  if (lower.includes("currentorcr")) return "current_orcr";
  if (lower.includes("seatmatrixinfo")) return "seat_matrix";
  if (lower.includes("josaa_nic_in__or-cr")) return "public_orcr_index";
  if (lower.includes("josaa_nic_in__archive")) return "archive";
  if (lower.includes("josaa_nic_in__news-event")) return "news_event";

  return "other";
}

async function main() {
  ensureDir(PARSED_DIR);

  const manifestPath = getLatestJosaaManifestPath();
  const manifest = readJson(manifestPath);
  const rawDir = manifest.rawDir;

  if (!rawDir || !fs.existsSync(rawDir)) {
    throw new Error(`Raw dir not found: ${rawDir}`);
  }

  console.log("Using manifest:", manifestPath);
  console.log("Using raw dir  :", rawDir);

  const files = listFiles(rawDir).sort();

  const selectFiles = files.filter((f) => f.endsWith("__selects.json"));
  const anchorFiles = files.filter((f) => f.endsWith("__anchors.json"));
  const textFiles = files.filter((f) => f.endsWith(".txt"));

  const pages = [];

  for (const txtFile of textFiles) {
    const base = txtFile.replace(/\.txt$/i, "");
    const selectFile = `${base}__selects.json`;
    const anchorFile = `${base}__anchors.json`;

    const txtPath = path.join(rawDir, txtFile);
    const text = fs.readFileSync(txtPath, "utf8");

    const page = {
      base,
      pageKind: detectPageKind(base),
      textPath: txtPath,
      textPreview: text.split(/\r?\n/).slice(0, 30).join("\n"),
      selects: [],
      anchors: null,
    };

    if (selectFiles.includes(selectFile)) {
      const selects = JSON.parse(
        fs.readFileSync(path.join(rawDir, selectFile), "utf8")
      );
      page.selects = summarizeSelects(selects);
    }

    if (anchorFiles.includes(anchorFile)) {
      const anchors = JSON.parse(
        fs.readFileSync(path.join(rawDir, anchorFile), "utf8")
      );
      page.anchors = summarizeAnchors(anchors);
    }

    pages.push(page);
  }

  const importantPages = pages.filter((p) =>
    ["current_orcr", "seat_matrix", "public_orcr_index", "archive", "news_event"].includes(p.pageKind)
  );

  const runId = path.basename(rawDir);

  const inventoryJson = path.join(PARSED_DIR, `josaa_inventory_${runId}.json`);
  const orcrJson = path.join(PARSED_DIR, `josaa_current_orcr_${runId}.json`);
  const seatJson = path.join(PARSED_DIR, `josaa_seat_matrix_${runId}.json`);
  const reportTxt = path.join(PARSED_DIR, `josaa_inventory_report_${runId}.txt`);

  writeJson(inventoryJson, importantPages);

  const currentOrcr = importantPages.find((p) => p.pageKind === "current_orcr") || null;
  const seatMatrix = importantPages.find((p) => p.pageKind === "seat_matrix") || null;

  writeJson(orcrJson, currentOrcr);
  writeJson(seatJson, seatMatrix);

  const reportLines = [];
  reportLines.push(`Manifest: ${manifestPath}`);
  reportLines.push(`Raw Dir : ${rawDir}`);
  reportLines.push("");

  for (const page of importantPages) {
    reportLines.push(`PAGE KIND: ${page.pageKind}`);
    reportLines.push(`BASE     : ${page.base}`);
    reportLines.push(`SELECTS  : ${page.selects.length}`);
    if (page.anchors) {
      reportLines.push(`ANCHORS  : ${page.anchors.totalAnchors}`);
      reportLines.push(`INTEREST : ${page.anchors.interestingAnchors}`);
    }

    for (const sel of page.selects) {
      reportLines.push(
        `  - select #${sel.index} | id=${sel.id || "(blank)"} | name=${sel.name || "(blank)"} | options=${sel.nonBlankOptionCount}`
      );
      for (const opt of sel.first20Options.slice(0, 10)) {
        reportLines.push(
          `      * value="${opt.value}" | text="${opt.text}"`
        );
      }
    }

    reportLines.push("");
  }

  writeText(reportTxt, reportLines.join("\n"));

  console.log("\nJOSAA INVENTORY PARSE COMPLETE");
  console.log("Important pages        :", importantPages.length);
  console.log("Inventory JSON         :", inventoryJson);
  console.log("Current ORCR JSON      :", orcrJson);
  console.log("Seat Matrix JSON       :", seatJson);
  console.log("Report TXT             :", reportTxt);
}

main().catch((err) => {
  console.error("JOSAA INVENTORY PARSE FAILED");
  console.error(err);
  process.exit(1);
});