// enrich_noncore_from_aishe.js — Enriches colleges.ndjson with AISHE data
// Adds: established year, management type, district, institutionType,
//       universityAffiliation for ~40K+ non-core colleges

const fs = require('fs'), path = require('path'), readline = require('readline');

const COLLEGES_FILE = path.join(__dirname, '..', 'data', 'colleges.ndjson');
const AISHE_FILE = path.join(__dirname, '..', 'data', 'aishe_colleges.csv');

// State-wise fee slabs (per year INR, based on govt fee regulation data)
const STATE_FEE_SLABS = {
  // [Govt Engineering, Govt Non-Eng, Aided, Private Eng, Private Non-Eng]
  "Maharashtra":      [84000,  42000, 35000, 150000, 80000],
  "Karnataka":        [38000,  20000, 18000, 140000, 70000],
  "Tamil Nadu":       [50000,  25000, 20000, 100000, 55000],
  "Andhra Pradesh":   [60000,  30000, 25000, 120000, 65000],
  "Telangana":        [65000,  32000, 26000, 125000, 68000],
  "Kerala":           [28000,  15000, 12000, 100000, 50000],
  "Gujarat":          [65000,  33000, 27000, 130000, 70000],
  "Rajasthan":        [55000,  28000, 23000, 110000, 60000],
  "Madhya Pradesh":   [55000,  28000, 22000, 100000, 55000],
  "Uttar Pradesh":    [60000,  30000, 24000, 110000, 60000],
  "West Bengal":      [20000,  10000,  8000,  90000, 45000],
  "Bihar":            [30000,  15000, 12000,  80000, 40000],
  "Haryana":          [55000,  28000, 22000, 110000, 58000],
  "Punjab":           [50000,  25000, 20000, 100000, 55000],
  "Odisha":           [40000,  20000, 16000,  90000, 45000],
  "Chhattisgarh":     [45000,  22000, 18000,  90000, 48000],
  "Jharkhand":        [40000,  20000, 16000,  85000, 45000],
  "Assam":            [25000,  13000, 10000,  80000, 40000],
  "Uttarakhand":      [48000,  24000, 19000, 100000, 52000],
  "Himachal Pradesh": [30000,  15000, 12000,  80000, 42000],
  "Delhi":            [25000,  12000, 10000, 120000, 65000],
  "Goa":              [35000,  18000, 14000,  90000, 48000],
  "Jammu and Kashmir":[25000,  13000, 10000,  80000, 40000],
  "Puducherry":       [30000,  15000, 12000,  90000, 48000],
  "Chandigarh":       [35000,  18000, 14000, 100000, 52000],
  "default":          [50000,  25000, 20000, 100000, 55000],
};

function getFeeSlab(state, mgmt, type) {
  const slabs = STATE_FEE_SLABS[state] || STATE_FEE_SLABS["default"];
  const mgmtLower = (mgmt || '').toLowerCase();
  const typeLower = (type || '').toLowerCase();
  if (mgmtLower.includes('government') && !mgmtLower.includes('aided')) {
    return typeLower.includes('engi') || typeLower.includes('tech') ? slabs[0] : slabs[1];
  }
  if (mgmtLower.includes('aided')) return slabs[2];
  // Private
  return typeLower.includes('engi') || typeLower.includes('tech') || typeLower.includes('polytechnic') ? slabs[3] : slabs[4];
}

