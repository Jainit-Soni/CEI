require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env.local') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const College = require('../models/CollegeSchema');
const connectDB = require('../config/db');

async function run() {
    await connectDB();
    
    const timestamp = '2026-04-09T09-35';
    const reportDir = path.join(__dirname, '../reports/post_audit', timestamp);
    const matchesPath = path.join(reportDir, 'aicte_matches_confident.ndjson');
    const ledgerPath = path.join(reportDir, 'selective_promotion_ledger.ndjson');

    if (!fs.existsSync(matchesPath)) {
        console.error(`❌ Confident matches file not found at ${matchesPath}`);
        process.exit(1);
    }

    console.log(`🚀 Starting Phase B: Selective AICTE Promotion...`);

    const rl = readline.createInterface({
        input: fs.createReadStream(matchesPath),
        crlfDelay: Infinity
    });

    const ledgerStream = fs.createWriteStream(ledgerPath, { flags: 'a' });
    let rowCount = 0;
    let collegeCount = new Set();
    let coursesAdded = 0;
    let intakeUpdated = 0;

    // To prevent redundant DB lookups for the same college, we could batch or cache.
    // Given 22k rows, a simple cache should fit in memory.
    const collegeCache = new Map();

    for await (const line of rl) {
        if (!line.trim()) continue;
        const match = JSON.parse(line);
        const { mongoId, aicteRaw } = match;

        rowCount++;
        
        // Load college from cache or DB
        let college = collegeCache.get(mongoId);
        if (!college) {
            college = await College.findOne({ id: mongoId });
            if (!college) {
                console.warn(`⚠️ College not found: ${mongoId}`);
                continue;
            }
            collegeCache.set(mongoId, college);
        }

        collegeCount.add(mongoId);

        // Snapshot before for this specific field/course if we were doing granular ledgering
        // But for simplicity, we'll ledger the final result per college or per mutation.
        
        if (!college.courses) college.courses = [];

        // Check if course already exists
        const aicteProgramName = aicteRaw.programName || aicteRaw.specialization;
        if (!aicteProgramName) continue;

        let existingCourse = college.courses.find(c => 
            c.name && (c.name.toLowerCase().trim() === aicteProgramName.toLowerCase().trim())
        );

        const before = existingCourse ? { intake: existingCourse.intake } : null;

        if (existingCourse) {
            // Update intake if AICTE has it and it's missing or newer
            if (aicteRaw.intake && (!existingCourse.intake || existingCourse.intake !== parseInt(aicteRaw.intake))) {
                existingCourse.intake = parseInt(aicteRaw.intake);
                existingCourse.source = "AICTE-ICEBERG";
                intakeUpdated++;
            }
        } else {
            // Add new course
            college.courses.push({
                name: aicteProgramName,
                intake: aicteRaw.intake ? parseInt(aicteRaw.intake) : null,
                duration: aicteRaw.duration || null,
                source: "AICTE-ICEBERG",
                session: aicteRaw.session || "2025-26"
            });
            coursesAdded++;
        }

        // Add provenance to the record
        college.sourceMetadata = {
            ...college.sourceMetadata,
            lastInboundSource: "AICTE-ICEBERG",
            promotedAt: new Date(),
            matchBasis: "exact_aishe_match"
        };

        // Every 500 rows, or when collegeId changes and we have a previous one, we could save.
        // But with cache, we'll save all at the end or in chunks.
        if (rowCount % 1000 === 0) {
            console.log(`📦 Processed ${rowCount} AICTE rows...`);
        }
    }

    console.log(`💾 Saving mutations for ${collegeCache.size} colleges...`);
    let savedCount = 0;
    for (const college of collegeCache.values()) {
        college.markModified('sourceMetadata');
        college.markModified('courses');
        await college.save();
        savedCount++;
        if (savedCount % 500 === 0) {
            process.stdout.write(`\r💾 Saved ${savedCount}/${collegeCache.size} colleges...`);
        }
    }

    ledgerStream.write(JSON.stringify({
        phase: "AICTE_PROMOTION",
        timestamp: new Date().toISOString(),
        rowsProcessed: rowCount,
        collegesEffected: collegeCount.size,
        coursesAdded,
        intakeUpdated
    }) + '\n');

    ledgerStream.end();
    console.log(`\n✅ Phase B Complete!`);
    console.log(`- Rows Processed: ${rowCount}`);
    console.log(`- Colleges Enriched: ${collegeCount.size}`);
    console.log(`- New Courses Added: ${coursesAdded}`);
    console.log(`- Intake Numbers Updated: ${intakeUpdated}`);

    const summary = {
        phase: "AICTE_PROMOTION",
        timestamp: new Date().toISOString(),
        collegesEnriched: collegeCount.size,
        coursesAdded,
        intakeUpdated
    };
    fs.writeFileSync(path.join(reportDir, 'selective_promotion_summary.json'), JSON.stringify(summary, null, 2));

    mongoose.connection.close();
}

run().catch(err => {
    console.error("Selective promotion failed:", err);
    process.exit(1);
});
