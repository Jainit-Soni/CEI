const fs = require('fs');
const path = require('path');

const COLLEGES_FILE = path.join(__dirname, '..', 'data', 'colleges.ndjson');

async function coreGapAnalysis() {
    console.log("🔍 Analyzing Metadata Gaps for 3,466 Core Elite Institutions...");

    const lines = fs.readFileSync(COLLEGES_FILE, 'utf8').split('\n').filter(l => l.trim());
    
    let totalCore = 0;
    let missingWeb = 0;
    let missingPlacement = 0;
    let missingExactGPS = 0;
    let missingCourses = 0;

    const gapList = [];

    for (const line of lines) {
        const college = JSON.parse(line);
        if (!college.isCore) continue;

        totalCore++;
        
        const gaps = [];
        if (!college.website) { missingWeb++; gaps.push('website'); }
        if (!college.placements || !college.placements.averagePackageNumeric) { missingPlacement++; gaps.push('placements'); }
        if (!college.coordinates || (college.meta && college.meta.locationPrecision === 'state-anchor')) { missingExactGPS++; gaps.push('gps'); }
        if (!college.courses || college.courses.length === 0) { missingCourses++; gaps.push('courses'); }

        if (gaps.length > 0) {
            gapList.push({ name: college.name, gaps });
        }
    }

    console.log(`\n📊 CORE GAP REPORT:`);
    console.log(`Total Core Institutes  : ${totalCore}`);
    console.log(`Missing Websites       : ${missingWeb}`);
    console.log(`Missing Placements     : ${missingPlacement}`);
    console.log(`Missing Building-GPS   : ${missingExactGPS}`);
    console.log(`Missing Courses        : ${missingCourses}`);

    // Output top 20 gaps for research
    console.log(`\n📋 Top 20 Candidates for Final Verification:`);
    gapList.slice(0, 20).forEach(g => console.log(`- ${g.name} (Missing: ${g.gaps.join(', ')})`));

    fs.writeFileSync('core_gap_report.json', JSON.stringify(gapList, null, 2));
}

coreGapAnalysis().catch(console.error);
