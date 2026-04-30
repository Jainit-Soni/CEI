/**
 * backend/scripts/post_migration_audit.js
 * ========================================
 * Verifies identity integrity after full recode migration.
 * Checks for remaining legacy IDs and validates data surfacing.
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: 'backend/.env.local' });

const COLLECTIONS = ['engineering_cutoffs', 'seat_matrix', 'institutions'];
const SAMPLES = [
    'CORE-IIT-BOMBAY',
    'CORE-IIT-DELHI',
    'CORE-IIT-MADRAS',
    'CORE-IIT-KANPUR',
    'CORE-NIT-TRICHY',
    'CORE-NIT-SURATHKAL',
    'CORE-NIT-WARANGAL',
    'CORE-IIIT-ALLAHABAD',
    'CORE-IIIT-VADODARA',
    'CORE-IIT-PATNA'
];

async function verifyIntegrity() {
    try {
        console.log("--- 🕵️ Post-Migration Identity Integrity Audit ---");
        
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;

        const report = {
            legacy_counts: {},
            sample_resolutions: [],
            failures: []
        };

        // 1. Check for remaining legacy verbose IDs
        console.log("\nChecking for remaining legacy IDs...");
        const legacyRegex = /CORE-(INDIAN-INSTITUTE-OF-TECHNOLOGY|NATIONAL-INSTITUTE-OF-TECHNOLOGY|INDIAN-INSTITUTE-OF-INFORMATION-TECHNOLOGY)/;
        
        for (const collName of COLLECTIONS) {
            const count = await db.collection(collName).countDocuments({
                institution_id: { $regex: legacyRegex }
            });
            report.legacy_counts[collName] = count;
            if (count > 0) report.failures.push(`Found ${count} legacy IDs in ${collName}`);
        }

        // 2. Sample Data surfacing (using mongo directly to avoid API probe delay here)
        console.log("\nVerifying sample resolutions...");
        for (const id of SAMPLES) {
            const inst = await db.collection('institutions').findOne({ institution_id: id });
            const cutoffs = await db.collection('engineering_cutoffs').countDocuments({ institution_id: id });
            const seats = await db.collection('seat_matrix').countDocuments({ institution_id: id });
            
            const status = (inst && cutoffs > 0 && seats > 0) ? "PASS" : "FAIL";
            report.sample_resolutions.push({
                id,
                name: inst ? inst.name : "MISSING",
                cutoffs,
                seats,
                status
            });
            
            if (status === "FAIL") {
                report.failures.push(`Data surfacing failed for ${id} (Inst: ${!!inst}, Cutoffs: ${cutoffs}, Seats: ${seats})`);
            }
        }

        // 3. Output Table
        console.log("\n--- Legacy ID Census ---");
        console.table(report.legacy_counts);

        console.log("\n--- Sample Health Checks ---");
        console.table(report.sample_resolutions);

        if (report.failures.length > 0) {
            console.error("\n❌ AUDIT FAILED:");
            report.failures.forEach(f => console.error(` - ${f}`));
            process.exit(1);
        } else {
            console.log("\n✅ AUDIT PASSED: Identity integrity is 100%.");
            process.exit(0);
        }
    } catch (err) {
        console.error("❌ Audit Failed:", err);
        process.exit(1);
    }
}

verifyIntegrity();
