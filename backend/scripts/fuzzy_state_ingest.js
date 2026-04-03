const fs = require('fs');
const path = require('path');
const readline = require('readline');

const COLLEGES_FILE = path.join(__dirname, '..', 'data', 'colleges.ndjson');
const TRUTH_DIR = path.join(__dirname, '..', 'data', 'truth');

const STATE_FILES = [
    'gujarat_acpc_2025.ndjson',
    'maharashtra_fra_2024.ndjson',
    'karnataka_kea_2024_bulk.ndjson',
    'tamil_nadu_tnea_2024_bulk.ndjson'
];

function norm(n) {
    if (!n) return '';
    return n.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function fuzzyStateIngest() {
    console.log("🔍 Starting FUZZY STATE PILLAR HARVEST...");

    const stateMatchMap = new Map();

    for (const f of STATE_FILES) {
        const filePath = path.join(TRUTH_DIR, f);
        if (!fs.existsSync(filePath)) continue;

        // Infer state from filename
        let fileState = 'Generic';
        if (f.includes('gujarat')) fileState = 'Gujarat';
        if (f.includes('maharashtra')) fileState = 'Maharashtra';
        if (f.includes('karnataka')) fileState = 'Karnataka';
        if (f.includes('tamil_nadu')) fileState = 'Tamil Nadu';

        const rl = readline.createInterface({ input: fs.createReadStream(filePath), crlfDelay: Infinity });
        for await (const line of rl) {
            try {
                const obj = JSON.parse(line);
                const name = obj.name || obj.collegeName || obj.canonicalName;
                if (!name) continue;

                const state = obj.state || fileState;
                const key = norm(name) + '|' + norm(state);
                if (!stateMatchMap.has(key)) stateMatchMap.set(key, obj);
            } catch(e) {}
        }
    }
    console.log(`📡 Hydrated ${stateMatchMap.size} unique state records for fuzzy matching.`);

    // 2. Update Datastore
    const collegesLines = fs.readFileSync(COLLEGES_FILE, 'utf8').split('\n').filter(l => l.trim());
    let matchCount = 0;
    const output = [];

    for (const line of collegesLines) {
        let college = JSON.parse(line);
        const key = norm(college.name) + '|' + norm(college.state);

        if (stateMatchMap.has(key)) {
            matchCount++;
            const truth = stateMatchMap.get(key);
            
            // Placement Ingest
            if (truth.averagePackage || truth.medianSalary || truth.avgLPA) {
                const sal = parseFloat(truth.averagePackage || truth.medianSalary || truth.avgLPA || 0);
                const numeric = (sal < 100) ? sal * 100000 : sal;
                college.placements = {
                    averagePackageNumeric: numeric,
                    averagePackage: (numeric/100000).toFixed(2) + " LPA",
                    source: truth.source || "State Admission Registry"
                };
            }

            // Fees Ingest
            if (truth.fees || truth.totalFee) {
                const fee = parseFloat(truth.fees || truth.totalFee || 0);
                college.fees = {
                    totalNumeric: fee,
                    total: `₹${fee.toLocaleString()} INR`,
                    source: "State Fee Regulatory Committee"
                };
            }

            // Meta
            if (!college.meta) college.meta = {};
            college.meta.stateVerified = true;
            college.dataConfidenceScore = Math.min((college.dataConfidenceScore || 20) + 25, 95);
        }
        output.push(JSON.stringify(college));
    }

    fs.writeFileSync(COLLEGES_FILE, output.join('\n') + '\n');
    console.log(`🎉 Fuzzy State Harvest Finished! Linked ${matchCount} colleges to State Registries.`);
}

fuzzyStateIngest().catch(console.error);