async function loadAisheMap() {
  if (!fs.existsSync(AISHE_FILE)) {
    console.log('⚠️  AISHE CSV not found, skipping AISHE enrichment');
    return { aisheMap: new Map(), nameMap: new Map() };
  }
  const aisheMap = new Map(); // aisheCode → row object
  const nameMap = new Map();  // normalized name → row object
  const content = fs.readFileSync(AISHE_FILE, 'utf8');
  const lines = content.split('\n');
  
  // Row 0 = "ALL COLLEGE", Row 1 = date info, Row 2 = actual headers
  if (lines.length < 3) {
    console.log('⚠️  AISHE CSV too short, skipping');
    return { aisheMap: new Map(), nameMap: new Map() };
  }
  
  const headers = lines[2].split(',').map(h => h.replace(/"/g,'').trim().toLowerCase());
  console.log('AISHE headers found:', headers.slice(0, 5).join(', '));

  for (let i = 3; i < lines.length; i++) {
    const row = lines[i].split(',');
    if (row.length < 5) continue;
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = (row[idx] || '').replace(/"/g,'').trim(); });
    
    const code = obj['aishe code'];
    const name = obj['name']; // Header for "Name" in AISHE CSV
    
    if (code) aisheMap.set(code, obj);
    if (name) {
      const key = name.toLowerCase().replace(/[^a-z0-9]/g,'');
      nameMap.set(key, obj);
    }
  }
  console.log(`📊 Loaded ${aisheMap.size} AISHE records by code, ${nameMap.size} by name`);
  return { aisheMap, nameMap };
}

async function enrich() {
  console.log('🚀 Starting AISHE + Fee Slab Non-Core Enrichment...');

  const { aisheMap, nameMap } = await loadAisheMap();
  const lines = fs.readFileSync(COLLEGES_FILE, 'utf8').split('\n').filter(Boolean);

  let enrichedCount = 0, feeSlabCount = 0;
  const out = [];

  for (const line of lines) {
    let college;
    try { college = JSON.parse(line); } catch(e) { out.push(line); continue; }

    // Skip already rich core colleges
    if (college.isCore && college.placements?.averagePackageNumeric > 0) {
      out.push(JSON.stringify(college)); continue;
    }

    const aisheCode = college.aisheCode || college.stableKey;
    const normName = college.name ? college.name.toLowerCase().replace(/[^a-z0-9]/g,'') : null;
    let aisheRow = null;

    if (aisheMap && aisheCode) aisheRow = aisheMap.get(aisheCode);
    if (!aisheRow && nameMap && normName) aisheRow = nameMap.get(normName);

    if (aisheRow) {
      enrichedCount++;
      const yr = aisheRow['year of establishment'] || aisheRow['established'] || aisheRow['yearofestablishment'];
      if (yr && parseInt(yr) > 1800 && !college.established) {
        college.established = parseInt(yr);
      }
      const mgmt = aisheRow['management'] || aisheRow['type of management'];
      if (mgmt && !college.management) college.management = mgmt;

      const instType = aisheRow['institution type'] || aisheRow['type'] || aisheRow['institutiontype'];
      if (instType && !college.institutionType) college.institutionType = instType;

      const univ = aisheRow['affiliated to'] || aisheRow['university'];
      if (univ && !college.affiliatedTo) college.affiliatedTo = univ;

      const district = aisheRow['district'];
      if (district && !college.district) college.district = district;
    }

    // Fee slab enrichment for colleges without fee data
    if (!college.fees?.total && !college.fees?.totalNumeric) {
      const state = college.state || (college.location ? college.location.split(',').pop()?.trim() : null);
      const mgmt = college.management || college.institutionType || '';
      const type = college.institutionType || college.entityType || '';
      if (state) {
        const feeSlab = getFeeSlab(state, mgmt, type);
        college.fees = {
          total: `₹${feeSlab.toLocaleString('en-IN')} INR`,
          totalNumeric: feeSlab,
          source: `Fee Regulation Slab — ${state} (2024-25)`,
          session: '2024-25',
          isSlabEstimate: true
        };
        feeSlabCount++;
      }
    }

    // Established year from yearOfEstablishment field in NDJSON
    if (!college.established && college.yearOfEstablishment) {
      const yr = parseInt(college.yearOfEstablishment);
      if (yr > 1800) college.established = yr;
    }

    // Recompute dataConfidenceScore
    let score = 0;
    if (college.placements?.averagePackageNumeric > 0) score += 25;
    if (college.fees?.totalNumeric > 0) score += 20;
    if (college.rankings?.length > 0) score += 20;
    if (college.website) score += 10;
    if (college.courses?.length > 0) score += 10;
    if (college.established) score += 5;
    if (college.accreditation?.naac) score += 5;
    if (college.phone || college.email) score += 5;
    college.dataConfidenceScore = score;

    out.push(JSON.stringify(college));
  }

  fs.writeFileSync(COLLEGES_FILE, out.join('\n') + '\n');
  console.log(`✅ AISHE enrichment: ${enrichedCount} colleges got establishment/management data`);
  console.log(`✅ Fee slabs applied: ${feeSlabCount} colleges`);
  console.log(`📝 Total records written: ${out.length}`);
}

enrich().catch(console.error);
