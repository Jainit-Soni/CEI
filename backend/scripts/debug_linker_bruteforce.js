const fs = require('fs');
const readline = require('readline');

async function debugLink() {
    console.log("🔍 BRUTE-FORCE LINKER DEBUG");
    
    // 1. Load Master IDs
    const masterIds = new Set();
    const rl1 = readline.createInterface({ input: fs.createReadStream('backend/data/colleges.ndjson'), crlfDelay: Infinity });
    for await (const line of rl1) {
        if (!line.trim()) continue;
        const obj = JSON.parse(line);
        const cid = obj.stableKey || obj.id;
        if (cid) masterIds.add(String(cid).toUpperCase().replace(/[^A-Z0-9]/g, ''));
    }
    console.log(`✅ Loaded ${masterIds.size} Master IDs (Normalized).`);

    // 2. Scan courses_truth.ndjson
    let truthTotal = 0;
    let truthMatched = 0;
    const truthIds = new Set();
    const rl2 = readline.createInterface({ input: fs.createReadStream('backend/data/truth/aicte_iceberg_truth.ndjson'), crlfDelay: Infinity });
    for await (const line of rl2) {
        if (!line.trim()) continue;
        truthTotal++;
        try {
            const tr = JSON.parse(line);
            const cid = tr.collegeId || tr.stableKey || tr.id;
            if (cid) {
                const normCid = String(cid).toUpperCase().replace(/[^A-Z0-9]/g, '');
                truthIds.add(normCid);
                if (masterIds.has(normCid)) {
                    truthMatched++;
                }
            }
        } catch (e) {}
    }
    
    console.log(`📊 TRUTH SCAN RESULT:`);
    console.log(`Total Truth Rows    : ${truthTotal}`);
    console.log(`Unique Truth IDs    : ${truthIds.size}`);
    console.log(`Matched to Master   : ${truthMatched} (${((truthMatched/truthTotal)*100).toFixed(1)}% of rows)`);
}

debugLink().catch(console.error);
