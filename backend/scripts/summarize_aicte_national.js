/**
 * scripts/summarize_aicte_national.js
 * Generates a national AICTE/AISHE coverage summary from existing NDJSON files.
 * Does NOT collect new data. Read-only.
 *
 * Run: node scripts/summarize_aicte_national.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const COLLEGES_PATH = path.join(__dirname, '../data/colleges.ndjson');
const TRUTH_DIR = path.join(__dirname, '../data/truth');

async function summarize() {
  console.log('\n🇮🇳  CEI — National AICTE/AISHE Coverage Summary\n' + '='.repeat(55));

  // ── 1. Base College Registry (from colleges.ndjson) ──────────────────────────
  const stateCounts = new Map();   // state → { institutes: 0 }
  let totalInstitutes = 0;

  const rl = readline.createInterface({ input: fs.createReadStream(COLLEGES_PATH), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const c = JSON.parse(line);
      const state = (c.state || c.meta?.state || 'Unknown').trim();
      if (!stateCounts.has(state)) stateCounts.set(state, { institutes: 0, programRows: 0 });
      stateCounts.get(state).institutes++;
      totalInstitutes++;
    } catch (_) {}
  }

  // ── 2. Truth Layer Program Rows (from data/truth/*.ndjson) ───────────────────
  let totalProgramRows = 0;
  const truthStateCounts = new Map(); // state → rows

  if (fs.existsSync(TRUTH_DIR)) {
    const truthFiles = fs.readdirSync(TRUTH_DIR).filter(f => f.endsWith('.ndjson'));
    for (const file of truthFiles) {
      const trl = readline.createInterface({
        input: fs.createReadStream(path.join(TRUTH_DIR, file)),
        crlfDelay: Infinity
      });
      for await (const line of trl) {
        if (!line.trim()) continue;
        try {
          const row = JSON.parse(line);
          const state = (row.state || 'Unknown').trim();
          if (!truthStateCounts.has(state)) truthStateCounts.set(state, 0);
          truthStateCounts.set(state, truthStateCounts.get(state) + 1);
          totalProgramRows++;
        } catch (_) {}
      }
    }
  }

  // Merge truth program rows into state summary
  for (const [state, count] of truthStateCounts) {
    if (stateCounts.has(state)) {
      stateCounts.get(state).programRows = count;
    } else {
      stateCounts.set(state, { institutes: 0, programRows: count });
    }
  }

  // ── 3. Determine status per state ────────────────────────────────────────────
  const STATUS = (inst, rows) => {
    if (rows > 0)   return '🟢 truth+base';
    if (inst > 0)   return '🟡 base only';
    return '🔴 none';
  };

  // ── 4. Print Table ────────────────────────────────────────────────────────────
  const rows = Array.from(stateCounts.entries())
    .map(([state, d]) => ({ state, institutes: d.institutes, programRows: d.programRows, status: STATUS(d.institutes, d.programRows) }))
    .sort((a, b) => b.institutes - a.institutes);

  const COL = { state: 35, institutes: 12, rows: 14, status: 18 };
  const header =
    'State/UT'.padEnd(COL.state) +
    'Institutes'.padStart(COL.institutes) +
    'Program Rows'.padStart(COL.rows) +
    '  Status';
  console.log(header);
  console.log('-'.repeat(header.length));

  for (const r of rows) {
    console.log(
      r.state.padEnd(COL.state) +
      String(r.institutes).padStart(COL.institutes) +
      String(r.programRows).padStart(COL.rows) +
      '  ' + r.status
    );
  }

  console.log('-'.repeat(header.length));
  console.log(
    'GRAND TOTAL'.padEnd(COL.state) +
    String(totalInstitutes).padStart(COL.institutes) +
    String(totalProgramRows).padStart(COL.rows) +
    '  (all sources combined)'
  );

  console.log('\n📊 Summary:');
  console.log(`  Total States/UTs with data : ${stateCounts.size}`);
  console.log(`  States with truth layer    : ${[...truthStateCounts.keys()].length}`);
  console.log(`  Grand total institutes     : ${totalInstitutes.toLocaleString()}`);
  console.log(`  Grand total program rows   : ${totalProgramRows.toLocaleString()}`);
  console.log(`  Sources in base            : AISHE`);
  console.log(`  Sources in truth           : AICTE, ACPC (Gujarat Round 3 BE/BTech 2025-26)\n`);
}

summarize().catch(console.error);
