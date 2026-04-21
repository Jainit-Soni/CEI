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

function inferTablePurpose(headers, textBlob) {
  const blob = `${headers.join(" ")} ${textBlob}`.toLowerCase();

  if (blob.includes("institute") && blob.includes("state")) return "approved_institutes_listing";
  if (blob.includes("course") || blob.includes("program")) return "course_or_program_listing";
  if (blob.includes("university")) return "university_listing";
  if (blob.includes("approval")) return "approval_listing";
  return "unknown";
}

function collectDataAttributes(el) {
  const out = {};
  if (!el || !el.attribs) return out;

  for (const [key, value] of Object.entries(el.attribs)) {
    if (key.startsWith("data-")) {
      out[key] = value;
    }
  }

  return out;
}

function parseTables($) {
  const tables = [];

  $("table").each((idx, tableEl) => {
    const $table = $(tableEl);

    const rows = [];
    $table.find("tr").each((_, tr) => {
      const row = [];
      $(tr)
        .find("th, td")
        .each((__, cell) => {
          row.push(clean($(cell).text()));
        });

      if (row.length) rows.push(row);
    });

    const headerRow =
      rows.find((row) => row.some((cell) => cell)) ||
      [];

    const blob = rows.flat().join(" ");

    tables.push({
      index: idx,
      id: $table.attr("id") || "",
      class: clean($table.attr("class") || ""),
      rowCount: rows.length,
      columnCount: Math.max(0, ...rows.map((r) => r.length)),
      headers: headerRow,
      purpose: inferTablePurpose(headerRow, blob),
      rowsPreview: rows.slice(0, 25),
      rows,
    });
  });

  return tables;
}

function parseSelects($) {
  const selects = [];

  $("select").each((idx, el) => {
    const $el = $(el);

    const options = [];
    $el.find("option").each((_, opt) => {
      const $opt = $(opt);
      options.push({
        value: clean($opt.attr("value") || ""),
        text: clean($opt.text()),
        selected: $opt.is("[selected]"),
      });
    });

    selects.push({
      index: idx,
      id: $el.attr("id") || "",
      name: $el.attr("name") || "",
      class: clean($el.attr("class") || ""),
      optionCount: options.length,
      options,
    });
  });

  return selects;
}

function parseForms($) {
  const forms = [];

  $("form").each((idx, formEl) => {
    const $form = $(formEl);

    const inputs = [];
    $form.find("input, textarea").each((_, inputEl) => {
      const $input = $(inputEl);
      inputs.push({
        tag: inputEl.tagName.toLowerCase(),
        type: $input.attr("type") || "",
        id: $input.attr("id") || "",
        name: $input.attr("name") || "",
        value: clean($input.val() || $input.attr("value") || ""),
      });
    });

    const selects = [];
    $form.find("select").each((_, selectEl) => {
      const $select = $(selectEl);
      selects.push({
        id: $select.attr("id") || "",
        name: $select.attr("name") || "",
        class: clean($select.attr("class") || ""),
      });
    });

    const buttons = [];
    $form.find('button, input[type="submit"], input[type="button"], a').each((_, btnEl) => {
      const $btn = $(btnEl);
      buttons.push({
        tag: btnEl.tagName.toLowerCase(),
        id: $btn.attr("id") || "",
        name: $btn.attr("name") || "",
        type: $btn.attr("type") || "",
        text: clean($btn.text() || $btn.val() || ""),
        href: $btn.attr("href") || "",
        onclick: $btn.attr("onclick") || "",
      });
    });

    forms.push({
      index: idx,
      id: $form.attr("id") || "",
      name: $form.attr("name") || "",
      action: $form.attr("action") || "",
      method: ($form.attr("method") || "GET").toUpperCase(),
      inputCount: inputs.length,
      selectCount: selects.length,
      buttonCount: buttons.length,
      hiddenFields: inputs.filter((x) => x.type.toLowerCase() === "hidden"),
      inputsPreview: inputs.slice(0, 40),
      selects,
      buttonsPreview: buttons.slice(0, 30),
    });
  });

  return forms;
}

function parseControls($) {
  const controls = [];

  $('button, input[type="submit"], input[type="button"], a').each((idx, el) => {
    const $el = $(el);
    controls.push({
      index: idx,
      tag: el.tagName.toLowerCase(),
      id: $el.attr("id") || "",
      name: $el.attr("name") || "",
      type: $el.attr("type") || "",
      class: clean($el.attr("class") || ""),
      text: clean($el.text() || $el.val() || ""),
      title: clean($el.attr("title") || ""),
      href: $el.attr("href") || "",
      onclick: $el.attr("onclick") || "",
      dataAttributes: collectDataAttributes(el),
    });
  });

  return controls;
}

