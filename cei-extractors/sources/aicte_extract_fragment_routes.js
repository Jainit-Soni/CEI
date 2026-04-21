const fs = require("fs");
const path = require("path");
const cheerio = require("cheerio");

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

function findApprovedInstitutesFragment(rawDir) {
  const files = listFiles(rawDir)
    .filter((name) => name.toLowerCase().includes("approvedinstitutes.php") && name.toLowerCase().endsWith(".html"))
    .sort();

  if (!files.length) {
    throw new Error(`Could not find approvedinstitutes.php fragment in ${rawDir}`);
  }

  return path.join(rawDir, files[files.length - 1]);
}

function rankRoute(route) {
  const blob = `${route.url} ${route.context} ${route.kind}`.toLowerCase();
  let score = 0;

  if (blob.includes("approved")) score += 20;
  if (blob.includes("institute")) score += 18;
  if (blob.includes("course")) score += 18;
  if (blob.includes("program")) score += 16;
  if (blob.includes("state")) score += 10;
  if (blob.includes("search")) score += 12;
  if (blob.includes("fetch")) score += 10;
  if (blob.includes("ajax")) score += 10;
  if (blob.includes("datatable")) score += 12;
  if (blob.includes(".php")) score += 8;
  if (blob.includes("closed")) score += 6;
  if (blob.includes("unapproved")) score += 6;

  return score;
}

function extractUrlsFromText(text, contextLabel, kind) {
  const routes = [];
  const content = String(text || "");

  const patterns = [
    /['"`]([^'"`]*(?:approved|institute|course|program|search|fetch|ajax|datatable|state)[^'"`]*\.(?:php|json|csv|html))['"`]/gi,
    /['"`]([^'"`]*\/[^'"`]*(?:approved|institute|course|program|search|fetch|ajax|datatable|state)[^'"`]*)['"`]/gi,
  ];

  for (const regex of patterns) {
    let match;
    while ((match = regex.exec(content)) !== null) {
      const url = clean(match[1]);
      if (!url) continue;
      routes.push({
        url,
        context: contextLabel,
        kind,
      });
    }
  }

  return routes;
}

