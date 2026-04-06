const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function runPlacementSweep() {
    const masterPath = path.join(__dirname, '..', 'data', 'colleges.ndjson');
    const truthDir = path.join(__dirname, '..', 'data', 'truth');
    const tempPath = `${masterPath}.tmp_placements`;

    console.log('💼 Starting PLACEMENT METADATA ENRICHMENT SWEEP...');

    // 1. Consolidate Placement Truth Sources
    // Priority: NIRF 2024 > Core Placements > Iceberg Bulk
    const placementMap = new Map();
    const sources = [
        { file: 'placements_iceberg_bulk.ndjson', label: 'Iceberg Bulk' },
        { file: 'core_placements_v2.ndjson', label: 'Core Placements' },
        { file: 'nirf_2024_placements.ndjson', label: 'NIRF 2024' }
    ];

    for (const source of sources) {
        const fp = path.join(truthDir, source.file);
        if (!fs.existsSync(fp)) continue;

        const rl = readline.createInterface({ input: fs.createReadStream(fp), crlfDelay: Infinity });
        for await (const line of rl) {
            if (!line.trim()) continue;
            try {
                const entry = JSON.parse(line);
                const id = entry.stableKey || entry.id;
                if (!id) continue;

                // NIRF 2024 (source[2]) will naturally overwrite Iceberg/Core (source[0,1]) if IDs match
                placementMap.set(id, {
                    averagePackage: entry.averagePackage || (entry.medianSalary ? entry.medianSalary / 100000 : null),
                    medianSalaryLPA: entry.medianSalary ? entry.medianSalary / 100000 : entry.medianSalaryLPA,
                    highestPackage: entry.highestPackage,
                    placedPercentage: entry.placedPercentage,
                    academicYear: entry.academicYear || entry.session || '2023-24',
                    source: source.label + (entry.source ? ` (${entry.source})` : '')
                });
            } catch (e) {}
        }
    }
    console.log(`✅ Consolidated placement database for ${placementMap.size.toLocaleString()} institutions.`);

    // 2. Stream Master and Apply Enrichment
    const writer = fs.createWriteStream(tempPath);
    const masterRl = readline.createInterface({ input: fs.createReadStream(masterPath), crlfDelay: Infinity });

    let filled = 0;
    let updated = 0;
    let totalProcessed = 0;
    let currentCoverage = 0;

    for await (const line of masterRl) {
        if (!line.trim()) { writer.write('\n'); continue; }
        totalProcessed++;
        try {
            const college = JSON.parse(line);
            const id = college.stableKey || college.aisheCode;
            
            if (id && placementMap.has(id)) {
                const truth = placementMap.get(id);
                
                if (!college.placements) college.placements = {};
                const hadPlacements = college.placements.averagePackageNumeric || college.placements.medianSalaryLPA;

                // Update metrics
                if (truth.averagePackage) {
                    college.placements.averagePackageNumeric = truth.averagePackage * 100000;
                    college.placements.averagePackage = `${truth.averagePackage.toFixed(2)} LPA`;
                }
                if (truth.medianSalaryLPA) {
                    college.placements.medianSalaryLPA = truth.medianSalaryLPA;
                }
                if (truth.highestPackage) {
                    college.placements.highestPackageNumeric = truth.highestPackage * 100000;
                    college.placements.highestPackage = `${truth.highestPackage.toFixed(2)} LPA`;
                }
                if (truth.placedPercentage) {
                    college.placements.placedPercentage = truth.placedPercentage;
                }
                
                college.placements.academicYear = truth.academicYear;
                college.placements.source = truth.source;
                college.placements.isVerified = true;
                
                college.dataConfidenceScore = Math.min((college.dataConfidenceScore || 20) + 15, 100);

                if (hadPlacements) updated++; else filled++;
            }
            
            if (college.placements && (college.placements.averagePackageNumeric || college.placements.medianSalaryLPA)) {
                currentCoverage++;
            }

            writer.write(JSON.stringify(college) + '\n');
        } catch (e) { writer.write(line + '\n'); }
    }

    writer.end();
    await new Promise(resolve => writer.on('finish', resolve));
    fs.renameSync(tempPath, masterPath);

    console.log('\n--- SWEEP COMPLETE ---');
    console.log(`Total Institutions Processed : ${totalProcessed.toLocaleString()}`);
    console.log(`New ROI Metrics Linked      : ${filled.toLocaleString()}`);
    console.log(`Existing ROI Data Enhanced  : ${updated.toLocaleString()}`);
    console.log(`Final Placement Coverage    : ${((currentCoverage/totalProcessed)*100).toFixed(1)}%`);
    console.log('------------------------------\n');
}

runPlacementSweep().catch(console.error);
