const fs = require('fs');
const path = require('path');
const readline = require('readline');

const COLLEGES_FILE = path.join(__dirname, '..', 'data', 'colleges.ndjson');
const BULK_FILE = path.join(__dirname, '..', 'data', 'truth', 'pan_india_bulk_2024.ndjson');

async function panIndiaBulkIngest() {
    console.log("🌊 Starting PAN-INDIA BULK Deep-Sync (UP/AP/TS/TN)...");

    const bulkMap = new Map();
    const rl = readline.createInterface({ input: fs.createReadStream(BULK_FILE), crlfDelay: Infinity });

    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            const obj = JSON.parse(line);
            const aid = obj.stableKey || obj.aisheCode || obj.collegeId;
            if (!aid) continue;

            bulkMap.set(aid, obj);
        } catch(e) {}
    }
    console.log(`📡 Loaded ${bulkMap.size} bulk records for state-wide hydration.`);

    // 2. Update Datastore
    const collegesLines = fs.readFileSync(COLLEGES_FILE, 'utf8').split('\n').filter(l => l.trim());
    let matchCount = 0;
    const output = [];

    for (const line of collegesLines) {
        let college = JSON.parse(line);
        const aid = college.aisheCode || college.stableKey;

        if (bulkMap.has(aid)) {
            matchCount++;
            const truth = bulkMap.get(aid);
            
            // Ingest Fees (Official Slabs)
            if (truth.tuitionFee || truth.fees) {
                const fee = parseFloat(truth.tuitionFee || truth.fees || 0);
                college.fees = {
                    totalNumeric: fee,
                    total: `₹${fee.toLocaleString()} INR`,
                    source: truth.source || "State Fee Registry"
                };
            }

            // Ingest Metadata (Management Type, Category)
            if (truth.category) college.institutionType = truth.category;
            if (truth.intake) {
                college.meta = college.meta || {};
                college.meta.annualIntake = parseInt(truth.intake);
            }

            college.dataConfidenceScore = Math.min((college.dataConfidenceScore || 20) + 15, 95);
        }
        output.push(JSON.stringify(college));
    }

    fs.writeFileSync(COLLEGES_FILE, output.join('\n') + '\n');
    console.log(`🎉 Pan-India Bulk Wave Finished! Deep-hydrated ${matchCount} institutions.`);
}

panIndiaBulkIngest().catch(console.error);
