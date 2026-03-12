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

        // Helper: Parse tuition for ROI calculation (extracts first number found)
        const parseTuitionLPA = (str) => {
            if (!str) return 0;
            // Matches numbers with commas and dots: 35,00,000 or 35.5
            const match = str.replace(/,/g, '').match(/(\d+(\.\d+)?)/);
            if (!match) return 0;
            const val = parseFloat(match[0]);
            // If it looks like a whole rupee value (e.g. > 10000), convert to Lakhs
            return val > 10000 ? val / 100000 : val;
        };

        // 1. Outcome Component (30%) - Package + ROI
        let avgLpa = college.placements?.averagePackageNumeric;
        if (!avgLpa && college.placements?.averagePackage) {
            // Extraction fallback for raw strings like "36.41 LPA"
            const match = college.placements.averagePackage.match(/(\d+(\.\d+)?)/);
            if (match) avgLpa = parseFloat(match[0]);
        }
        if (!avgLpa) {
            avgLpa = college.placements?.highestPackageNumeric ? college.placements.highestPackageNumeric / 3 : 0;
        }

        const annualFeesLpa = parseTuitionLPA(college.tuition) || 2.0; 
        
        // Outcome Score = [A] Package (max 20) + [B] ROI Ratio (max 10)
        const outcomeA = Math.min(20, (avgLpa / 30) * 20); // Cap at 30 LPA
        const outcomeB = Math.min(10, (avgLpa / annualFeesLpa) * 1.5); // Boost for high salary relative to fees
        score += (outcomeA + outcomeB);

        // 2. Prestige Component (25%) - Logarithmic Ranking
        let prestigeScore = 0;
        const rank = college.ranking;
        if (rank && rank > 0) {
            // Logarithmic decay ensures ranking 100 -> 300 isn't as brutal as 1 -> 100
            prestigeScore = Math.max(0, 25 * (1 - Math.log10(rank) / Math.log10(5000)));
        } else if (college.rankingTier === 'Tier 1') {
            prestigeScore = 20;
        } else if (college.rankingTier === 'Tier 2') {
            prestigeScore = 12;
        }
        score += prestigeScore;

        // 3. Rigor Component (20%) - Accepted Exams
        let rigorScore = 0;
        const exams = (college.acceptedExams || []).map(e => (e || "").toLowerCase());
        if (exams.includes('cat') || exams.includes('gmat') || exams.includes('xat')) rigorScore = 20;
        else if (exams.includes('cmat') || exams.includes('snap') || exams.includes('nmat')) rigorScore = 15;
        else if (exams.length > 0) rigorScore = 8;
        score += rigorScore;

        // 4. Integrity & Trust (15%) - Verification Status & Integrity Score
        let integrityScore = 0;
        const isVerified = college.verificationStatus === 'VERIFIED' || college.verificationStatus === 'Manual Administrator Override';
        if (isVerified) integrityScore += 10;
        if (college.dataIntegrityScore) integrityScore += (college.dataIntegrityScore / 100) * 5;
        if (college.hasOpenAnomalies) integrityScore -= 5;
        score += Math.max(0, integrityScore);

        // 5. Value/Vibe Component (10%) - Premium status & Infra proxy
        const coursesCount = college.courses?.length || 0;
        const breadthScore = Math.min(5, (coursesCount / 20) * 5);
        const premiumBonus = college.isPremium ? 5 : 0;
        score += (breadthScore + premiumBonus);

        const finalScore = Math.min(100, Math.max(0, score));

        // Band: ['Elite', 'High', 'Competitive', 'Moderate', 'Emerging']
        let band = 'Emerging';
        if (finalScore > 85) band = 'Elite';
        else if (finalScore > 70) band = 'High';
        else if (finalScore > 50) band = 'Competitive';
        else if (finalScore > 35) band = 'Moderate';

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
