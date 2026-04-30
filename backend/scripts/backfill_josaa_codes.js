/**
 * backend/scripts/backfill_josaa_codes.js
 * ======================================
 * Backfills missing josaa_code into MongoDB collections using raw JoSAA inventory.
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const identityEnforcement = require('../lib/identityEnforcement');

const RAW_SELECTS_PATH = 'e:\\CMAT-PROBLEM\\cei-extractors\\output\\raw\\josaa_2026-04-13T09-31-17-680Z\\josaa_admissions_nic_in__applicant__seatmatrix__seatmatrixinfo.aspx__selects.json';
const REPORT_PATH = path.join(__dirname, '..', 'data', 'truth', 'josaa_code_coverage_report.json');

async function backfill() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;

        console.log('Reading JoSAA raw selects...');
        const selects = JSON.parse(fs.readFileSync(RAW_SELECTS_PATH, 'utf8'));
        const instituteSelect = selects.find(s => s.id.includes('ddlInstitute'));

        if (!instituteSelect) {
            throw new Error('Could not find ddlInstitute in selects.json');
        }

        const rawMappings = instituteSelect.options.filter(o => o.value !== '0');
        console.log(`Found ${rawMappings.length} JoSAA institutes in raw data.`);

        const codeMap = {}; // institution_id -> josaa_code
        const stats = {
            total: rawMappings.length,
            resolved: 0,
            failed: 0,
            conflicts: 0
        };

        const resolutionReport = [];

        console.log('Resolving JoSAA names to canonical IDs...');
        for (const mapping of rawMappings) {
            const rawName = mapping.text;
            const code = mapping.value;

            const resolvedId = identityEnforcement.resolveCanonicalId(rawName);

            if (resolvedId && String(resolvedId).startsWith('CORE-')) {
                if (codeMap[resolvedId] && codeMap[resolvedId] !== code) {
                    console.warn(`🚨 Conflict: ${resolvedId} already mapped to ${codeMap[resolvedId]}, trying to map to ${code}`);
                    stats.conflicts++;
                    resolutionReport.push({ rawName, code, status: 'CONFLICT', resolvedId });
                } else {
                    codeMap[resolvedId] = code;
                    stats.resolved++;
                    resolutionReport.push({ rawName, code, status: 'RESOLVED', resolvedId });
                }
            } else {
                console.warn(`❌ Failed to resolve: ${rawName}`);
                stats.failed++;
                resolutionReport.push({ rawName, code, status: 'FAILED' });
            }
        }

        console.log(`\nResolution Summary:
- Resolved: ${stats.resolved}
- Failed:   ${stats.failed}
- Conflict: ${stats.conflicts}
`);

        const institutionIds = Object.keys(codeMap);

        // --- UPDATE ENGINEERING CUTOFFS ---
        console.log('Updating engineering_cutoffs...');
        let cutoffUpdates = 0;
        for (const id of institutionIds) {
            const result = await db.collection('engineering_cutoffs').updateMany(
                { institution_id: id, source_authority: { $in: ['JOSAA', 'CSAB', 'JoSAA', 'csab'] } },
                { $set: { josaa_code: codeMap[id] } }
            );
            cutoffUpdates += result.modifiedCount;
        }
        console.log(`Updated ${cutoffUpdates} documents in engineering_cutoffs.`);

        // --- UPDATE SEAT MATRIX ---
        console.log('Updating seat_matrix...');
        let seatUpdates = 0;
        for (const id of institutionIds) {
            const result = await db.collection('seat_matrix').updateMany(
                { 
                    institution_id: id, 
                    $or: [
                        { source_url: { $regex: /josaa|seatmatrix/i } },
                        { source_row_fingerprint: { $regex: /^JOSAA/ } }
                    ]
                },
                { 
                    $set: { 
                        josaa_code: codeMap[id],
                        source_authority: 'JOSAA' 
                    } 
                }
            );
            seatUpdates += result.modifiedCount;
        }
        console.log(`Updated ${seatUpdates} documents in seat_matrix.`);

        // --- UPDATE INSTITUTIONS ---
        console.log('Updating institutions...');
        let instUpdates = 0;
        for (const id of institutionIds) {
            const result = await db.collection('institutions').updateOne(
                { institution_id: id },
                { $set: { josaa_code: codeMap[id] } }
            );
            instUpdates += result.modifiedCount;
        }
        console.log(`Updated ${instUpdates} institutions.`);

        // Write report
        const report = {
            timestamp: new Date().toISOString(),
            stats,
            resolution_details: resolutionReport,
            db_updates: {
                engineering_cutoffs: cutoffUpdates,
                seat_matrix: seatUpdates,
                institutions: instUpdates
            }
        };
        fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));

        console.log(`\n🔥 BACKFILL COMPLETE. Report saved to ${REPORT_PATH}`);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

backfill();
