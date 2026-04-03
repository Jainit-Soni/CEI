const fs = require('fs');
const path = require('path');
const readline = require('readline');

const COLLEGES_FILE = path.join(__dirname, '..', 'data', 'colleges.ndjson');
const TRUTH_FILES = [
    path.join(__dirname, '..', 'data', 'truth', 'nirf_expanded_2024_v1.ndjson'),
    path.join(__dirname, '..', 'data', 'truth', 'placements_truth.ndjson'),
    path.join(__dirname, '..', 'data', 'truth', 'placements_iceberg_bulk.ndjson')
];

function norm(n) { return n ? n.toLowerCase().replace(/[^a-z0-9]/g, '') : ''; }

async function placementsExpansionIngest() {
    console.log("🚀 Starting PLACEMENTS EXPANSION (High-Fidelity Match)...");

    const placementMap = new Map();

    for (const f of TRUTH_FILES) {
        if (!fs.existsSync(f)) continue;
        const rl = readline.createInterface({ input: fs.createReadStream(f), crlfDelay: Infinity });
        for await (const line of rl) {
            try {
                const obj = JSON.parse(line);
                const aid = obj.aisheCode || obj.collegeId;
                const nameKey = norm(obj.name || obj.collegeName);
                
                const stats = {
                    averagePackageNumeric: parseFloat(obj.averagePackageNumeric || obj.medianSalary || obj.avgLPA || 0),
                    source: obj.source || "NIRF Official Data"
                };
                if (stats.averagePackageNumeric < 100 && stats.averagePackageNumeric > 0) {
                    stats.averagePackageNumeric *= 100000;
                }

                if (aid) placementMap.set(aid, stats);
                if (nameKey) placementMap.set(nameKey, stats);
            } catch(e) {}
        }
    }
    console.log(`📡 Hydrated ${placementMap.size} placement truth entities.`);

    // 2. Update Datastore
    const collegesLines = fs.readFileSync(COLLEGES_FILE, 'utf8').split('\n').filter(l => l.trim());
    let matchCount = 0;
    const output = [];

    for (const line of collegesLines) {
        let college = JSON.parse(line);
        const aid = college.aisheCode;
        const nameKey = norm(college.name);

        const truth = placementMap.get(aid) || placementMap.get(nameKey);

        if (truth && truth.averagePackageNumeric > 0) {
            matchCount++;
            college.placements = {
                averagePackageNumeric: truth.averagePackageNumeric,
                averagePackage: (truth.averagePackageNumeric / 100000).toFixed(2) + " LPA",
                source: truth.source
            };
            college.dataConfidenceScore = Math.min((college.dataConfidenceScore || 20) + 20, 95);
        }
        output.push(JSON.stringify(college));
    }

    fs.writeFileSync(COLLEGES_FILE, output.join('\n') + '\n');
    console.log(`🎉 Placements Expansion Finished! Hydrated ${matchCount} institutions with official salary data.`);
}

placementsExpansionIngest().catch(console.error);
