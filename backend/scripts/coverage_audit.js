const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function runAudit() {
    console.log("📊 Starting CEI Truth Coverage Audit (Tiered)...");
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
    const db = mongoose.connection.db;

    const institutions = await db.collection('institutions').find({}).toArray();
    const totalInstitutions = institutions.length;

    // Build sets of institution_ids that have cutoffs/seats in separate collections
    const cutoffInstitutions = new Set(
        (await db.collection('engineering_cutoffs')
            .distinct('institution_id'))
    );
    const seatInstitutions = new Set(
        (await db.collection('seat_matrix')
            .distinct('institution_id'))
    );

    console.log(`  Cutoff sources: ${cutoffInstitutions.size} institutions`);
    console.log(`  Seat sources: ${seatInstitutions.size} institutions`);

    let tierA = 0, tierB = 0, tierC = 0, tierD = 0;

    for (const c of institutions) {
        let count = 0;
        const instId = c.institution_id;

        if (c.fees?.isVerified || c.fees?.totalFee) count++;
        if (c.placements?.isVerified || c.placements?.averagePackage) count++;

        // Check runtime-joined data from separate collections
        if (
            cutoffInstitutions.has(instId) ||
            (c.coverage?.cutoffCoverage && c.coverage.cutoffCoverage !== 'None')
        ) count++;

        if (
            seatInstitutions.has(instId) ||
            (c.coverage?.seatCoverage && c.coverage.seatCoverage !== 'None')
        ) count++;

        if (count === 4) tierA++;
        else if (count === 3) tierB++;
        else if (count === 2) tierC++;
        else tierD++;
    }

    console.log("\n==========================================");
    console.log(`Total Institutions:     ${totalInstitutions.toLocaleString()}`);
    console.log(`Tier A (4/4 Complete):  ${tierA.toLocaleString()} (${((tierA/totalInstitutions)*100).toFixed(2)}%)`);
    console.log(`Tier B (3/4 Complete):  ${tierB.toLocaleString()} (${((tierB/totalInstitutions)*100).toFixed(2)}%)`);
    console.log(`Tier C (2/4 Complete):  ${tierC.toLocaleString()} (${((tierC/totalInstitutions)*100).toFixed(2)}%)`);
    console.log(`Tier D (Minimal Data):  ${tierD.toLocaleString()} (${((tierD/totalInstitutions)*100).toFixed(2)}%)`);
    console.log("==========================================\n");

    process.exit(0);
}

runAudit().catch(err => {
    console.error("❌ Audit Error:", err);
    process.exit(1);
});
