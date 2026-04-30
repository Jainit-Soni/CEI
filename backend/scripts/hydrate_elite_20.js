const mongoose = require('mongoose');
const fs = require('fs');
const readline = require('readline');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });
const { resolveCanonicalId } = require('../lib/identityEnforcement');

async function parseNdjson(filePath) {
    const records = [];
    const fileStream = fs.createReadStream(filePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
    for await (const line of rl) {
        if (line.trim()) {
            records.push(JSON.parse(line));
        }
    }
    return records;
}

async function hydrate() {
    console.log("🚀 Starting Bulk Elite Hydration...");
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
    const db = mongoose.connection.db;

    const feesData = await parseNdjson(path.join(__dirname, '../data/truth/core_fees_v2.ndjson'));
    const placementsData = await parseNdjson(path.join(__dirname, '../data/truth/core_placements_v2.ndjson'));

    console.log(`Loaded ${feesData.length} fee records and ${placementsData.length} placement records.`);

    // Pre-resolve canonical IDs for all truth records
    const feeMap = new Map();
    for (const f of feesData) {
        const cid = resolveCanonicalId(f.name);
        if (cid) feeMap.set(cid, f);
    }

    const placementMap = new Map();
    for (const p of placementsData) {
        const cid = resolveCanonicalId(p.name);
        if (cid) placementMap.set(cid, p);
    }

    const allCids = new Set([...feeMap.keys(), ...placementMap.keys()]);
    console.log(`Unique canonical institutions to update: ${allCids.size}`);

    let hydrated = 0;
    let skipped = 0;

    for (const cid of allCids) {
        const feeMatch = feeMap.get(cid);
        const placementMatch = placementMap.get(cid);

        const updateDoc = {};

        if (feeMatch) {
            updateDoc.fees = {
                totalFee: feeMatch.totalFee,
                hostelFees: feeMatch.hostelFees,
                isVerified: true,
                source_authority: "official_institute",
                academic_year: feeMatch.session,
                extracted_at: new Date(),
                stale_after_days: 365,
                provenance: {
                    sourceName: feeMatch.source,
                    sourceDocumentType: "Official Fee Circular",
                    sourceFamily: "Institute",
                    academicSession: feeMatch.session,
                    freshness: new Date().toISOString()
                }
            };
        }

        if (placementMatch) {
            updateDoc.placements = {
                averagePackage: placementMatch.averagePackage ? `${placementMatch.averagePackage} Lakh` : undefined,
                highestPackage: placementMatch.highestPackage ? `${placementMatch.highestPackage} Lakh` : undefined,
                placedPercentage: placementMatch.placedPercentage,
                academicYear: placementMatch.academicYear,
                isVerified: true,
                source_authority: "official_institute",
                academic_year: placementMatch.academicYear,
                extracted_at: new Date(),
                stale_after_days: 365,
                provenance: {
                    sourceName: placementMatch.source,
                    sourceDocumentType: "Official Placement Report",
                    sourceFamily: "Institute",
                    academicYear: placementMatch.academicYear,
                    freshness: new Date().toISOString()
                }
            };
        }

        if (Object.keys(updateDoc).length > 0) {
            const result = await db.collection('institutions').updateOne(
                { institution_id: cid },
                { $set: updateDoc }
            );
            
            if (result.matchedCount > 0) {
                console.log(`✅ Hydrated ${cid}`);
                hydrated++;
            } else {
                // Try 'id' field as fallback
                const result2 = await db.collection('institutions').updateOne(
                    { id: cid },
                    { $set: updateDoc }
                );
                if (result2.matchedCount > 0) {
                    console.log(`✅ Hydrated ${cid} (via id)`);
                    hydrated++;
                } else {
                    console.log(`⚠️  Could not find DB record for ${cid}`);
                    skipped++;
                }
            }
        }
    }

    console.log(`\nBulk Hydration Complete: ${hydrated} updated, ${skipped} missing in catalog.`);
    process.exit(0);
}

hydrate().catch(err => {
    console.error("❌ Fatal Hydration Error:", err);
    process.exit(1);
});
