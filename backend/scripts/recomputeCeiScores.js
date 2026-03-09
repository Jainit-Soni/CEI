/**
 * recomputeCeiScores.js
 * =====================
 * Optimised version using bulkWrite for high-speed processing of 68k+ docs.
 */
require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const College = require('../models/CollegeSchema');

async function recompute() {
    console.log('🚀 Starting OPTIMISED CEI Score Recalculation...');
    await mongoose.connect(process.env.MONGODB_URI);

    const colleges = await College.find({}).lean();
    console.log(`📊 Loaded ${colleges.length} colleges for processing...`);

    const bulkOps = [];
    let processed = 0;

    for (const college of colleges) {
        let score = 0;

        // 1. Placement Component (35%)
        const avgLpa = college.placements?.averagePackageNumeric || (college.placements?.highestPackageNumeric ? college.placements.highestPackageNumeric / 3 : 0);
        const placementScore = Math.min(35, (avgLpa / 20) * 35);
        score += placementScore;

        // 2. Ranking Component (25%)
        let rankingScore = 0;
        if (college.ranking && college.ranking < 100) rankingScore = 25;
        else if (college.ranking < 300) rankingScore = 15;
        else if (college.rankingTier === 'Tier 1') rankingScore = 20;
        else if (college.rankingTier === 'Tier 2') rankingScore = 10;
        score += rankingScore;

        // 3. Exam Tier Component (15%)
        let examScore = 0;
        const exams = (college.acceptedExams || []).map(e => (e || "").toLowerCase());
        if (exams.includes('cat') || exams.includes('gmat') || exams.includes('xat')) examScore = 15;
        else if (exams.includes('cmat') || exams.includes('snap') || exams.includes('nmat')) examScore = 10;
        else if (exams.length > 0) examScore = 5;
        score += examScore;

        // 4. Program Breadth (10%)
        const coursesCount = college.courses?.length || 0;
        const breadthScore = Math.min(10, (coursesCount / 10) * 10);
        score += breadthScore;

        // 5. Reliability / Tier Multiplier (15%)
        if (college.isPremium) score += 5;
        if (college.rankingTier === 'Tier 1') score += 10;

        const finalScore = Math.min(100, Math.max(0, score));

        // Band: ['Elite', 'High', 'Competitive', 'Moderate', 'Emerging']
        let band = 'Emerging';
        if (finalScore > 85) band = 'Elite';
        else if (finalScore > 70) band = 'High';
        else if (finalScore > 50) band = 'Competitive';
        else if (finalScore > 30) band = 'Moderate';

        bulkOps.push({
            updateOne: {
                filter: { _id: college._id },
                update: {
                    $set: {
                        ceiScore: parseFloat(finalScore.toFixed(2)),
                        competitivenessBand: band,
                        ceiScoredAt: new Date()
                    }
                }
            }
        });

        processed++;

        if (bulkOps.length >= 1000) {
            console.log(`📦 Committing batch of 1000... (${processed}/${colleges.length})`);
            await College.bulkWrite(bulkOps);
            bulkOps.length = 0;
        }
    }

    if (bulkOps.length > 0) {
        await College.bulkWrite(bulkOps);
    }

    console.log(`\n✨ DONE! Recalculated ${processed} colleges.`);
    process.exit(0);
}

recompute().catch(err => {
    console.error('❌ Error during recompute:', err);
    process.exit(1);
});
