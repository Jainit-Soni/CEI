const fs = require('fs');
const path = require('path');
const readline = require('readline');

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

const THRESHOLD = 0.85; 

async function fuzzyMerge() {
    const masterPath = path.join(__dirname, '..', 'data', 'colleges.ndjson');
    const aictePath = path.join(__dirname, '..', 'data', 'truth', 'aicte_iceberg_truth.ndjson');
    const tempPath = `${masterPath}.tmp_fuzzy_aicte`;

    console.log('❄️ Starting AICTE-ICEBERG FUZZY MERGE Wave...');

    // 1. Group AICTE Truth by [Name + State]
    const aicteByState = {}; // state -> [ { name, programs, totalIntake } ]
    const truthRl = readline.createInterface({ input: fs.createReadStream(aictePath), crlfDelay: Infinity });

    for await (const line of truthRl) {
        if (!line.trim()) continue;
        try {
            const prog = JSON.parse(line);
            const instNameInitial = prog.institutionName || prog.name || '';
            const stateInitial = prog.state || 'Unknown';
            if (!instNameInitial) continue;

            if (!aicteByState[stateInitial]) aicteByState[stateInitial] = new Map();
            const stateMap = aicteByState[stateInitial];

            if (!stateMap.has(instNameInitial)) {
                stateMap.set(instNameInitial, {
                    name: instNameInitial,
                    normName: normalize(instNameInitial),
                    programs: [],
                    totalIntake: 0
                });
            }

            const data = stateMap.get(instNameInitial);
            const intake = parseInt(prog.intake) || 0;
            data.programs.push({
                name: prog.programName,
                degree: prog.degree,
                specialization: prog.specialization || prog.programName,
                intake: intake
            });
            data.totalIntake += intake;
        } catch (e) {}
    }
    console.log(`✅ Aggregated AICTE programs into institutions across ${Object.keys(aicteByState).length} states.`);

    // 2. Stream Master and Apply Fuzzy Links
    const writer = fs.createWriteStream(tempPath);
    const masterRl = readline.createInterface({ input: fs.createReadStream(masterPath), crlfDelay: Infinity });

    let matched = 0;
    let totalProcessed = 0;
    let collisionsAvoided = 0;

    for await (const line of masterRl) {
        if (!line.trim()) { writer.write('\n'); continue; }
        totalProcessed++;
        try {
            const college = JSON.parse(line);
            
            // Skip if already has verified seats/courses from ID merge
            if (college.totalSeats > 0 && college.sourceMetadata?.aicteVerified) {
                writer.write(line + '\n');
                continue;
            }

            const cName = college.name || '';
            const cState = college.state || '';
            const normCName = normalize(cName);
            
            const stateMap = aicteByState[cState];
            if (stateMap) {
                let bestMatch = null;
                let bestScore = 0;

                for (const [rawName, truth] of stateMap.entries()) {
                    const score = fuzzyMatch(normCName, truth.normName);
                    if (score >= THRESHOLD && score > bestScore) {
                        bestScore = score;
                        bestMatch = truth;
                    }
                }

                if (bestMatch) {
                    college.totalSeats = bestMatch.totalIntake;
                    college.courses = bestMatch.programs;
                    college.isTechnical = true;
                    college.sourceMetadata = college.sourceMetadata || {};
                    college.sourceMetadata.aicteFuzzyMatch = true;
                    college.sourceMetadata.matchScore = bestScore;
                    college.sourceMetadata.lastSync = new Date().toISOString();
                    college.dataConfidenceScore = Math.min((college.dataConfidenceScore || 20) + 15, 100);
                    
                    matched++;
                    // Remove from map to avoid collisions? 
                    // (Actually, one truth might match multiple master records if they are duplicates)
                    // stateMap.delete(bestMatch.name); 
                }
            }

            writer.write(JSON.stringify(college) + '\n');
        } catch (e) { writer.write(line + '\n'); }
    }

    writer.end();
    await new Promise(resolve => writer.on('finish', resolve));
    fs.renameSync(tempPath, masterPath);

    console.log('\n--- FUZZY MERGE COMPLETE ---');
    console.log(`Total Institutions Processed : ${totalProcessed.toLocaleString()}`);
    console.log(`New Fuzzy Matches (Enriched) : ${matched.toLocaleString()}`);
    console.log(`Coverage Boost              : ${((matched/totalProcessed)*100).toFixed(1)}%`);
    console.log('------------------------------\n');
}

fuzzyMerge().catch(console.error);
