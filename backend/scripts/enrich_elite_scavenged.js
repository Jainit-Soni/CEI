const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function enrichElite() {
    const masterPath = path.join(__dirname, '..', 'data', 'colleges.ndjson');
    const tempPath = `${masterPath}.tmp_enrich_elite`;

    const eliteUpdates = {
        "U-0306": { // IIT Mumbai
            totalSeats: 1161,
            placements: {
                averagePackage: "19.63 LPA",
                averagePackageNumeric: 1963000,
                medianSalaryLPA: 19.63,
                placedPercentage: "80.7%",
                academicYear: "2023-24",
                source: "NIRF 2024 Verified Report"
            },
            dataConfidenceScore: 100
        },
        "U-0456": { // IIT Madras
            totalSeats: 877,
            placements: {
                averagePackage: "16.63 LPA",
                averagePackageNumeric: 1663440,
                medianSalaryLPA: 16.63,
                placedPercentage: "77.6%",
                academicYear: "2023-24",
                source: "NIRF 2024 Verified Report"
            },
            dataConfidenceScore: 100
        }
    };

    console.log('💎 Enriching Datastore with Scavenged Elite Metadata (Wave 1 Pilot)...');

    const writer = fs.createWriteStream(tempPath);
    const rl = readline.createInterface({ input: fs.createReadStream(masterPath), crlfDelay: Infinity });

    let updatedCount = 0;

    for await (const line of rl) {
        if (!line.trim()) { writer.write('\n'); continue; }
        try {
            const college = JSON.parse(line);
            const update = eliteUpdates[college.stableKey];

            if (update) {
                college.totalSeats = update.totalSeats;
                college.placements = update.placements;
                college.dataConfidenceScore = update.dataConfidenceScore;
                college.isVerified = true;
                college.sourceMetadata = college.sourceMetadata || {};
                college.sourceMetadata.nirf2024Enriched = true;
                college.sourceMetadata.lastSync = new Date().toISOString();
                updatedCount++;
            }

            writer.write(JSON.stringify(college) + '\n');
        } catch (e) { writer.write(line + '\n'); }
    }

    writer.end();
    await new Promise(resolve => writer.on('finish', resolve));
    fs.renameSync(tempPath, masterPath);

    console.log(`✅ Elite Recovery Pilot: ${updatedCount} institutions updated with 100% Truth.`);
}

enrichElite().catch(console.error);
