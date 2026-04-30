
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');

async function runBifurcationAudit() {
    const gzPath = path.join(__dirname, '..', 'data', 'colleges.ndjson.gz');
    const inputStream = fs.createReadStream(gzPath).pipe(zlib.createGunzip());
    const rl = readline.createInterface({ input: inputStream, crlfDelay: Infinity });

    let total = 0;
    const types = {};
    const states = {};
    const coverage = {
        courses: 0,
        fees: 0,
        placements: 0,
        rankings: 0,
        seats: 0
    };
    let core = 0;

    for await (const line of rl) {
        if (!line) continue;
        try {
            const obj = JSON.parse(line);
            total++;

            if (obj.isCore) core++;
            
            const type = obj.rankingTier || "Unclassified";
            types[type] = (types[type] || 0) + 1;

            const state = obj.state || "Unknown";
            states[state] = (states[state] || 0) + 1;

            if (obj.courses && obj.courses.length > 0) coverage.courses++;
            if (obj.fees && (obj.fees.totalNumeric > 0 || obj.fees.total)) coverage.fees++;
            if (obj.placements && (obj.placements.averagePackageNumeric > 0 || obj.placements.averagePackage)) coverage.placements++;
            if (obj.rankings && obj.rankings.length > 0) coverage.rankings++;
            if (obj.seats && obj.seats.length > 0) coverage.seats++;

        } catch (e) {}
    }

    const report = {
        total,
        core,
        types,
        states: Object.entries(states).sort((a,b) => b[1] - a[1]).slice(0, 10),
        coverage
    };

    console.log(JSON.stringify(report, null, 2));
}

runBifurcationAudit();
