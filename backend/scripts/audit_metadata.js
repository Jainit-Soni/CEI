
const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function analyze() {
  const dataPath = path.join(__dirname, '..', 'data', 'colleges.ndjson');
  const corePath = path.join(__dirname, '..', 'data', 'core', 'core_institutes.ndjson');

  const colleges = [];

  // Load main NDJSON
  const rl = readline.createInterface({ input: fs.createReadStream(dataPath), crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try { colleges.push(JSON.parse(line)); } catch (e) {}
  }

  // Load core institutes
  const coreMap = new Map();
  if (fs.existsSync(corePath)) {
    const rl2 = readline.createInterface({ input: fs.createReadStream(corePath), crlfDelay: Infinity });
    for await (const line of rl2) {
      if (!line.trim()) continue;
      try {
        const e = JSON.parse(line);
        if (e.canonicalName) coreMap.set(e.canonicalName.toLowerCase().replace(/[^a-z0-9]/g, ''), e);
      } catch (e) {}
    }
  }

  // Mark core on colleges
  const matchedCoreKeys = new Set();
  colleges.forEach(c => {
    const normName = c.name ? c.name.toLowerCase().replace(/[^a-z0-9]/g, '') : null;
    if (normName && coreMap.has(normName)) {
      c.isCore = true;
      c.coreMetadata = coreMap.get(normName);
      matchedCoreKeys.add(normName);
    }
  });

  // Add unmatched core institutes as virtual
  for (const [key, meta] of coreMap.entries()) {
    if (!matchedCoreKeys.has(key)) {
      colleges.push({
        id: `CORE-${key.toUpperCase()}`,
        name: meta.canonicalName,
        isCore: true,
        coreMetadata: meta,
        rankingTier: meta.coreTier === 1 ? 'Tier 1' : 'Tier 2',
        location: `${meta.city || 'Unknown'}, ${meta.state}`,
        _isVirtual: true
      });
    }
  }

  const total = colleges.length;
  const sep = '='.repeat(55);

  console.log(`\n${sep}`);
  console.log('  CEI COLLEGE DATA AUDIT — FULL METADATA BIFURCATION');
  console.log(sep);
  console.log(`\n  TOTAL COLLEGES IN DATASTORE: ${total.toLocaleString()}`);

  // ── 1. Core vs Non-Core ─────────────────────────────────────
  const core = colleges.filter(c => c.isCore);
  const nonCore = colleges.filter(c => !c.isCore);
  const virtual = colleges.filter(c => c._isVirtual);
  console.log(`\n${sep}`);
  console.log('  1. CORE vs NON-CORE');
  console.log(sep);
  console.log(`  Core Elite Institutions : ${core.length.toLocaleString()}`);
  console.log(`    ↳ From NDJSON (matched): ${(core.length - virtual.length).toLocaleString()}`);
  console.log(`    ↳ Virtual (core-only)  : ${virtual.length.toLocaleString()}`);
  console.log(`  Non-Core Colleges       : ${nonCore.length.toLocaleString()}`);

  // ── 2. Ranking Tier ──────────────────────────────────────────
  console.log(`\n${sep}`);
  console.log('  2. BY RANKING TIER');
  console.log(sep);
  const tiers = {};
  colleges.forEach(c => {
    const t = c.rankingTier || 'Unranked';
    tiers[t] = (tiers[t] || 0) + 1;
  });
  Object.entries(tiers).sort((a,b) => b[1]-a[1]).forEach(([k,v]) =>
    console.log(`  ${k.padEnd(20)}: ${v.toLocaleString()}`));

  // ── 3. Institution Type ──────────────────────────────────────
  console.log(`\n${sep}`);
  console.log('  3. BY INSTITUTION TYPE (from coreMetadata)');
  console.log(sep);
  const types = {};
  colleges.forEach(c => {
    const t = c?.coreMetadata?.institutionType || c.type || 'Unknown/General';
    types[t] = (types[t] || 0) + 1;
  });
  Object.entries(types).sort((a,b) => b[1]-a[1]).forEach(([k,v]) =>
    console.log(`  ${k.padEnd(30)}: ${v.toLocaleString()}`));

  // ── 4. Institution Family ────────────────────────────────────
  console.log(`\n${sep}`);
  console.log('  4. BY INSTITUTION FAMILY (from coreMetadata)');
  console.log(sep);
  const families = {};
  colleges.forEach(c => {
    const f = c?.coreMetadata?.institutionFamily || 'Unknown';
    families[f] = (families[f] || 0) + 1;
  });
  Object.entries(families).sort((a,b) => b[1]-a[1]).forEach(([k,v]) =>
    console.log(`  ${k.padEnd(30)}: ${v.toLocaleString()}`));

  // ── 5. State-wise (top 36 + others) ─────────────────────────
  console.log(`\n${sep}`);
  console.log('  5. BY STATE');
  console.log(sep);
  const states = {};
  colleges.forEach(c => {
    let st = c?.coreMetadata?.state
      || c.state
      || (c.location ? c.location.split(',').pop()?.trim() : null)
      || 'Unknown';
    states[st] = (states[st] || 0) + 1;
  });
  const stateEntries = Object.entries(states).sort((a,b) => b[1]-a[1]);
  stateEntries.forEach(([k,v]) => console.log(`  ${k.padEnd(35)}: ${v.toLocaleString()}`));
  console.log(`\n  Total unique states/UTs  : ${stateEntries.length}`);

  // ── 6. Metadata Completeness ─────────────────────────────────
  console.log(`\n${sep}`);
  console.log('  6. METADATA COMPLETENESS (fields populated)');
  console.log(sep);
  const hasPlacements    = colleges.filter(c => c.placements?.averagePackageNumeric > 0).length;
  const hasFees          = colleges.filter(c => c.fees?.total || c.fees?.annualFee || c.fees?.tuition).length;
  const hasRankings      = colleges.filter(c => (c.rankings && c.rankings.length > 0) || c.ranking > 0).length;
  const hasCeiScore      = colleges.filter(c => c.ceiScore > 0 || c.institutionStrengthScore > 0).length;
  const hasWebsite       = colleges.filter(c => c.website && c.website.trim()).length;
  const hasCourses       = colleges.filter(c => c.courses?.length > 0).length;
  const hasAccreditation = colleges.filter(c => c.accreditation?.naac || c.accreditation?.nba || c.accreditation?.ugc).length;
  const hasCoords        = colleges.filter(c => c.coordinates?.lat || c.lat).length;
  const hasPhone         = colleges.filter(c => c.phone || c.contact?.phone).length;
  const hasEmail         = colleges.filter(c => c.email || c.contact?.email).length;
  const hasEstYear       = colleges.filter(c => c.established || c.foundedYear).length;
  const hasCoreMetadata  = colleges.filter(c => c.coreMetadata).length;

  const pct = (n) => `${n.toLocaleString()} (${((n/total)*100).toFixed(1)}%)`;
  console.log(`  Placements data         : ${pct(hasPlacements)}`);
  console.log(`  Fees data               : ${pct(hasFees)}`);
  console.log(`  Rankings data           : ${pct(hasRankings)}`);
  console.log(`  CEI Score               : ${pct(hasCeiScore)}`);
  console.log(`  Website URL             : ${pct(hasWebsite)}`);
  console.log(`  Courses listed          : ${pct(hasCourses)}`);
  console.log(`  Accreditation info      : ${pct(hasAccreditation)}`);
  console.log(`  GPS Coordinates         : ${pct(hasCoords)}`);
  console.log(`  Phone number            : ${pct(hasPhone)}`);
  console.log(`  Email address           : ${pct(hasEmail)}`);
  console.log(`  Established year        : ${pct(hasEstYear)}`);
  console.log(`  Core metadata block     : ${pct(hasCoreMetadata)}`);

  // ── 7. Data Confidence Score Buckets ────────────────────────
  console.log(`\n${sep}`);
  console.log('  7. DATA CONFIDENCE SCORE DISTRIBUTION');
  console.log(sep);
  const buckets = {'0–20':0,'21–40':0,'41–60':0,'61–80':0,'81–100':0,'No Score':0};
  colleges.forEach(c => {
    const s = c.dataConfidenceScore ?? c.institutionStrengthScore;
    if (s == null) { buckets['No Score']++; return; }
    if (s <= 20) buckets['0–20']++;
    else if (s <= 40) buckets['21–40']++;
    else if (s <= 60) buckets['41–60']++;
    else if (s <= 80) buckets['61–80']++;
    else buckets['81–100']++;
  });
  Object.entries(buckets).forEach(([k,v]) =>
    console.log(`  Score ${k.padEnd(10)}: ${pct(v)}`));

  // ── 8. Sample field keys ─────────────────────────────────────
  console.log(`\n${sep}`);
  console.log('  8. AVAILABLE TOP-LEVEL FIELDS (on full dataset)');
  console.log(sep);
  const allKeys = new Set();
  colleges.slice(0, 500).forEach(c => Object.keys(c).forEach(k => allKeys.add(k)));
  console.log('  ' + [...allKeys].join(', '));

  console.log(`\n${sep}\n`);
}

analyze().catch(console.error);
