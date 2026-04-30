
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');

async function runUningestedAudit() {
    const gzPath = path.join(__dirname, '..', 'data', 'colleges.ndjson.gz');
    const truthDir = path.join(__dirname, '..', 'data', 'truth');
    
    // 1. Build a set of all valid IDs and Names from the Catalog
    const catalogIds = new Set();
    const catalogNames = new Set();
    
    const inputStream = fs.createReadStream(gzPath).pipe(zlib.createGunzip());
    const rl = readline.createInterface({ input: inputStream, crlfDelay: Infinity });

    for await (const line of rl) {
        if (!line) continue;
        try {
            const obj = JSON.parse(line);
            if (obj.id) catalogIds.add(String(obj.id));
            if (obj._id) catalogIds.add(String(obj._id));
            if (obj.stableKey) catalogIds.add(String(obj.stableKey));
            if (obj.name) catalogNames.add(obj.name.toLowerCase().replace(/[^a-z0-9]/g, ''));
        } catch (e) {}
    }

    // 2. Scan Truth Files and find Orphans
    let totalTruthRows = 0;
    let unmappedRows = 0;
    const typeBreakdown = {};
    const sampleOrphans = [];

    const files = fs.readdirSync(truthDir).filter(f => f.endsWith('.ndjson'));
    for (const file of files) {
        const rlTruth = readline.createInterface({
            input: fs.createReadStream(path.join(truthDir, file)),
            crlfDelay: Infinity
        });

        for await (const line of rlTruth) {
            if (!line.trim()) continue;
            totalTruthRows++;
            try {
                const tr = JSON.parse(line);
                const tId = tr.collegeId || tr.stableKey || tr.id;
                const tName = tr.name ? tr.name.toLowerCase().replace(/[^a-z0-9]/g, '') : null;

                let isMapped = false;
                if (tId && catalogIds.has(String(tId))) isMapped = true;
                if (!isMapped && tName && catalogNames.has(tName)) isMapped = true;

                if (!isMapped) {
                    unmappedRows++;
                    const type = tr.entityType || 'unknown';
                    typeBreakdown[type] = (typeBreakdown[type] || 0) + 1;
                    if (sampleOrphans.length < 5) sampleOrphans.push({ name: tr.name, id: tId, type });
                }
            } catch (e) {}
        }
    }

    console.log("=== UNINGESTED TRUTH DATA AUDIT ===");
    console.log(`Total Truth Metadata Rows:  ${totalTruthRows.toLocaleString()}`);
    console.log(`Successfully Ingested:      ${(totalTruthRows - unmappedRows).toLocaleString()}`);
    console.log(`Uningested (Orphan) Rows:   ${unmappedRows.toLocaleString()} (${((unmappedRows/totalTruthRows)*100).toFixed(1)}%)`);
    console.log("-----------------------------------");
    console.log("Bifurcation of Uningested Data:");
    Object.entries(typeBreakdown).forEach(([type, count]) => {
        console.log(` - ${type.padEnd(15)}: ${count.toLocaleString()} rows`);
    });
    console.log("-----------------------------------");
    console.log("Sample Uningested Entities:");
    sampleOrphans.forEach(s => console.log(` - [${s.type}] ${s.name || s.id}`));
    console.log("===================================");
}

runUningestedAudit();
