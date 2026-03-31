/**
 * scripts/ingest_truth_layer.js
 * Phase 1: Gujarat Truth Ingestion — Improved Resolver v2
 *
 * Resolver chain (strongest signal first):
 *   1. AISHE code lookup (aisheCode field on truth row)
 *   2. Exact stableKey match (institutionAliasRuleId + state slug)
 *   3. Exact name match (lowercased + trimmed)
 *   4. Normalized fuzzy match (collapse punctuation/spaces, strip common suffixes)
 *   5. Alias expansion (known institute name variants hardcoded)
 *
 * Does NOT add Round 1 / Round 2. Gujarat Round 3 only.
 * Does NOT collect new data.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const COLLEGES_PATH     = path.join(__dirname, '../data/colleges.ndjson');
const TRUTH_PATH        = path.join(__dirname, '../data/truth/gujarat_acpc_2025.ndjson');
const VERIFIED_FIELDS_PATH = path.join(__dirname, '../data/verified/verified_fields.ndjson');
const EVIDENCE_PATH     = path.join(__dirname, '../data/verified/source_evidence.ndjson');

// ── Resolver Helpers ──────────────────────────────────────────────────────────

/** Normalize a name string for fuzzy comparison */
function normName(s) {
  if (!s) return '';
  return s
    .toLowerCase()
    .replace(/\s*\(.*?\)/g, '') // Strip anything in parentheses
    .replace(/\b(institute|college|technology|engineering|science|management|the|of|and|for|in|at|&|tech|university|univ|dept|department)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/** Strip common trailing suffixes that vary between sources */
function stripSuffix(s) {
  return s
    .replace(/\s*\(.*?\)/g, '') // Strip anything in parentheses like '(AHMEDABAD)'
    .replace(/\s*[-–,].*$/i, '') // Strip everything after hyphen, en-dash, or comma (location suffixes)
    .replace(/\s*(pvt\.?|ltd\.?|llp|trust)$/i, '')
    .trim();
}

/**
 * Known alias map: ACPC name substring → canonical AISHE name
 */
const ALIAS_MAP = {
  'a.d. patel':                                'A.D.Patel Institute of Technology',
  'a d patel':                                 'A.D.Patel Institute of Technology',
  'ad patel':                                  'A.D.Patel Institute of Technology',
  'ld college':                                'L.D. College of Engineering',
  'l.d. college':                              'L.D. College of Engineering',
  'silver oak':                                'Silver Oak College of Engineering and Technology',
  'nirma':                                     'Nirma University',
  'svnit':                                     'Sardar Vallabhbhai National Institute of Technology',
  'vadodara design academy':                   'Vadodara Design Academy',
  'ms university':                             'Maharaja Sayajirao University of Baroda',
  'marwadi':                                   'Marwadi University',
  'parul':                                     'Parul University',
  'charusat':                                  'Charotar University of Science and Technology',
  'charotar':                                  'Charotar University of Science and Technology',
  'ganpat':                                    'Ganpat University',
  'indus':                                     'Indus University',
  'dharmsinh desai':                           'Dharmsinh Desai University',
  'dd institute':                              'Dharmsinh Desai University',
  'ddu':                                       'Dharmsinh Desai University',
  'b.a. college':                              'B.A. College of Agriculture',
  'c.p. patel':                                'C.P. Patel & F.H. Shah Commerce College',
  'cspit':                                     'Chandubhai S. Patel Institute of Technology',
  'cgpit':                                     'Chhotubhai Gopalbhai Patle Institute of Technology',
};

function resolveAlias(rawName) {
  const lower = rawName.toLowerCase().trim();
  for (const [alias, canonical] of Object.entries(ALIAS_MAP)) {
    if (lower.includes(alias)) return canonical;
  }
  return null;
}

// ── Main Ingestion ─────────────────────────────────────────────────────────────

async function ingestTruth() {
  console.log('--- 🚀 Gujarat Truth Ingestion v2 (Improved Resolver) ---');

  const collegesMap   = new Map(); // stableKey → college
  const aisheMap      = new Map(); // aisheCode → stableKey
  const exactNameMap  = new Map(); // exact lowercase name → stableKey
  const normNameMap   = new Map(); // normalized name → stableKey

  // 1. Load institutional base
  console.log('Loading institutional base...');
  const rl = readline.createInterface({ input: fs.createReadStream(COLLEGES_PATH), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      const c = JSON.parse(line);
      const id = c.stableKey || c.id;
      if (!id) continue;
      collegesMap.set(id, c);

      // AISHE code index
      if (c.aisheCode) aisheMap.set(c.aisheCode.trim(), id);

      // Exact name index
      if (c.name) {
        exactNameMap.set(c.name.toLowerCase().trim(), id);
        // Also index stripped suffix version
        exactNameMap.set(stripSuffix(c.name).toLowerCase().trim(), id);
      }

      // Normalized fuzzy name index
      if (c.name) {
        const nn = normName(c.name);
        if (nn && !normNameMap.has(nn)) normNameMap.set(nn, id);
      }
    } catch (_) {}
  }
  console.log(`Loaded ${collegesMap.size} colleges into ${normNameMap.size} fuzzy-name slots.`);

  // 2. Process Gujarat Truth (Round 3 only)
  const verifiedFields = [];
  const sourceEvidence = [];
  let totalRows   = 0;
  let matchedRows = 0;
  let unmatchedSample = [];

  console.log('Processing Gujarat Truth Layer (Round 3)...');
  const trl = readline.createInterface({ input: fs.createReadStream(TRUTH_PATH), crlfDelay: Infinity });

  for await (const line of trl) {
    if (!line.trim()) continue;
    try {
      const truth = JSON.parse(line);

      // Only process Round 3 rows (per user constraint)
      if (truth.round && truth.round !== 'Round 3') continue;

      totalRows++;
      let collegeId = null;

      // ── Resolver chain ────────────────────────────────────────────────────────

      // 1. AISHE code (strongest signal)
      if (!collegeId && truth.aisheCode && aisheMap.has(truth.aisheCode.trim())) {
        collegeId = aisheMap.get(truth.aisheCode.trim());
      }

      // 2. Exact stableKey (institutionAliasRuleId maps to a known stableKey pattern)
      if (!collegeId && truth.institutionAliasRuleId) {
        // truth stableKey is slugified; try to find by direct stableKey lookup
        if (collegesMap.has(truth.stableKey)) collegeId = truth.stableKey;
      }

      // 3. Exact name match — try ACPC name, then AICTE name
      const namesToTry = [
        truth.institutionNameAcpc,
        truth.institutionNameAicte,
        truth.institutionNameDisplay,
      ].filter(Boolean);

      for (const rawName of namesToTry) {
        if (collegeId) break;
        const key = rawName.toLowerCase().trim();
        if (exactNameMap.has(key))                      { collegeId = exactNameMap.get(key); break; }
        const stripped = stripSuffix(rawName).toLowerCase().trim();
        if (exactNameMap.has(stripped))                 { collegeId = exactNameMap.get(stripped); break; }
      }

      // 4. Alias expansion
      if (!collegeId) {
        for (const rawName of namesToTry) {
          const canonical = resolveAlias(rawName);
          if (canonical) {
            const key = canonical.toLowerCase().trim();
            if (exactNameMap.has(key)) { collegeId = exactNameMap.get(key); break; }
            const nn = normName(canonical);
            if (normNameMap.has(nn))   { collegeId = normNameMap.get(nn); break; }
          }
        }
      }

      // 5. Normalized fuzzy match (last resort)
      if (!collegeId) {
        for (const rawName of namesToTry) {
          const nn = normName(rawName);
          if (nn && normNameMap.has(nn)) { collegeId = normNameMap.get(nn); break; }
        }
      }

      if (!collegeId) {
        if (unmatchedSample.length < 20) {
          unmatchedSample.push(truth.institutionNameAcpc || truth.institutionNameAicte || truth.stableKey);
        }
        continue;
      }

      matchedRows++;
      const college = collegesMap.get(collegeId);

      // ── Enrich: Intake ────────────────────────────────────────────────────────
      if (truth.acpcCounsellingIntake) {
        const fieldId    = `vf_${collegeId}_intake`;
        const evidenceId = `ev_${collegeId}_intake_${Date.now()}_${matchedRows}`;

        verifiedFields.push({
          _id: fieldId,
          collegeId,
          fieldName: 'student_intake',
          fieldValue: truth.acpcCounsellingIntake,
          confidenceScore: 95,
          verificationStatus: 'Verified',
          sourceIds: [evidenceId],
          sourceCount: 1,
          sourceFamily: 'ACPC',
          lastVerifiedAt: new Date().toISOString(),
        });

        sourceEvidence.push({
          _id: evidenceId,
          verifiedFieldId: fieldId,
          collegeId,
          fieldName: 'student_intake',
          sourceType: 'GOV_PORTAL',
          sourceURL: truth.acpcSeatEvidencePointer || 'https://gujacpc.admissions.nic.in',
          capturedAt: truth.extractedAt || new Date().toISOString(),
          extractionMethod: 'API_PULL',
          rawValue: truth.acpcCounsellingIntake,
          normalizedValue: truth.acpcCounsellingIntake,
          trustLevel: 'HIGH',
          sourceFamily: 'ACPC',
          isActive: true,
          submittedBy: 'system',
        });
      }

      // ── Enrich: Courses array (for hasCourses coverage signal) ────────────────
      if (!college.courses) college.courses = [];
      const courseName = truth.programName || 'Degree Program';
      const existing = college.courses.find(co => co.name === courseName);
      if (existing) {
        if (truth.acpcCounsellingIntake) existing.intake = truth.acpcCounsellingIntake;
        if (truth.acpcClosingRanks?.length)  existing.cutoffs = truth.acpcClosingRanks;
      } else {
        college.courses.push({
          name: courseName,
          intake: truth.acpcCounsellingIntake || null,
          cutoffs: truth.acpcClosingRanks || [],
          sourceFamily: 'ACPC',
          session: truth.session || '2025-26',
        });
      }
    } catch (_) {}
  }

  // 3. Report resolver stats
  const matchRate = totalRows > 0 ? ((matchedRows / totalRows) * 100).toFixed(1) : 0;
  console.log(`\nResolver: ${matchedRows}/${totalRows} rows matched (${matchRate}%)`);
  if (unmatchedSample.length > 0) {
    console.log(`Unmatched sample (first ${unmatchedSample.length}):`);
    unmatchedSample.forEach(n => console.log(`  ✗ ${n}`));
  }

  // 4. Save Results
  console.log('\nSaving updated colleges.ndjson...');
  const updatedNdJson = Array.from(collegesMap.values()).map(c => JSON.stringify(c)).join('\n') + '\n';
  fs.writeFileSync(COLLEGES_PATH, updatedNdJson);

  console.log(`Saving ${verifiedFields.length} verified fields...`);
  fs.writeFileSync(VERIFIED_FIELDS_PATH, verifiedFields.map(v => JSON.stringify(v)).join('\n') + '\n');

  console.log(`Saving ${sourceEvidence.length} evidence records...`);
  fs.writeFileSync(EVIDENCE_PATH, sourceEvidence.map(e => JSON.stringify(e)).join('\n') + '\n');

  console.log('✅ Gujarat Truth Ingestion v2 complete!');
}

ingestTruth().catch(console.error);
