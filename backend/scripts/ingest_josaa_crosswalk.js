/**
 * backend/scripts/ingest_josaa_crosswalk.js
 * ========================================
 * Builds the authoritative JoSAA institute crosswalk collection.
 * Source: Raw JoSAA selects inventory.
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const identityEnforcement = require('../lib/identityEnforcement');

const RAW_SELECTS_PATH = 'e:\\CMAT-PROBLEM\\cei-extractors\\output\\raw\\josaa_2026-04-13T09-31-17-680Z\\josaa_admissions_nic_in__applicant__seatmatrix__seatmatrixinfo.aspx__selects.json';

async function ingest() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;

        // Create collection and indexes
        const collection = db.collection('josaa_institutes');
        await collection.createIndex({ josaa_code: 1 }, { unique: true });
        await collection.createIndex({ institution_id: 1 });

        console.log('Reading JoSAA raw selects...');
        const selects = JSON.parse(fs.readFileSync(RAW_SELECTS_PATH, 'utf8'));
        const instituteSelect = selects.find(s => s.id.includes('ddlInstitute'));

        if (!instituteSelect) {
            throw new Error('Could not find ddlInstitute in selects.json');
        }

        const rawMappings = instituteSelect.options.filter(o => o.value !== '0');
        console.log(`Processing ${rawMappings.length} JoSAA institutes...`);

        const bulkOps = [];
        const conflicts = [];
        const resolvedIds = new Set();

        for (const mapping of rawMappings) {
            const josaa_code = mapping.value;
            const officialName = mapping.text;

            const institution_id = identityEnforcement.resolveCanonicalId(officialName);

            if (institution_id && institution_id.startsWith('CORE-')) {
                // Check for 1:1 integrity
                if (resolvedIds.has(institution_id)) {
                    conflicts.push({ josaa_code, officialName, institution_id, reason: 'DUPLICATE_INSTITUTION_ID' });
                }
                resolvedIds.add(institution_id);

                bulkOps.push({
                    updateOne: {
                        filter: { josaa_code },
                        update: {
                            $set: {
                                josaa_code,
                                institute_name_official: officialName,
                                institution_id,
                                source: 'JOSAA',
                                verified: true,
                                last_updated: new Date()
                            }
                        },
                        upsert: true
                    }
                });
            } else {
                console.warn(`⚠️ Unlinked JoSAA Code ${josaa_code}: ${officialName}`);
                bulkOps.push({
                    updateOne: {
                        filter: { josaa_code },
                        update: {
                            $set: {
                                josaa_code,
                                institute_name_official: officialName,
                                institution_id: 'UNLINKED',
                                source: 'JOSAA',
                                verified: false,
                                last_updated: new Date()
                            }
                        },
                        upsert: true
                    }
                });
            }
        }

        if (bulkOps.length > 0) {
            const result = await collection.bulkWrite(bulkOps);
            console.log(`\n✅ Ingestion Complete:
- Upserted: ${result.upsertedCount}
- Modified: ${result.modifiedCount}
- Total:    ${bulkOps.length}`);
        }

        if (conflicts.length > 0) {
            console.warn(`\n🚨 Detected ${conflicts.length} mapping conflicts:`);
            console.warn(JSON.stringify(conflicts, null, 2));
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

ingest();
