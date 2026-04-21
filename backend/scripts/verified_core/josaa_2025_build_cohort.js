const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });

const reportsDir = path.join(__dirname, '../../reports/verified_core');

async function buildStrictEngCohort() {
    console.log("Connecting to CEI_v2 for JoSAA 2025 Strict Engineering Cohort Building...");
    await mongoose.connect(process.env.MONGODB_URI + 'cei_v2');
    const College = require('../../models/CollegeSchema');

    // Strict regex for the target bodies
    const iitRegex = /Indian Institute of Technology/i;
    const nitRegex = /National Institute of Technology/i;
    const iiitRegex = /Indian Institute of Information Technology/i;

    console.log("Sieving database for strict IIT/NIT/IIIT bodies...");

    const cohort = await College.find({
        $or: [
            { name: iitRegex },
            { name: nitRegex },
            { name: iiitRegex }
        ]
    }).select('id stableKey name state aisheCode website isCore collegeType').lean();

    const categorized = cohort.map(c => {
        let cat = 'UNKNOWN';
        if (iitRegex.test(c.name)) cat = 'IIT';
        else if (nitRegex.test(c.name)) cat = 'NIT';
        else if (iiitRegex.test(c.name)) cat = 'IIIT';

        return { ...c, categoryBucket: cat };
    });

    const finalCohort = categorized.filter(c => c.categoryBucket !== 'UNKNOWN');

    // Write Outputs
    fs.writeFileSync(path.join(reportsDir, 'josaa_csab_2025_target_cohort.json'), JSON.stringify(finalCohort, null, 2));
    
    const ndjson = finalCohort.map(c => JSON.stringify(c)).join('\n');
    fs.writeFileSync(path.join(reportsDir, 'josaa_csab_2025_target_cohort.ndjson'), ndjson + '\n');

    const counts = { IIT: 0, NIT: 0, IIIT: 0 };
    finalCohort.forEach(c => counts[c.categoryBucket]++);

    const md = `# JoSAA/CSAB 2025 Strict Engineering Cohort
**Total institutions identified**: ${finalCohort.length}

### Category Breakdown
- **IIT**: ${counts.IIT}
- **NIT**: ${counts.NIT}
- **IIIT**: ${counts.IIIT}

### Verified List
${finalCohort.map(c => `- **${c.name}** (${c.categoryBucket}) [${c.id}]`).join('\n')}
`;
    fs.writeFileSync(path.join(reportsDir, 'josaa_csab_2025_target_cohort.md'), md);

    console.log(`Strict Engineering Cohort Build Complete. Total: ${finalCohort.length}`);
    process.exit(0);
}

buildStrictEngCohort().catch(console.error);
