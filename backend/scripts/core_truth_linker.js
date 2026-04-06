const fs = require('fs');
const path = require('path');

const COLLEGES_FILE = path.join(__dirname, '..', 'data', 'colleges.ndjson');
const TRUTH_DIR = path.join(__dirname, '..', 'data', 'truth');

// --- Balanced Fuzzy Normalizer ---
function normalize(name) {
    if (!name) return '';
    return name.toLowerCase()
        .replace(/\binstitute\b/g, 'inst')
        .replace(/\btechnology\b/g, 'tech')
        .replace(/\buniversity\b/g, 'uni')
        .replace(/\bcollege\b/g, 'coll')
        .replace(/\bengineering\b/g, 'engg')
        .replace(/\bindian\b/g, 'ind')
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function fuzzyMatch(a, b) {
    if (!a || !b) return 0;
    const na = normalize(a), nb = normalize(b);
    if (na === nb) return 1.0;
    
    // Substring match (very common for city suffixes)
    if (na.length > 5 && nb.length > 5) {
        if (na.includes(nb) || nb.includes(na)) return 0.85;
    }

    // Token Jaccard Similarity
    const setA = new Set(na.split(' ').filter(x => x.length > 1));
    const setB = new Set(nb.split(' ').filter(x => x.length > 1));
    if (setA.size === 0 || setB.size === 0) return 0;

    const intersection = [...setA].filter(x => setB.has(x)).length;
    const union = new Set([...setA, ...setB]).size;
    const jaccard = intersection / union;

    // Word Overlap (handles "A B C" vs "A B C D E")
    const overlap = intersection / Math.min(setA.size, setB.size);
    
    return Math.max(jaccard, overlap * 0.8); 
}

const THRESHOLD = 0.65; 
const STATE_MATCH_THRESHOLD = 0.50; // Relaxed for same-state matching

// --- Load all truth sources ---
function loadTruth(filename) {
    const fp = path.join(TRUTH_DIR, filename);
    if (!fs.existsSync(fp)) return [];
    return fs.readFileSync(fp, 'utf8').split('\n').filter(Boolean).map(l => { 
        try { return JSON.parse(l); } catch(e) { return null; } 
    }).filter(Boolean);
}

async function coreTruthLinker() {
    console.log('🌊 Starting CORE TRUTH MULTI-LINKER v2.5 (Regression Fix + Recovery)...\n');

    const nirfRankings    = loadTruth('core_rankings_nirf_v2.ndjson');
    const placements      = loadTruth('core_placements_v2.ndjson');
    const nirfPlacements  = loadTruth('nirf_2024_placements.ndjson');
    const coreFees        = loadTruth('core_fees_v2.ndjson');
    const coreMetadata    = loadTruth('core_metadata_v2.ndjson');
    
    const mahaFees        = loadTruth('maharashtra_fra_2024_bulk.ndjson');
    const panIndiaFees    = loadTruth('pan_india_bulk_2024.ndjson');
    const gujaratTruth    = loadTruth('gujarat_acpc_2025.ndjson');
    const tamilNaduFees   = loadTruth('tamil_nadu_tnea_2024_bulk.ndjson'); // Recategorized as Fees
    const karnatakaFees   = loadTruth('karnataka_kea_2024_bulk.ndjson'); // Recategorized as Fees

    // --- Optimization: Global & State Hash Maps by stableKey ---
    const globalByStableKey = { ranks: {}, placs: {}, fees: {}, meta: {} };
    const stateTruth = {}; 

    const registerUnderState = (state, type, obj) => {
        if (!stateTruth[state]) stateTruth[state] = { feesByStableKey: {}, admsByStableKey: {}, admsFuzzy: [], feesFuzzy: [] };
        if (obj.stableKey) {
            if (type === 'fees') stateTruth[state].feesByStableKey[obj.stableKey] = obj;
            else stateTruth[state].admsByStableKey[obj.stableKey] = obj;
        } else {
            if (type === 'adms') stateTruth[state].admsFuzzy.push(obj);
            else stateTruth[state].feesFuzzy.push(obj);
        }
    };

    // Populate Global Maps
    nirfRankings.filter(r => r.stableKey).forEach(r => {
        if (!globalByStableKey.ranks[r.stableKey]) globalByStableKey.ranks[r.stableKey] = [];
        globalByStableKey.ranks[r.stableKey].push(r);
    });
    [...placements, ...nirfPlacements].filter(p => p.stableKey).forEach(p => globalByStableKey.placs[p.stableKey] = p);
    [...coreFees, ...panIndiaFees].filter(f => f.stableKey).forEach(f => globalByStableKey.fees[f.stableKey] = f);
    coreMetadata.filter(m => m.stableKey).forEach(m => globalByStableKey.meta[m.stableKey] = m);

    // Populate State-Specific Maps
    mahaFees.forEach(f => registerUnderState('Maharashtra', 'fees', f));
    tamilNaduFees.forEach(f => registerUnderState('Tamil Nadu', 'fees', f));
    karnatakaFees.forEach(f => registerUnderState('Karnataka', 'fees', f));
    // Gujarat uses its own stableKey format that doesn't match AISHE codes,
    // so always fuzzy-match by name:
    gujaratTruth.forEach(g => {
        if (!stateTruth['Gujarat']) stateTruth['Gujarat'] = { feesByStableKey: {}, admsByStableKey: {}, admsFuzzy: [], feesFuzzy: [] };
        stateTruth['Gujarat'].admsFuzzy.push(g);
    });

    const stats = { rankings: 0, placements: 0, fees: 0, cutoffs: 0, seats: 0, metadata: 0 };
    const lines = fs.readFileSync(COLLEGES_FILE, 'utf8').split('\n').filter(Boolean);
    const output = [];

    const getName = (obj) => obj.name || obj.institutionName || obj.institutionNameAcpc || obj.institutionNameAicte || obj.collegeName || '';

    console.log(`📦 Analyzing ${lines.length} colleges vs High-Confidence Truth...`);

    for (let i = 0; i < lines.length; i++) {
        let college;
        try { college = JSON.parse(lines[i]); } catch(e) { output.push(lines[i]); continue; }
        
        if (i % 8000 === 0) console.log(`🔄 Processing college ${i}/${lines.length}...`);

        const cName = college.name || '';
        const cState = college.state || '';
        const cKey = college.stableKey || college.aisheCode;
        const stateSet = stateTruth[cState] || { feesByStableKey: {}, admsByStableKey: {}, admsFuzzy: [], feesFuzzy: [] };

        // --- 1. RANKINGS ---
        let matchedRankings = cKey ? globalByStableKey.ranks[cKey] : null;
        if (!matchedRankings) matchedRankings = nirfRankings.filter(r => fuzzyMatch(cName, getName(r)) >= THRESHOLD);
        
        if (matchedRankings && matchedRankings.length > 0) {
            college.rankings = matchedRankings.map(r => ({
                rank: r.rank,
                category: r.category,
                year: r.year,
                score: r.score,
                source: r.source || 'NIRF 2024'
            }));
            college.dataConfidenceScore = Math.min((college.dataConfidenceScore || 20) + 10, 100);
            stats.rankings++;
        }

        // --- 2. PLACEMENTS ---
        let placMatch = (cKey ? globalByStableKey.placs[cKey] : null) || 
                        [...placements, ...nirfPlacements].find(p => (p.state && p.state !== cState) ? false : fuzzyMatch(cName, getName(p)) >= (p.state === cState ? STATE_MATCH_THRESHOLD : THRESHOLD));

        if (placMatch) {
            if (!college.placements) college.placements = {};
            const avgPkg = placMatch.averagePackage || (placMatch.medianSalary ? placMatch.medianSalary / 100000 : null);
            if (avgPkg) {
                college.placements.averagePackage = `${avgPkg.toFixed(2)} LPA`;
                college.placements.averagePackageNumeric = avgPkg * 100000;
            }
            if (placMatch.highestPackage) {
                college.placements.highestPackage = `${placMatch.highestPackage} LPA`;
                college.placements.highestPackageNumeric = placMatch.highestPackage * 100000;
            }
            if (placMatch.medianSalary) {
                college.placements.medianSalaryLPA = +(placMatch.medianSalary / 100000).toFixed(2);
                college.placements.medianSalarySource = placMatch.source || 'Official Registry';
            }
            college.placements.placedPercentage = placMatch.placedPercentage || college.placements.placedPercentage;
            college.placements.academicYear = placMatch.academicYear || placMatch.session || '2023-24';
            college.placements.source = placMatch.source;
            
            college.dataConfidenceScore = Math.min((college.dataConfidenceScore || 20) + 15, 100);
            stats.placements++;
        }

        // --- 3. FEES ---
        let feeMatch = (cKey ? (stateSet.feesByStableKey[cKey] || globalByStableKey.fees[cKey]) : null);
        if (!feeMatch) {
            feeMatch = [...mahaFees, ...tamilNaduFees, ...karnatakaFees, ...coreFees, ...panIndiaFees].find(f => (f.state && f.state !== cState) ? false : fuzzyMatch(cName, getName(f)) >= (f.state === cState ? STATE_MATCH_THRESHOLD : THRESHOLD));
        }
        
        if (feeMatch) {
            const tFee = feeMatch.totalFee || feeMatch.totalFeeINR || feeMatch.tuitionFee;
            if (tFee) {
                college.fees = {
                    total: `₹${tFee.toLocaleString('en-IN')} INR`,
                    totalNumeric: tFee,
                    tuitionNumeric: feeMatch.tuitionFee,
                    session: feeMatch.session || '2024-25',
                    source: feeMatch.source,
                    isVerified: true
                };
                college.dataConfidenceScore = Math.min((college.dataConfidenceScore || 20) + 15, 100);
                stats.fees++;
            }
        }

        // --- 4. ADMISSION TRUTH ---
        let admMatch = (cKey ? stateSet.admsByStableKey[cKey] : null) || stateSet.admsFuzzy.find(a => fuzzyMatch(cName, getName(a)) >= STATE_MATCH_THRESHOLD);

        if (admMatch) {
            const cutoffArray = admMatch.acpcClosingRanks || (admMatch.cutoff || admMatch.closingRank ? [{ closingRank: admMatch.cutoff || admMatch.closingRank }] : []);
            
            if (cutoffArray.length > 0) {
                if (!college.pastCutoffs) college.pastCutoffs = [];
                cutoffArray.forEach(entry => {
                    college.pastCutoffs.push({
                        exam: entry.board || admMatch.exam || 'State Entrance',
                        category: entry.category || 'GEN',
                        cutoff: entry.closingRank || entry.cutoff,
                        year: admMatch.session || admMatch.year || '2024',
                        round: admMatch.round || 'Final'
                    });
                    stats.cutoffs++;
                });
            }

            const intake = admMatch.aicteApprovedIntake || admMatch.acpcCounsellingIntake || admMatch.intake || admMatch.totalSeats; 
            if (intake && intake < 5000) { // Limit for reasonable intake (prevents fee leakage)
                college.totalSeats = intake;
                stats.seats++;
            }
            college.dataConfidenceScore = Math.min((college.dataConfidenceScore || 20) + 10, 100);
        }

        output.push(JSON.stringify(college));
    }

    fs.writeFileSync(COLLEGES_FILE, output.join('\n') + '\n');

    console.log('✅ CORE TRUTH LINKER (v2.5) COMPLETE:');
    console.log(`   🏆 Rankings attached    : ${stats.rankings} institutions`);
    console.log(`   💼 Placements attached  : ${stats.placements} institutions`);
    console.log(`   💰 Verified Fees linked  : ${stats.fees} institutions`);
    console.log(`   🎯 Cutoffs Ingested     : ${stats.cutoffs} data points`);
    console.log(`   🪑 Seat Intake Synced    : ${stats.seats} institutions`);
}

coreTruthLinker().catch(console.error);