function parseScripts($) {
  const scripts = [];

  $("script").each((idx, el) => {
    const $el = $(el);
    const src = $el.attr("src") || "";
    const inline = $el.html() || "";
    const blob = inline.toLowerCase();

    scripts.push({
      index: idx,
      src,
      inlineLength: inline.length,
      containsDataTable:
        src.toLowerCase().includes("datatable") ||
        blob.includes("datatable") ||
        blob.includes(".datatable(") ||
        blob.includes(".datatable (") ||
        blob.includes(".dataTable(") ||
        blob.includes(".datatable"),
      containsServerSide:
        blob.includes("serverside") ||
        blob.includes('"serverside"') ||
        blob.includes("'serverside'"),
      containsAjax:
        blob.includes("ajax") ||
        blob.includes("$.ajax") ||
        blob.includes("xmlhttprequest"),
      preview: clean(inline.slice(0, 1000)),
    });
  });

  return scripts;
}

function extractTextPreview($) {
  const text = clean($("body").text());
  return text.slice(0, 10000);
}

function findLikelyActions(controls) {
  const scored = controls
    .map((c) => {
      const blob = `${c.text} ${c.title} ${c.href} ${c.onclick}`.toLowerCase();
      let score = 0;

      if (blob.includes("institute")) score += 18;
      if (blob.includes("approved")) score += 18;
      if (blob.includes("course")) score += 14;
      if (blob.includes("program")) score += 14;
      if (blob.includes("detail")) score += 12;
      if (blob.includes("view")) score += 10;
      if (blob.includes("search")) score += 10;
      if (blob.includes("submit")) score += 8;
      if (blob.includes("fetch")) score += 8;
      if (blob.includes("show")) score += 8;
      if (blob.includes("php")) score += 6;

      return { ...c, score };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, 30);
}

function summarize(tables, selects, forms, controls, scripts, textPreview, fragmentPath) {
  const datatableScripts = scripts.filter((s) => s.containsDataTable);
  const serverSideScripts = scripts.filter((s) => s.containsServerSide);
  const ajaxScripts = scripts.filter((s) => s.containsAjax);

  const likelyActions = findLikelyActions(controls);

  return {
    fragmentPath,
    tablesCount: tables.length,
    selectsCount: selects.length,
    formsCount: forms.length,
    controlsCount: controls.length,
    scriptsCount: scripts.length,
    likelyDataTables: datatableScripts.length > 0,
    likelyServerSideDataTables: serverSideScripts.length > 0,
    likelyAjaxInScripts: ajaxScripts.length > 0,
    likelyActions,
    tableSummary: tables.map((t) => ({
      index: t.index,
      id: t.id,
      class: t.class,
      rowCount: t.rowCount,
      columnCount: t.columnCount,
      purpose: t.purpose,
      headers: t.headers,
    })),
    selectSummary: selects.map((s) => ({
      index: s.index,
      id: s.id,
      name: s.name,
      class: s.class,
      optionCount: s.optionCount,
      first20Options: s.options.slice(0, 20),
    })),
    formSummary: forms.map((f) => ({
      index: f.index,
      id: f.id,
      name: f.name,
      action: f.action,
      method: f.method,
      inputCount: f.inputCount,
      selectCount: f.selectCount,
      buttonCount: f.buttonCount,
      hiddenFields: f.hiddenFields.slice(0, 20),
    })),
    scriptSummary: scripts.map((s) => ({
      index: s.index,
      src: s.src,
      inlineLength: s.inlineLength,
      containsDataTable: s.containsDataTable,
      containsServerSide: s.containsServerSide,
      containsAjax: s.containsAjax,
      preview: s.preview,
    })),
    textPreview,
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

  const fragmentPath = findApprovedInstitutesFragment(rawDir);
  const html = fs.readFileSync(fragmentPath, "utf8");
  const $ = cheerio.load(html);

  console.log("Using manifest:", manifestPath);
  console.log("Using raw dir  :", rawDir);
  console.log("Using fragment :", fragmentPath);

  const tables = parseTables($);
  const selects = parseSelects($);
  const forms = parseForms($);
  const controls = parseControls($);
  const scripts = parseScripts($);
  const textPreview = extractTextPreview($);

  const summary = summarize(
    tables,
    selects,
    forms,
    controls,
    scripts,
    textPreview,
    fragmentPath
  );

  const runId = path.basename(rawDir);

  const tablesJson = path.join(PARSED_DIR, `aicte_approvedinstitutes_tables_${runId}.json`);
  const selectsJson = path.join(PARSED_DIR, `aicte_approvedinstitutes_selects_${runId}.json`);
  const formsJson = path.join(PARSED_DIR, `aicte_approvedinstitutes_forms_${runId}.json`);
  const controlsJson = path.join(PARSED_DIR, `aicte_approvedinstitutes_controls_${runId}.json`);
  const scriptsJson = path.join(PARSED_DIR, `aicte_approvedinstitutes_scripts_${runId}.json`);
  const summaryJson = path.join(PARSED_DIR, `aicte_approvedinstitutes_summary_${runId}.json`);
  const reportTxt = path.join(PARSED_DIR, `aicte_approvedinstitutes_report_${runId}.txt`);

  writeJson(tablesJson, tables);
  writeJson(selectsJson, selects);
  writeJson(formsJson, forms);
  writeJson(controlsJson, controls);
  writeJson(scriptsJson, scripts);
  writeJson(summaryJson, summary);

  const lines = [];
  lines.push(`Manifest: ${manifestPath}`);
  lines.push(`Raw Dir : ${rawDir}`);
  lines.push(`Fragment: ${fragmentPath}`);
  lines.push("");
  lines.push(`Tables  : ${tables.length}`);
  lines.push(`Selects : ${selects.length}`);
  lines.push(`Forms   : ${forms.length}`);
  lines.push(`Controls: ${controls.length}`);
  lines.push(`Scripts : ${scripts.length}`);
  lines.push(`DataTables detected      : ${summary.likelyDataTables}`);
  lines.push(`Server-side DataTables   : ${summary.likelyServerSideDataTables}`);
  lines.push(`Ajax in inline scripts   : ${summary.likelyAjaxInScripts}`);
  lines.push("");

  lines.push("Table summary:");
  for (const t of summary.tableSummary.slice(0, 20)) {
    lines.push(`- table#${t.index} | rows=${t.rowCount} | cols=${t.columnCount} | purpose=${t.purpose}`);
    lines.push(`  id=${t.id || "(blank)"} | class=${t.class || "(blank)"}`);
    lines.push(`  headers=${t.headers.join(" | ")}`);
  }
  lines.push("");

  lines.push("Select summary:");
  for (const s of summary.selectSummary.slice(0, 20)) {
    lines.push(`- select#${s.index} | id=${s.id || "(blank)"} | name=${s.name || "(blank)"} | options=${s.optionCount}`);
    for (const opt of s.first20Options.slice(0, 10)) {
      lines.push(`    * value="${opt.value}" | text="${opt.text}"`);
    }
  }
  lines.push("");

  lines.push("Form summary:");
  for (const f of summary.formSummary.slice(0, 10)) {
    lines.push(`- form#${f.index} | id=${f.id || "(blank)"} | name=${f.name || "(blank)"} | method=${f.method} | action=${f.action || "(blank)"}`);
    lines.push(`  inputs=${f.inputCount} | selects=${f.selectCount} | buttons=${f.buttonCount}`);
    for (const hidden of f.hiddenFields.slice(0, 10)) {
      lines.push(`    hidden: name=${hidden.name || "(blank)"} | value=${hidden.value || "(blank)"}`);
    }
  }
  lines.push("");

  lines.push("Likely action controls:");
  for (const c of summary.likelyActions.slice(0, 20)) {
    lines.push(`- score=${c.score} | tag=${c.tag} | text=${c.text || "(blank)"}`);
    lines.push(`  id=${c.id || "(blank)"} | name=${c.name || "(blank)"} | href=${c.href || "(blank)"}`);
    lines.push(`  onclick=${c.onclick || "(blank)"}`);
  }
  lines.push("");

  lines.push("Script summary:");
  for (const s of summary.scriptSummary.slice(0, 20)) {
    lines.push(`- script#${s.index} | src=${s.src || "(inline)"}`);
    lines.push(`  inlineLength=${s.inlineLength} | containsDataTable=${s.containsDataTable} | containsServerSide=${s.containsServerSide} | containsAjax=${s.containsAjax}`);
    if (s.preview) {
      lines.push(`  preview=${s.preview}`);
    }
  }
  lines.push("");

  lines.push("Text preview:");
  lines.push(textPreview);

  writeText(reportTxt, lines.join("\n"));

  console.log("\nAICTE APPROVEDINSTITUTES PARSE COMPLETE");
  console.log("Tables JSON    :", tablesJson);
  console.log("Selects JSON   :", selectsJson);
  console.log("Forms JSON     :", formsJson);
  console.log("Controls JSON  :", controlsJson);
  console.log("Scripts JSON   :", scriptsJson);
  console.log("Summary JSON   :", summaryJson);
  console.log("Report TXT     :", reportTxt);
}

main().catch((err) => {
  console.error("AICTE APPROVEDINSTITUTES PARSE FAILED");
  console.error(err);
  process.exit(1);
});