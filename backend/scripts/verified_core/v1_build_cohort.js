const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env.local') });

const reportsDir = path.join(__dirname, '../../reports/verified_core');

async function buildCohort() {
    console.log("Connecting to CEI_v2 for Verified Core 1.0 Cohort Building...");
    await mongoose.connect(process.env.MONGODB_URI + 'cei_v2');
    const College = require('../../models/CollegeSchema');

    const tierARegex = /Indian Institute of Technology|National Institute of Technology|Indian Institute of Information Technology|Indian Institute of Management|All India Institute of Management|All India Institute of Medical Sciences/i;
    const tierBRegex = /Birla Institute of Technology and Science|Vellore Institute of Technology|Manipal Institute of Technology|Apeejay/i;

    console.log("Identifying institutions for the cohort...");

    const cohort = await College.find({
        $or: [
            { name: tierARegex },
            { name: tierBRegex },
            { isCore: true }
        ]
    }).select('id stableKey name state aisheCode website isCore collegeType').lean();

    const categorizedCohort = cohort.map(c => {
        let category = 'private/state';
        if (c.name.includes('Indian Institute of Technology')) category = 'IIT';
        else if (c.name.includes('National Institute of Technology')) category = 'NIT';
        else if (c.name.includes('Indian Institute of Information Technology')) category = 'IIIT';
        else if (c.name.includes('Indian Institute of Management')) category = 'IIM';
        else if (c.name.includes('Medical Sciences')) category = 'AIIMS';
        else if (c.isCore) category = 'Legacy Core';

        return {
            ...c,
            categoryBucket: category,
            inDatabase: true,
            frontendAddressable: !!c.id
        };
    });

    // Write Outputs
    fs.writeFileSync(path.join(reportsDir, 'verified_core_cohort.json'), JSON.stringify(categorizedCohort, null, 2));
    
    const ndjson = categorizedCohort.map(c => JSON.stringify(c)).join('\n');
    fs.writeFileSync(path.join(reportsDir, 'verified_core_cohort.ndjson'), ndjson + '\n');

    const counts = {};
    categorizedCohort.forEach(c => counts[c.categoryBucket] = (counts[c.categoryBucket] || 0) + 1);

    const md = `# Verified Core 1.0 Cohort
**Total Institutions identified**: ${categorizedCohort.length}

### Category Breakdown
${Object.keys(counts).map(k => `- **${k}**: ${counts[k]}`).join('\n')}

### Sample Population
${categorizedCohort.slice(0, 10).map(c => `- **${c.name}** (${c.categoryBucket}) [${c.id}]`).join('\n')}
`;
    fs.writeFileSync(path.join(reportsDir, 'verified_core_cohort.md'), md);

    console.log(`Cohort build complete. Total: ${categorizedCohort.length} records.`);
    process.exit(0);
}

buildCohort().catch(console.error);
