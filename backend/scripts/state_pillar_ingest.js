const fs = require('fs');
const path = require('path');
const readline = require('readline');

const COLLEGES_FILE = path.join(__dirname, '..', 'data', 'colleges.ndjson');
const TRUTH_DIR = path.join(__dirname, '..', 'data', 'truth');

const STATE_FILES = [
    'gujarat_acpc_2025.ndjson',
    'maharashtra_fra_2024.ndjson',
    'maharashtra_fra_2024_bulk.ndjson',
    'karnataka_kea_2024_bulk.ndjson',
    'tamil_nadu_tnea_2024_bulk.ndjson'
];

async function statePillarIngest() {
    console.log("🏛️  Starting STATE PILLAR HARVEST (Non-Core Deep-Dive)...");

    const stateMatchMap = new Map();

    for (const f of STATE_FILES) {
        const filePath = path.join(TRUTH_DIR, f);
        if (!fs.existsSync(filePath)) continue;

        const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
        for await (const line of rl) {
            try {
                const obj = JSON.parse(line);
                const key = obj.aisheCode || obj.permanentId || obj.code;
                if (!key) continue;

                if (!stateMatchMap.has(key)) stateMatchMap.set(key, []);
                stateMatchMap.get(key).push(obj);
            } catch(e) {}
        }
    }
    console.log(`📡 Loaded ${stateMatchMap.size} state-verified truth records.`);

    // 2. Update Datastore
    const collegesLines = fs.readFileSync(COLLEGES_FILE, 'utf8').split('\n').filter(l => l.trim());
    let matchCount = 0;
    const output = [];

    for (const line of collegesLines) {
        let college = JSON.parse(line);
        const aid = college.aisheCode;
        const stateKey = college.aisheCode || college.stableKey;

        const truths = stateMatchMap.get(aid) || stateMatchMap.get(stateKey);

        if (truths && truths.length > 0) {
            matchCount++;
            truths.forEach(truth => {
                // Ingest Placement (State Stats)
                if (truth.averagePackage || truth.medianSalary || truth.avgLPA) {
                    const sal = parseFloat(truth.averagePackage || truth.medianSalary || truth.avgLPA || 0);
                    const numeric = sal < 200 ? sal * 100000 : sal;
                    college.placements = {
                        averagePackageNumeric: numeric,
                        averagePackage: (numeric/100000).toFixed(2) + " LPA",
                        source: truth.source || "State Admission Registry"
                    };
                }

                // Ingest Fees (Official Slab)
                if (truth.fees || truth.totalFee) {
                    const fee = parseFloat(truth.fees || truth.totalFee || 0);
                    college.fees = {
                        totalNumeric: fee,
                        total: `₹${fee.toLocaleString()} INR`,
                        source: "State Fee Regulatory Committee"
                    };
                }

                // Ingest Coordinates (if verified)
                if (truth.lat && truth.lng) {
                    college.coordinates = { lat: truth.lat, lng: truth.lng };
                }

                // Bump search boost for verified state schools
                college.searchBoost = (college.searchBoost || 1.0) + 0.2;
                college.dataConfidenceScore = Math.min((college.dataConfidenceScore || 20) + 20, 95);
            });
        }
        output.push(JSON.stringify(college));
    }

    fs.writeFileSync(COLLEGES_FILE, output.join('\n') + '\n');
    console.log(`🔥 State Pillar Harvest Finished! Deep-hydrated ${matchCount} non-core colleges.`);
}

statePillarIngest().catch(console.error);
