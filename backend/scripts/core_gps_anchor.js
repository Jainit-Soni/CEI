const fs = require('fs');
const path = require('path');
const readline = require('readline');

const COLLEGES_FILE = path.join(__dirname, '..', 'data', 'colleges.ndjson');
const WEB_TRUTH = path.join(__dirname, '..', 'data', 'truth', 'websites_truth.ndjson');

async function coreGPSAnchor() {
    console.log("📍 Starting CORE GPS BUILDING-EXACT ANCHOR (10.3MB Truth Scrutiny)...");

    const gpsMap = new Map();
    const rl = readline.createInterface({ input: fs.createReadStream(WEB_TRUTH), crlfDelay: Infinity });

    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            const obj = JSON.parse(line);
            const aid = obj.aisheCode || obj.collegeId;
            if (aid && obj.lat && obj.lng) {
                gpsMap.set(aid, { lat: obj.lat, lng: obj.lng });
            }
        } catch(e) {}
    }
    console.log(`📡 Loaded ${gpsMap.size} verified building-exact coordinates.`);

    // 2. Update Datastore
    const collegesLines = fs.readFileSync(COLLEGES_FILE, 'utf8').split('\n').filter(l => l.trim());
    let matchCount = 0;
    const output = [];

    for (const line of collegesLines) {
        let college = JSON.parse(line);
        const aid = college.aisheCode;

        if (college.isCore && gpsMap.has(aid)) {
            matchCount++;
            const truth = gpsMap.get(aid);
            
            college.coordinates = { lat: truth.lat, lng: truth.lng };
            college.meta = college.meta || {};
            college.meta.locationPrecision = "building-exact";
            
            // Maximum confidence for building-exact points
            college.dataConfidenceScore = Math.min((college.dataConfidenceScore || 20) + 20, 100);
        }
        output.push(JSON.stringify(college));
    }

    fs.writeFileSync(COLLEGES_FILE, output.join('\n') + '\n');
    console.log(`🎉 GPS Anchor Finished! Promoted ${matchCount} core institutions to Building-Exact precision.`);
}

coreGPSAnchor().catch(console.error);
