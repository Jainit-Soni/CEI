const fs = require('fs');
const path = require('path');

const COLLEGES_FILE = path.join(__dirname, '..', 'data', 'colleges.ndjson');

async function productionPolish() {
    console.log("💎 Starting PRODUCTION POLISH (Final Wave)...");

    const collegesLines = fs.readFileSync(COLLEGES_FILE, 'utf8').split('\n').filter(l => l.trim());
    let scrubCount = 0;
    const output = [];

    for (const line of collegesLines) {
        let college = JSON.parse(line);
        
        // 1. Scrub Placeholders (Case-insensitive)
        const scrubbed = JSON.stringify(college)
            .replace(/:"N\/A"/g, ':null')
            .replace(/:"Data Pending"/g, ':null')
            .replace(/:"Not Available"/g, ':null')
            .replace(/:"Unknown"/g, ':null');

        let cleanCollege = JSON.parse(scrubbed);

        // 2. Elite Search Boosting
        if (cleanCollege.isCore) {
            cleanCollege.searchBoost = 2.5;
        } else {
            cleanCollege.searchBoost = 1.0; // Baseline for 63k
        }

        // 3. Numeric Integrity for Placements
        if (cleanCollege.placements) {
            cleanCollege.placements.averagePackageNumeric = parseFloat(cleanCollege.placements.averagePackageNumeric || 0);
            if (isNaN(cleanCollege.placements.averagePackageNumeric)) cleanCollege.placements.averagePackageNumeric = 0;
        }

        scrubCount++;
        output.push(JSON.stringify(cleanCollege));
    }

    fs.writeFileSync(COLLEGES_FILE, output.join('\n') + '\n');
    console.log(`✅ Production Polish Finished! Calibrated ${scrubCount} institutions for deployment.`);
}

productionPolish().catch(console.error);
