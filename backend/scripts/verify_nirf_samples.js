require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');
const fs = require('fs');
const path = require('path');

async function verify() {
    await connectDB();
    const samples = ['U-0456', 'U-0517', 'U-0053']; // Madras, Kanpur, Guwahati
    const results = [];

    console.log("🔍 Verifying Sample Records...");

    for (const id of samples) {
        const college = await College.findOne({ id }).lean();
        if (!college) {
            console.error(`❌ Sample ${id} not found in DB!`);
            continue;
        }

        const metrics = {
            id,
            name: college.name,
            hasRankings: (college.rankings || []).length > 0,
            rankings: college.rankings,
            hasNIRFPlacement: college.placements?.source === 'NIRF 2024',
            placements: college.placements
        };

        results.push(metrics);
        console.log(`✅ Sample ${id} (${college.name}) verified in Mongo.`);
    }

    const reportPath = path.join(__dirname, '../reports/nirf_2024/frontend_sample_verification.md');
    
    let md = "# Frontend Sample Verification Report\n\n";
    results.forEach(res => {
        md += `## ${res.name} (${res.id})\n`;
        md += `- **Rankings**: ${res.rankings.length} found. ${res.rankings.map(r => `${r.source} ${r.year} (${r.category}): #${r.rank}`).join(', ')}\n`;
        md += `- **Placements**: ${res.hasNIRFPlacement ? '✅ NIRF 2024 Verified' : '❌ NIRF 2024 Missing'}\n`;
        if (res.hasNIRFPlacement) {
            md += `  - Source: ${res.placements.source}\n`;
            md += `  - Value: ₹${(res.placements.averagePackageNumeric/100000).toFixed(2)} LPA\n`;
        }
        md += `\n---\n`;
    });

    fs.writeFileSync(reportPath, md);
    console.log(`✅ Verification Report saved to ${reportPath}`);
    mongoose.connection.close();
    process.exit(0);
}

verify();