function extractDataTableConfigs(scriptText, contextLabel) {
  const text = String(scriptText || "");
  const configs = [];

  // Very loose extraction for DataTable blocks
  const dtRegex = /(\$\s*\([^)]+\)\s*\.\s*DataTable\s*\(([\s\S]*?)\)\s*;?)/gi;
  let match;

  while ((match = dtRegex.exec(text)) !== null) {
    const full = match[1];
    const inside = match[2];

    const ajaxMatch =
      inside.match(/ajax\s*:\s*['"`]([^'"`]+)['"`]/i) ||
      inside.match(/sAjaxSource\s*:\s*['"`]([^'"`]+)['"`]/i) ||
      inside.match(/url\s*:\s*['"`]([^'"`]+)['"`]/i);

    const serverSide = /serverSide\s*:\s*true/i.test(inside) || /bServerSide\s*:\s*true/i.test(inside);

    configs.push({
      context: contextLabel,
      fullSnippet: clean(full).slice(0, 4000),
      ajaxUrl: ajaxMatch ? clean(ajaxMatch[1]) : "",
      serverSide,
    });
  }

  return configs;
}

function extractAjaxCalls(scriptText, contextLabel) {
  const text = String(scriptText || "");
  const calls = [];

  const ajaxRegex = /\$\s*\.\s*ajax\s*\(([\s\S]*?)\)\s*;/gi;
  let match;
  while ((match = ajaxRegex.exec(text)) !== null) {
    const block = match[1];
    const urlMatch = block.match(/url\s*:\s*['"`]([^'"`]+)['"`]/i);
    const typeMatch = block.match(/type\s*:\s*['"`]([^'"`]+)['"`]/i) || block.match(/method\s*:\s*['"`]([^'"`]+)['"`]/i);

    calls.push({
      context: contextLabel,
      url: urlMatch ? clean(urlMatch[1]) : "",
      method: typeMatch ? clean(typeMatch[1]).toUpperCase() : "",
      snippet: clean(block).slice(0, 4000),
    });
  }

  return calls;
}

function extractEventHandlers($) {
  const handlers = [];
  const attrs = ["onclick", "onchange", "oninput", "onkeyup", "onkeypress"];

  $("*").each((_, el) => {
    for (const attr of attrs) {
      const val = $(el).attr(attr);
      if (!val) continue;

      handlers.push({
        tag: el.tagName.toLowerCase(),
        id: $(el).attr("id") || "",
        name: $(el).attr("name") || "",
        class: clean($(el).attr("class") || ""),
        attr,
        code: clean(val),
      });
    }
  });

  return handlers;
}

function extractFormControls($) {
  const selects = [];
  const inputs = [];
  const buttons = [];

  $("select").each((idx, el) => {
    const $el = $(el);
    selects.push({
      index: idx,
      id: $el.attr("id") || "",
      name: $el.attr("name") || "",
      class: clean($el.attr("class") || ""),
      optionCount: $el.find("option").length,
      first20Options: $el.find("option").map((_, opt) => ({
        value: clean($(opt).attr("value") || ""),
        text: clean($(opt).text()),
      })).get().slice(0, 20),
    });
  });

  $("input, textarea").each((idx, el) => {
    const $el = $(el);
    inputs.push({
      index: idx,
      tag: el.tagName.toLowerCase(),
      type: $el.attr("type") || "",
      id: $el.attr("id") || "",
      name: $el.attr("name") || "",
      value: clean($el.val() || $el.attr("value") || ""),
      placeholder: clean($el.attr("placeholder") || ""),
    });
  });

  $('button, input[type="submit"], input[type="button"], a').each((idx, el) => {
    const $el = $(el);
    buttons.push({
      index: idx,
      tag: el.tagName.toLowerCase(),
      id: $el.attr("id") || "",
      name: $el.attr("name") || "",
      type: $el.attr("type") || "",
      text: clean($el.text() || $el.val() || ""),
      title: clean($el.attr("title") || ""),
      href: $el.attr("href") || "",
      onclick: $el.attr("onclick") || "",
    });
  });

  return { selects, inputs, buttons };
}

function dedupeByKey(rows, keyFn) {
  const seen = new Set();
  return rows.filter((row) => {
    const key = keyFn(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function main() {
  ensureDir(PARSED_DIR);

  const manifestPath = getLatestAicteProbeManifestPath();
  const manifest = readJson(manifestPath);
  const rawDir = manifest.rawDir;

  if (!rawDir || !fs.existsSync(rawDir)) {
    throw new Error(`Raw dir not found: ${rawDir}`);
  }

  const fragmentPath = findApprovedInstitutesFragment(rawDir);
  const html = fs.readFileSync(fragmentPath, "utf8");
  const $ = cheerio.load(html);

  console.log("Using manifest:", manifestPath);
  console.log("Using raw dir  :", rawDir);
  console.log("Using fragment :", fragmentPath);

  const inlineScripts = [];
  const scriptSrcs = [];

  $("script").each((idx, el) => {
    const $el = $(el);
    const src = $el.attr("src") || "";
    const inline = $el.html() || "";

    if (src) {
      scriptSrcs.push({
        index: idx,
        src,
      });
    }

    if (clean(inline)) {
      inlineScripts.push({
        index: idx,
        code: inline,
      });
    }
  });

  const handlerRows = extractEventHandlers($);
  const controlSummary = extractFormControls($);

  let routes = [];
  let ajaxCalls = [];
  let dtConfigs = [];

  for (const s of inlineScripts) {
    routes.push(...extractUrlsFromText(s.code, `inline_script_${s.index}`, "script_string"));
    ajaxCalls.push(...extractAjaxCalls(s.code, `inline_script_${s.index}`));
    dtConfigs.push(...extractDataTableConfigs(s.code, `inline_script_${s.index}`));
  }

  for (const h of handlerRows) {
    routes.push(...extractUrlsFromText(h.code, `${h.tag}#${h.id || h.name || "noid"}:${h.attr}`, "event_handler"));
  }

  for (const btn of controlSummary.buttons) {
    if (btn.href) {
      routes.push({
        url: btn.href,
        context: `control:${btn.tag}:${btn.id || btn.name || btn.text || "unnamed"}`,
        kind: "href",
      });
    }
    if (btn.onclick) {
      routes.push(...extractUrlsFromText(btn.onclick, `control:${btn.tag}:${btn.id || btn.name || btn.text || "unnamed"}`, "onclick"));
    }
  }

  routes = dedupeByKey(routes, (r) => `${r.url}||${r.context}||${r.kind}`)
    .map((r) => ({ ...r, score: rankRoute(r) }))
    .sort((a, b) => b.score - a.score || a.url.localeCompare(b.url));

  ajaxCalls = dedupeByKey(ajaxCalls, (r) => `${r.url}||${r.method}||${r.context}`);
  dtConfigs = dedupeByKey(dtConfigs, (r) => `${r.ajaxUrl}||${r.serverSide}||${r.context}`);

  const summary = {
    manifestPath,
    rawDir,
    fragmentPath,
    scriptSrcCount: scriptSrcs.length,
    inlineScriptCount: inlineScripts.length,
    handlerCount: handlerRows.length,
    selectCount: controlSummary.selects.length,
    inputCount: controlSummary.inputs.length,
    buttonCount: controlSummary.buttons.length,
    routeCount: routes.length,
    ajaxCallCount: ajaxCalls.length,
    dataTableConfigCount: dtConfigs.length,
    topRoutes: routes.slice(0, 50),
    ajaxCalls,
    dataTableConfigs: dtConfigs,
    selects: controlSummary.selects,
    inputs: controlSummary.inputs,
    buttons: controlSummary.buttons,
    handlers: handlerRows.slice(0, 100),
  };

  const runId = path.basename(rawDir);

  const routesJson = path.join(PARSED_DIR, `aicte_fragment_routes_${runId}.json`);
  const ajaxJson = path.join(PARSED_DIR, `aicte_fragment_ajax_${runId}.json`);
  const dtJson = path.join(PARSED_DIR, `aicte_fragment_datatables_${runId}.json`);
  const controlsJson = path.join(PARSED_DIR, `aicte_fragment_controls_${runId}.json`);
  const summaryJson = path.join(PARSED_DIR, `aicte_fragment_summary_${runId}.json`);
  const reportTxt = path.join(PARSED_DIR, `aicte_fragment_report_${runId}.txt`);

  writeJson(routesJson, routes);
  writeJson(ajaxJson, ajaxCalls);
  writeJson(dtJson, dtConfigs);
  writeJson(
    controlsJson,
    {
      selects: controlSummary.selects,
      inputs: controlSummary.inputs,
      buttons: controlSummary.buttons,
      handlers: handlerRows,
      scriptSrcs,
    }
  );
  writeJson(summaryJson, summary);

  const lines = [];
  lines.push(`Manifest: ${manifestPath}`);
  lines.push(`Raw Dir : ${rawDir}`);
  lines.push(`Fragment: ${fragmentPath}`);
  lines.push("");
  lines.push(`Inline scripts : ${inlineScripts.length}`);
  lines.push(`Script srcs    : ${scriptSrcs.length}`);
  lines.push(`Handlers       : ${handlerRows.length}`);
  lines.push(`Selects        : ${controlSummary.selects.length}`);
  lines.push(`Inputs         : ${controlSummary.inputs.length}`);
  lines.push(`Buttons        : ${controlSummary.buttons.length}`);
  lines.push(`Routes         : ${routes.length}`);
  lines.push(`Ajax calls     : ${ajaxCalls.length}`);
  lines.push(`DataTables cfg : ${dtConfigs.length}`);
  lines.push("");

  lines.push("Top routes:");
  for (const r of routes.slice(0, 25)) {
    lines.push(`- score=${r.score} | kind=${r.kind}`);
    lines.push(`  url=${r.url}`);
    lines.push(`  context=${r.context}`);
  }
  lines.push("");

  lines.push("AJAX calls:");
  for (const a of ajaxCalls.slice(0, 20)) {
    lines.push(`- method=${a.method || "(blank)"}`);
    lines.push(`  url=${a.url || "(blank)"}`);
    lines.push(`  context=${a.context}`);
    lines.push(`  snippet=${a.snippet.slice(0, 500)}`);
  }
  lines.push("");

  lines.push("DataTable configs:");
  for (const d of dtConfigs.slice(0, 20)) {
    lines.push(`- context=${d.context}`);
    lines.push(`  ajaxUrl=${d.ajaxUrl || "(blank)"}`);
    lines.push(`  serverSide=${d.serverSide}`);
    lines.push(`  snippet=${d.fullSnippet.slice(0, 700)}`);
  }
  lines.push("");

  lines.push("Selects:");
  for (const s of controlSummary.selects.slice(0, 20)) {
    lines.push(`- select#${s.index} | id=${s.id || "(blank)"} | name=${s.name || "(blank)"} | options=${s.optionCount}`);
    for (const opt of s.first20Options.slice(0, 10)) {
      lines.push(`    * value="${opt.value}" | text="${opt.text}"`);
    }
  }
  lines.push("");

  lines.push("Likely buttons:");
  for (const b of controlSummary.buttons.slice(0, 30)) {
    lines.push(`- ${b.tag} | text=${b.text || "(blank)"}`);
    lines.push(`  id=${b.id || "(blank)"} | name=${b.name || "(blank)"} | href=${b.href || "(blank)"}`);
    lines.push(`  onclick=${b.onclick || "(blank)"}`);
  }

  writeText(reportTxt, lines.join("\n"));

  console.log("\nAICTE FRAGMENT ROUTE EXTRACTION COMPLETE");
  console.log("Routes JSON     :", routesJson);
  console.log("AJAX JSON       :", ajaxJson);
  console.log("DataTables JSON :", dtJson);
  console.log("Controls JSON   :", controlsJson);
  console.log("Summary JSON    :", summaryJson);
  console.log("Report TXT      :", reportTxt);
}
main().catch((err) => {
  console.error("AICTE FRAGMENT ROUTE EXTRACTION FAILED");
  console.error(err);
  process.exit(1);
});