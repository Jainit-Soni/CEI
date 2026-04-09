require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function cleanup() {
    await connectDB();
    console.log("🧹 Starting NIRF 2024 Data Cleanup...");

    const colleges = await College.find({ 
        $or: [
            { "rankings.source": /NIRF/i },
            { "placements.source": /NIRF/i }
        ]
    });

    let totalRankingsRemoved = 0;
    let totalPlacementsFixed = 0;

    for (const college of colleges) {
        let changed = false;

        // 1. Deduplicate/Normalize Rankings
        if (college.rankings && college.rankings.length > 0) {
            const seen = new Set();
            const uniqueRankings = [];
            
            // Sort by year desc so we process newer first
            const sortedRankings = [...college.rankings].sort((a, b) => parseInt(b.year) - parseInt(a.year));

            for (const r of sortedRankings) {
                const normSource = r.source.toUpperCase().includes('NIRF') ? 'NIRF' : r.source;
                const key = `${normSource}|${r.year}|${r.category || 'Overall'}`;
                
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueRankings.push({
                        source: normSource,
                        year: r.year,
                        rank: r.rank,
                        category: r.category || 'Overall'
                    });
                } else {
                    totalRankingsRemoved++;
                    changed = true;
                }
            }
            if (changed) college.rankings = uniqueRankings;
        }

        // 2. Fix Placements (Zero-value check)
        const isNewer = !college.placements || !college.placements.academicYear || college.placements.academicYear !== "2023-24";
        const isBetterSource = !college.placements || college.placements.source !== "NIRF 2024";
        const isInvalidValue = college.placements && (
            !college.placements.averagePackageNumeric || 
            college.placements.averagePackageNumeric < 10000 || 
            college.placements.averagePackage === "0"
        );

        if (isNewer || isBetterSource || isInvalidValue) {
            if (isInvalidValue) {
                console.log(`🗑️  Clearing suspect placement for ${college.id}: ${college.placements.averagePackageNumeric}`);
                college.placements = undefined;
                totalPlacementsFixed++;
                changed = true;
            } else if (college.placements.source !== 'NIRF 2024') {
                college.placements.source = 'NIRF 2024';
                changed = true;
            }
        }

        if (changed) {
            await college.save();
        }
    }

    console.log(`✅ Cleanup Complete!`);
    console.log(`- Redundant Rankings Removed: ${totalRankingsRemoved}`);
    console.log(`- Stale/Zero Placements Cleared: ${totalPlacementsFixed}`);
    
    mongoose.connection.close();
}

cleanup().catch(err => {
    console.error("Cleanup failed:", err);
    process.exit(1);
});
