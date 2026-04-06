const fs = require('fs');
const path = require('path');
const readline = require('readline');

// --- Balanced Fuzzy Normalizer (Shared logic) ---
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
    
    // Substring match
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

    const overlap = intersection / Math.min(setA.size, setB.size);
    return Math.max(jaccard, overlap * 0.8); 
}

const STATE_MATCH_THRESHOLD = 0.82; 

async function syncGujarat() {
    const masterPath = path.join(__dirname, '..', 'data', 'colleges.ndjson');
    const truthPath = path.join(__dirname, '..', 'data', 'truth', 'gujarat_acpc_2025.ndjson');
    const tempPath = `${masterPath}.tmp_gujarat`;

    console.log('🌅 Starting GUJARAT DEEP-SYNC (ACPC 2024-25)...');

    // 1. Group Gujarat Truth by Institution
    const gujaratMap = new Map(); // normalizedName -> aggregate object
    const truthRl = readline.createInterface({ input: fs.createReadStream(truthPath), crlfDelay: Infinity });

    for await (const line of truthRl) {
        if (!line.trim()) continue;
        try {
            const entry = JSON.parse(line);
            const instName = entry.institutionNameAcpc || entry.institutionAliasRuleId || entry.name;
            if (!instName) continue;

            const norm = normalize(instName);
            if (!gujaratMap.has(norm)) {
                gujaratMap.set(norm, {
                    originalName: instName,
                    branches: [],
                    totalIntake: 0,
                    cutoffs: []
                });
            }

            const data = gujaratMap.get(norm);
            const intake = parseInt(entry.acpcCounsellingIntake || entry.intake) || 0;
            
            data.branches.push({
                name: entry.programName,
                intake: intake,
                branchCode: entry.branchCode || 'N/A',
                degree: entry.degree || 'B.E./B.Tech',
                category: entry.category || 'GEN'
            });
            data.totalIntake += intake;

            // Capture closing rank as cutoff
            const rank = parseInt(entry.closingRank || entry.cutoff);
            if (rank) {
                data.cutoffs.push({
                    exam: entry.board || entry.exam || 'GUJCET',
                    category: entry.category || 'GEN',
                    cutoff: rank,
                    year: '2024',
                    round: entry.round || 'Final'
                });
            }
        } catch (e) {}
    }
    console.log(`✅ Aggregated ${gujaratMap.size} unique Gujarat institutions from truth file.`);

    // 2. Stream Master File and Apply Links
    const writer = fs.createWriteStream(tempPath);
    const masterRl = readline.createInterface({ input: fs.createReadStream(masterPath), crlfDelay: Infinity });

    let matched = 0;
    let totalGujaratProcessed = 0;

    const gujaratKeys = [...gujaratMap.keys()];

    for await (const line of masterRl) {
        if (!line.trim()) { writer.write('\n'); continue; }
        try {
            const college = JSON.parse(line);
            if (college.state !== 'Gujarat') {
                writer.write(line + '\n');
                continue;
            }

            totalGujaratProcessed++;
            const cName = college.name || '';
            const normCName = normalize(cName);
            
            // Try direct normalized match
            let matchData = gujaratMap.get(normCName);
            
            // Try fuzzy fallback within Gujarat subset
            if (!matchData) {
                const bestMatchKey = gujaratKeys.find(key => fuzzyMatch(normCName, key) >= STATE_MATCH_THRESHOLD);
                if (bestMatchKey) matchData = gujaratMap.get(bestMatchKey);
            }

            if (matchData) {
                college.totalSeats = matchData.totalIntake;
                college.courses = matchData.branches.map(b => ({
                    name: b.name,
                    degree: b.degree,
                    intake: b.intake,
                    branchCode: b.branchCode
                }));
                
                // Add unique cutoffs
                if (!college.pastCutoffs) college.pastCutoffs = [];
                const existingCutoffs = new Set(college.pastCutoffs.map(c => `${c.exam}-${c.category}-${c.cutoff}`));
                
                matchData.cutoffs.forEach(c => {
                    const key = `${c.exam}-${c.category}-${c.cutoff}`;
                    if (!existingCutoffs.has(key)) {
                        college.pastCutoffs.push(c);
                        existingCutoffs.add(key);
                    }
                });

                college.isTechnical = true;
                college.sourceMetadata = college.sourceMetadata || {};
                college.sourceMetadata.gujaratAcpcSynced = true;
                college.sourceMetadata.lastSync = new Date().toISOString();
                college.dataConfidenceScore = Math.min((college.dataConfidenceScore || 20) + 30, 100);

                matched++;
            }

            writer.write(JSON.stringify(college) + '\n');
        } catch (e) { writer.write(line + '\n'); }
    }

    writer.end();
    await new Promise(resolve => writer.on('finish', resolve));
    fs.renameSync(tempPath, masterPath);

    console.log('\n--- GUJARAT SYNC COMPLETE ---');
    console.log(`Gujarat Colleges in Master : ${totalGujaratProcessed.toLocaleString()}`);
    console.log(`Enriched with Truth Data    : ${matched.toLocaleString()}`);
    console.log(`Efficiency Ratio           : ${((matched/totalGujaratProcessed)*100).toFixed(1)}%`);
    console.log('------------------------------\n');
}

syncGujarat().catch(console.error);
