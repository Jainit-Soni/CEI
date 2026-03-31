/**
 * enrich_metadata.js
 * ---------------------
 * Enrichment Pipeline — Phase 17
 * Built with Fuzzy Name + State Matching to safely bridge AISHE (Colleges) and AICTE (Programs)
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.resolve(__dirname, '../..');
const NORMALIZED = path.join(ROOT, 'normalized');
const BACKEND_DATA = path.join(__dirname, '../data');
const TRUTH_OUT = path.join(BACKEND_DATA, 'truth');
const COLLEGES_NDJSON = path.join(BACKEND_DATA, 'colleges.ndjson');

function normalizeName(name) {
  if (!name) return '';
  const words = name.toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !['the','and','of','for','institute','college','technology','engineering','science','management','research','education','shri','smt','dr','society','trust','mahavidyalaya','vidyalaya','polytechnic'].includes(w));
  return words.sort().join(' ');
}

// ─── Step 1: Build the Dictionary of existing Colleges ────────────────────
async function loadCollegeDictionary() {
  console.log('[enrich] Building Name->AISHE dictionary...');
  const dict = new Map(); // normalizedName -> stableKey
  let cCount = 0;
  const rl = readline.createInterface({ input: fs.createReadStream(COLLEGES_NDJSON) });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line);
      const norm = normalizeName(o.name);
      if (norm && norm.length > 4) {
        dict.set(norm, o.stableKey);
      }
      cCount++;
    } catch {}
  }
  console.log(`[enrich] Indexed ${dict.size.toLocaleString()} unique names from ${cCount} colleges.`);
  return dict;
}

// ─── Step 2: Enrich Programs ────────────────────────────────────────────────
async function enrichPrograms(dict) {
  const stateFiles = fs.readdirSync(NORMALIZED).filter(f => f.startsWith('programs_') && f.endsWith('.ndjson'));
  let written = 0, skipped = 0;
  const out = fs.createWriteStream(path.join(TRUTH_OUT, 'courses_truth.ndjson'));

  for (const f of stateFiles) {
    const rl = readline.createInterface({ input: fs.createReadStream(path.join(NORMALIZED, f)) });
    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const prog = JSON.parse(line);
        const norm = normalizeName(prog.institutionName);
        const collegeKey = dict.get(norm);
        
        if (!collegeKey) { skipped++; continue; }

        out.write(JSON.stringify({
          entityType: 'program',
          collegeId: collegeKey,
          programName: prog.programName || prog.courseName,
          degree: prog.degree,
          specialization: prog.specialization || prog.discipline,
          duration: prog.duration,
          intake: prog.sanctionedIntake || prog.intake,
          shift: prog.shift,
          programType: prog.programType,
          sourceFamily: 'AICTE',
          session: prog.session || '2024-25',
          state: prog.institutionState
        }) + '\n');
        written++;
      } catch {}
    }
  }
  out.end();
  console.log(`[enrich][programs] Written: ${written.toLocaleString()} | Skipped: ${skipped.toLocaleString()}`);
  return written;
}

// ─── Step 3: Enrich ACPC Cutoffs ────────────────────────────────────────────
async function enrichCutoffs(dict) {
  const file = path.join(NORMALIZED, 'acpc_cutoffs.ndjson');
  if (!fs.existsSync(file)) return 0;

  let w=0, s=0;  
  const out = fs.createWriteStream(path.join(TRUTH_OUT, 'cutoffs_truth.ndjson'));
  const rl = readline.createInterface({ input: fs.createReadStream(file) });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      const norm = normalizeName(r.institutionName);
      const collegeKey = dict.get(norm);
      if (!collegeKey) { s++; continue; }
      out.write(JSON.stringify({ entityType: 'cutoff', collegeId: collegeKey, ...r }) + '\n');
      w++;
    } catch {}
  }
  out.end();
  console.log(`[enrich][cutoffs] Written: ${w} | Skipped: ${s}`);
  return w;
}

// ─── Step 4: Enrich ACPC Seats ────────────────────────────────────────────
async function enrichSeats(dict) {
  const file = path.join(NORMALIZED, 'acpc_seat_matrix.ndjson');
  if (!fs.existsSync(file)) return 0;

  let w=0, s=0;  
  const out = fs.createWriteStream(path.join(TRUTH_OUT, 'seats_truth.ndjson'));
  const rl = readline.createInterface({ input: fs.createReadStream(file) });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const r = JSON.parse(line);
      const norm = normalizeName(r.institutionName);
      const collegeKey = dict.get(norm);
      if (!collegeKey) { s++; continue; }
      out.write(JSON.stringify({ entityType: 'seat', collegeId: collegeKey, ...r }) + '\n');
      w++;
    } catch {}
  }
  out.end();
  console.log(`[enrich][seats] Written: ${w} | Skipped: ${s}`);
  return w;
}

async function main() {
  console.log('\n================================================');
  console.log('  CEI Metadata Enrichment Pipeline (Fuzzy Match)');
  console.log('================================================\n');

  const dict = await loadCollegeDictionary();

  const [p, c, s] = await Promise.all([
    enrichPrograms(dict),
    enrichCutoffs(dict),
    enrichSeats(dict)
  ]);

  console.log('\n=== ENRICHMENT COMPLETE ===');
  console.log('Programs    : ', p.toLocaleString());
  console.log('Cutoffs     : ', c.toLocaleString());
  console.log('Seats       : ', s.toLocaleString());
}

main().catch(console.error);
