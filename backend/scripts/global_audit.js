
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const readline = require('readline');

async function runGlobalAudit() {
    const gzPath = path.join(__dirname, '..', 'data', 'colleges.ndjson.gz');
    const inputStream = fs.createReadStream(gzPath).pipe(zlib.createGunzip());
    const rl = readline.createInterface({ input: inputStream, crlfDelay: Infinity });

    let totalInstitutions = 0;
    let richInstitutions = 0;
    let withCourses = 0;
    let totalCourses = 0;
    let withFees = 0;
    let withPlacements = 0;
    let withNIRF = 0;
    let coreCount = 0;

    for await (const line of rl) {
        if (!line) continue;
        try {
            const obj = JSON.parse(line);
            totalInstitutions++;
            
            // Check for RICH coverage (Audit criteria)
            if (obj.coverage && (obj.coverage.coverageBucket === 'Rich' || obj.coverage.score > 80)) {
                richInstitutions++;
            }

            if (obj.isCore) coreCount++;
            if (obj.courses && obj.courses.length > 0) {
                withCourses++;
                totalCourses += obj.courses.length;
            }
            if (obj.fees && (obj.fees.totalNumeric > 0 || obj.fees.total)) withFees++;
            if (obj.placements && (obj.placements.averagePackageNumeric > 0 || obj.placements.averagePackage)) withPlacements++;
            if (obj.rankings && obj.rankings.length > 0) withNIRF++;

        } catch (e) {}
    }

    console.log("=== GLOBAL FRONTEND DATA AUDIT ===");
    console.log(`Total Institutions in Catalog: ${totalInstitutions.toLocaleString()}`);
    console.log(`Rich / Truth-Grade Profiles:   ${richInstitutions.toLocaleString()}`);
    console.log(`Core (Elite) Institutions:     ${coreCount.toLocaleString()}`);
    console.log("-----------------------------------");
    console.log(`Institutions with Courses:     ${withCourses.toLocaleString()}`);
    console.log(`Total Individual Courses:      ${totalCourses.toLocaleString()}`);
    console.log(`Institutions with Fees:        ${withFees.toLocaleString()}`);
    console.log(`Institutions with Placements:  ${withPlacements.toLocaleString()}`);
    console.log(`Institutions with NIRF Data:   ${withNIRF.toLocaleString()}`);
    console.log("===================================");
}

runGlobalAudit();
