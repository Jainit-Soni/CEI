/**
 * normalize_aicte_iceberg.js
 * -------------------------
 * Processes 13,697 raw AICTE institution JSONs from phase2a/raw/
 * and generates a consolidated courses_truth.ndjson for matched colleges.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const ROOT = path.resolve(__dirname, '../..');
const RAW_DIR = path.join(ROOT, 'phase2a/raw');
const TRUTH_OUT = path.join(ROOT, 'backend/data/truth');
const COLLEGES_NDJSON = path.join(ROOT, 'backend/data/colleges.ndjson');

function normalizeName(name) {
  if (!name) return '';
  return name.toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !['the','and','of','for','institute','college','technology','engineering','science','management','research','education','shri','smt','dr','society','trust','mahavidyalaya','vidyalaya','polytechnic'].includes(w))
    .sort()
    .join(' ');
}

async function loadCollegeDictionary() {
  console.log('[aicte-iceberg] Building Name->AISHE dictionary...');
  const dict = new Map();
  const rl = readline.createInterface({ input: fs.createReadStream(COLLEGES_NDJSON) });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const o = JSON.parse(line);
      const norm = normalizeName(o.name);
      if (norm && norm.length > 4) dict.set(norm, o.stableKey);
    } catch {}
  }
  console.log(`[aicte-iceberg] Indexed ${dict.size.toLocaleString()} college names.`);
  return dict;
}

async function run() {
  const dict = await loadCollegeDictionary();
  const outPath = path.join(TRUTH_OUT, 'aicte_iceberg_truth.ndjson');
  const out = fs.createWriteStream(outPath);
  
  let totalFiles = 0, matchedFiles = 0, totalPrograms = 0;
  
  const folders = fs.readdirSync(RAW_DIR).filter(f => f.startsWith('aicte_live_'));
  console.log(`[aicte-iceberg] Scanning ${folders.length} state folders...`);

  for (const folder of folders) {
    const fullFolderPath = path.join(RAW_DIR, folder);
    const files = fs.readdirSync(fullFolderPath).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
      totalFiles++;
      const filePath = path.join(fullFolderPath, file);
      try {
        const rawContent = fs.readFileSync(filePath, 'utf8');
        const data = JSON.parse(rawContent);
        
        // Handle array-of-arrays format (Phase 2a Scrape Format)
        // [ ["ID", "NAME", "STATE", "MANAGEMENT", "UNIVERSITY", "LEVEL", "PROGRAM", ...], [...] ]
        if (Array.isArray(data) && data.length > 0) {
          data.forEach(row => {
            if (!Array.isArray(row) || row.length < 3) return;
            
            const instName = row[1];
            const norm = normalizeName(instName);
            const collegeKey = dict.get(norm);
            
            if (!collegeKey) return;
            if (totalPrograms === 0) matchedFiles++; // simple count of matched institutions

            const truthRow = {
              entityType: 'program',
              collegeId: collegeKey,
              programName: row[6], // Program Name
              degree: row[5], // Level (UG/PG)
              specialization: row[6], // In these files, program is specialization
              intake: row[10], // Intake
              duration: row[11] || '4 Years',
              shift: row[8],
              programType: row[9],
              sourceFamily: 'AICTE-ICEBERG',
              session: '2025-26',
              state: row[2]
            };
            out.write(JSON.stringify(truthRow) + '\n');
            totalPrograms++;
          });
        }
      } catch (e) {}
    }
    process.stdout.write(`.`);
  }

  out.end();
  console.log(`\n\n=== AICTE ICEBERG NORMALIZATION COMPLETE ===`);
  console.log(`Total Files Scanned : ${totalFiles.toLocaleString()}`);
  console.log(`Institutions Matched: ${matchedFiles.toLocaleString()} (est)`);
  console.log(`Programs Ingested   : ${totalPrograms.toLocaleString()}`);
  console.log(`Output File         : backend/data/truth/aicte_iceberg_truth.ndjson`);
}

run().catch(console.error);
