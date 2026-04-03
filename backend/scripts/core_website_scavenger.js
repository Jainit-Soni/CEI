const fs = require('fs');
const path = require('path');

const COLLEGES_FILE = path.join(__dirname, '..', 'data', 'colleges.ndjson');
const AISHE_CSV = path.join(__dirname, '..', 'data', 'aishe_colleges.csv');

async function coreWebsiteScavenger() {
    console.log("🕸️  Starting CORE WEBSITE SCAVENGER (Official AISHE 2024)...");

    const aisheMap = new Map();
    const csvContent = fs.readFileSync(AISHE_CSV, 'utf8');
    const rows = csvContent.split('\n');

    for (let i = 3; i < rows.length; i++) { // Skip headers
        const cols = rows[i].split(',');
        if (cols.length < 5) continue;
        
        const aid = cols[0];
        const web = cols[4];
        if (aid && web && web.length > 5) {
            aisheMap.set(aid, web);
        }
    }
    console.log(`📡 Loaded ${aisheMap.size} official websites from AISHE master.`);

    // 2. Update Datastore
    const collegesLines = fs.readFileSync(COLLEGES_FILE, 'utf8').split('\n').filter(l => l.trim());
    let matchCount = 0;
    const output = [];

    for (const line of collegesLines) {
        let college = JSON.parse(line);
        const aid = college.aisheCode;

        if (college.isCore && !college.website && aid && aisheMap.has(aid)) {
            matchCount++;
            college.website = aisheMap.get(aid).toLowerCase();
            if (!college.website.startsWith('http')) college.website = 'https://' + college.website;
            college.dataConfidenceScore = Math.min((college.dataConfidenceScore || 20) + 15, 95);
        }
        output.push(JSON.stringify(college));
    }

    fs.writeFileSync(COLLEGES_FILE, output.join('\n') + '\n');
    console.log(`🎉 Website Scavenger Finished! Hydrated ${matchCount} core institution domains.`);
}

coreWebsiteScavenger().catch(console.error);
