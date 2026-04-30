/**
 * backend/scripts/promote_josaa_mappings.js
 * =========================================
 * Connects JoSAA mappings to Registry Evolution.
 * Promotes high-confidence normalized matches to registry candidates.
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function promote() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;

        console.log('Fetching Medium Confidence JoSAA Mappings...');
        const mappings = await db.collection('josaa_mappings').find({ 
            confidence: 'medium',
            match_type: 'normalized_exact'
        }).toArray();

        console.log(`Analyzing ${mappings.length} candidates for promotion...`);

        const candidates = [];

        for (const m of mappings) {
            const josaa_code = m.josaa_code;
            
            // Check appearance in sources
            const cutoffCount = await db.collection('engineering_cutoffs').countDocuments({ josaa_code });
            const seatCount = await db.collection('seat_matrix').countDocuments({ josaa_code });

            const sourceCount = (cutoffCount > 0 ? 1 : 0) + (seatCount > 0 ? 1 : 0);

            if (sourceCount >= 2) {
                console.log(`🎯 Candidate Approved: ${m.institute_name_raw} -> ${m.institution_id} (Sources: ${sourceCount})`);
                candidates.push({
                    josaa_code: m.josaa_code,
                    institute_name_raw: m.institute_name_raw,
                    institution_id: m.institution_id,
                    reason: "Verified via multiple JoSAA sources (Cutoffs + Seats)",
                    source_stats: { cutoffCount, seatCount },
                    timestamp: new Date()
                });
            }
        }

        if (candidates.length > 0) {
            console.log(`\nStoring ${candidates.length} approved candidates...`);
            const violationColl = db.collection('identity_violations');
            
            for (const cand of candidates) {
                await violationColl.updateOne(
                    { josaa_code: cand.josaa_code },
                    { 
                        $set: {
                            ...cand,
                            status: "approved_candidate",
                            promotion_type: "JOSAA_ALIAS_PROMOTION"
                        }
                    },
                    { upsert: true }
                );
            }
            console.log('✅ Candidates stored in identity_violations.');
        } else {
            console.log('No candidates met the promotion criteria.');
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

promote();
