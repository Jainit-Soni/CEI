const fs = require('fs');
const path = require('path');

const COLLEGES_NDJSON = path.join(__dirname, '..', 'data', 'colleges.ndjson');
const TOP_5K_JSON = path.join(__dirname, '..', '..', 'frontend', 'public', 'colleges_top_5k.json');

async function generateTop5kCache() {
    console.log("⚡ Generating Top 5k Production Cache...");

    const lines = fs.readFileSync(COLLEGES_NDJSON, 'utf8').split('\n').filter(l => l.trim());
    const allColleges = lines.map(l => JSON.parse(l));

    // Sort by Boost (Core Elite) then Confidence
    allColleges.sort((a, b) => {
        if ((b.searchBoost || 1) !== (a.searchBoost || 1)) {
            return (b.searchBoost || 1) - (a.searchBoost || 1);
        }
        return (b.dataConfidenceScore || 0) - (a.dataConfidenceScore || 0);
    });

    const top5k = allColleges.slice(0, 5000);

    // Save as minified JSON for performance
    fs.writeFileSync(TOP_5K_JSON, JSON.stringify(top5k));
    
    console.log(`✅ Top 5k Cache Generated at ${TOP_5K_JSON}`);
    console.log(`📏 Payload Size: ${(fs.statSync(TOP_5K_JSON).size / 1024 / 1024).toFixed(2)} MB`);
}

generateTop5kCache().catch(console.error);
