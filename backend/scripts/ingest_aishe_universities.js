const fs = require('fs');
const path = require('path');
const readline = require('readline');

const COLLEGES_FILE = path.join(__dirname, '..', 'data', 'colleges.ndjson');
const UNIV_CSV = path.join(__dirname, '..', 'data', 'aishe_university.csv');

async function ingestUniversities() {
    console.log("🏫 Ingesting AISHE University Registry...");
    const fileStream = fs.createReadStream(UNIV_CSV);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    const existingCodes = new Set();
    const collegesLines = fs.readFileSync(COLLEGES_FILE, 'utf8').split('\n').filter(l => l.trim());
    collegesLines.forEach(l => {
        try {
            const c = JSON.parse(l);
            if (c.aisheCode) existingCodes.add(c.aisheCode);
        } catch(e) {}
    });

    let count = 0;
    let lineNum = 0;
    const newRecords = [];

    for await (const line of rl) {
        lineNum++;
        if (lineNum <= 4) continue; // Skip headers

        const parts = line.match(/(".*?"|[^",\r\n]+)(?=\s*,|\s*$)/g);
        if (!parts || parts.length < 5) continue;

        const aisheCode = parts[0].trim().replace(/^"/, '').replace(/"$/, '');
        const name = parts[1].trim().replace(/^"/, '').replace(/"$/, '');
        const state = parts[2].trim().replace(/^"/, '').replace(/"$/, '');
        const district = parts[3].trim().replace(/^"/, '').replace(/"$/, '');
        const website = parts[4].trim().replace(/^"/, '').replace(/"$/, '');

        if (!existingCodes.has(aisheCode)) {
            const record = {
                id: aisheCode,
                aisheCode: aisheCode,
                stableKey: aisheCode,
                entityType: "university",
                name: name,
                state: state,
                district: district,
                location: `${district}, ${state}`,
                website: (website && website !== '-') ? website : null,
                isCore: true,
                isUniversity: true,
                dataConfidenceScore: 40
            };
            newRecords.push(JSON.stringify(record));
            count++;
        }
    }

    fs.appendFileSync(COLLEGES_FILE, '\n' + newRecords.join('\n') + '\n');
    console.log(`✅ Ingested ${count} new universities from AISHE Registry.`);
    console.log(`💎 Total colleges in database increased to ${collegesLines.length + count}.`);
}

ingestUniversities().catch(console.error);
