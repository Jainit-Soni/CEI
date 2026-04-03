const fs = require('fs');
const path = require('path');
const readline = require('readline');

const COLLEGES_FILE = 'e:\\CMAT-PROBLEM\\backend\\data\\colleges.ndjson';

async function analyzeMetadata() {
    const rl = readline.createInterface({
        input: fs.createReadStream(COLLEGES_FILE),
        crlfDelay: Infinity
    });

    let total = 0;
    let counts = {
        placements: 0,
        fees: 0,
        rankings: 0,
        websites: 0,
        courses: 0,
        isCore: 0
    };

    for await (const line of rl) {
        if (!line.trim()) continue;
        const c = JSON.parse(line);
        total++;

        if (c.placements && Object.keys(c.placements).length > 0) counts.placements++;
        if (c.fees && Object.keys(c.fees).length > 0) counts.fees++;
        if (c.rankings && c.rankings.length > 0) counts.rankings++;
        if (c.website && c.website !== "N/A" && c.website !== "") counts.websites++;
        if (c.courses && c.courses.length > 0) counts.courses++;
        if (c.isCore) counts.isCore++;
    }

    console.log("--- FINAL DATASET ANALYSIS ---");
    console.log(`Total Colleges: ${total}`);
    console.log(`Placements Available: ${counts.placements}`);
    console.log(`Fees Available: ${counts.fees}`);
    console.log(`Rankings Available: ${counts.rankings}`);
    console.log(`Websites Available: ${counts.websites}`);
    console.log(`Course Info Available: ${counts.courses}`);
    console.log(`Core Elite Institutions: ${counts.isCore}`);
}

analyzeMetadata();
