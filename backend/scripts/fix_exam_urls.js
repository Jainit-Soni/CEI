require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });
const mongoose = require('mongoose');
const Exam = require('../models/ExamSchema');
const connectDB = require('../config/db');

async function fixExamUrls() {
    await connectDB();
    
    console.log("--- 🔗 Exam URL Integrity Fix ---");
    
    const urlFixes = [
        { query: { shortName: /CAT/i }, update: { officialUrl: "https://iimcat.ac.in" } },
        { query: { shortName: /XAT/i }, update: { officialUrl: "https://xatonline.in" } },
        { query: { shortName: /CMAT/i }, update: { officialUrl: "https://exams.nta.ac.in/CMAT/" } },
        { query: { shortName: /MAH.*CET/i }, update: { officialUrl: "https://cetcell.mahacet.org" } },
        { query: { shortName: /MAT/i }, update: { officialUrl: "https://mat.aima.in" } },
        { query: { shortName: /NMAT/i }, update: { officialUrl: "https://www.mba.com/exams/nmat" } },
        { query: { shortName: /SNAP/i }, update: { officialUrl: "https://www.snaptest.org" } },
        { query: { shortName: /CUET.*PG/i }, update: { officialUrl: "https://pgcuet.samarth.ac.in" } },
        { query: { shortName: /SAT/i }, update: { officialUrl: "https://satsuite.collegeboard.org" } },
        { query: { shortName: /GMAT/i }, update: { officialUrl: "https://www.mba.com/exams/gmat-focus-edition" } },
        { query: { shortName: /GRE/i }, update: { officialUrl: "https://www.ets.org/gre" } },
        { query: { shortName: /IELTS/i }, update: { officialUrl: "https://www.ielts.org" } }
    ];

    for (const fix of urlFixes) {
        const result = await Exam.updateOne(fix.query, { $set: fix.update });
        if (result.matchedCount > 0) {
            console.log(`✅ Fixed URL for ${fix.query.shortName}: ${result.modifiedCount} updated.`);
        } else {
            console.log(`⚠️ No match found for ${fix.query.shortName}.`);
        }
    }

    console.log("\n--- URL Fix Complete ---");
    process.exit(0);
}

fixExamUrls().catch(err => {
    console.error(err);
    process.exit(1);
});
