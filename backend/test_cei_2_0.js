require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');
const College = require('./models/CollegeSchema');

async function test() {
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Select IIM-A, IIM-K, and IIM-M
    const ids = ['iim-ahm', 'U-1019', 'U-1283'];
    const colleges = await College.find({ id: { $in: ids } }).lean();

    console.log('--- CEI 2.0 DRY RUN ---');

    const parseTuitionLPA = (str) => {
        if (!str) return 0;
        const match = str.replace(/,/g, '').match(/(\d+(\.\d+)?)/);
        if (!match) return 0;
        const val = parseFloat(match[0]);
        return val > 10000 ? val / 100000 : val;
    };

    for (const college of colleges) {
        let score = 0;
        let avgLpa = college.placements?.averagePackageNumeric;
        if (!avgLpa && college.placements?.averagePackage) {
            const m = college.placements.averagePackage.match(/(\d+(\.\d+)?)/);
            if (m) avgLpa = parseFloat(m[0]);
        }
        if (!avgLpa) avgLpa = college.placements?.highestPackageNumeric ? college.placements.highestPackageNumeric / 3 : 0;
        
        const annualFeesLpa = parseTuitionLPA(college.tuition) || 2.0;

        const outcomeA = Math.min(20, (avgLpa / 30) * 20);
        const outcomeB = Math.min(10, (avgLpa / annualFeesLpa) * 1.5);
        
        let prestigeScore = 0;
        const rank = college.ranking;
        if (rank && rank > 0) {
            prestigeScore = Math.max(0, 25 * (1 - Math.log10(rank) / Math.log10(5000)));
        } else if (college.rankingTier === 'Tier 1') prestigeScore = 20;

        let rigorScore = 0;
        const exams = (college.acceptedExams || []).map(e => (e || "").toLowerCase());
        if (exams.includes('cat')) rigorScore = 20;
        else if (exams.includes('cmat')) rigorScore = 15;

        let integrityScore = 0;
        if (college.verificationStatus === 'VERIFIED') integrityScore += 10;
        if (college.dataIntegrityScore) integrityScore += (college.dataIntegrityScore / 100) * 5;

        const coursesCount = college.courses?.length || 0;
        const breadthScore = Math.min(5, (coursesCount / 20) * 5);
        const premiumBonus = college.isPremium ? 5 : 0;

        score = outcomeA + outcomeB + prestigeScore + rigorScore + integrityScore + breadthScore + premiumBonus;
        
        console.log(`\nCollege: ${college.name}`);
        console.log(`- Package: ${avgLpa}L -> ${outcomeA.toFixed(2)}`);
        console.log(`- ROI (Fees ${annualFeesLpa}L): ${outcomeB.toFixed(2)}`);
        console.log(`- Prestige (Rank ${rank || 'N/A'}): ${prestigeScore.toFixed(2)}`);
        console.log(`- Rigor: ${rigorScore.toFixed(2)}`);
        console.log(`- Integrity: ${integrityScore.toFixed(2)}`);
        console.log(`- Final Score: ${Math.min(100, score).toFixed(2)}`);
    }

    mongoose.disconnect();
}

test();
