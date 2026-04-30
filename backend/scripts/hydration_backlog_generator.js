/**
 * backend/scripts/hydration_backlog_generator.js
 * ==============================================
 * Identifies institutions that are blocked from truth hydration due to 
 * identity confidence, but have significant data available in the database.
 * This guides the "Identity Upgrade" effort.
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const BACKLOG_PATH = path.join(__dirname, '..', 'data', 'truth', 'hydration_backlog.json');

async function generateBacklog() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;

        console.log('Scanning for hydration candidates...');
        const colleges = await db.collection('institutions').find({}).toArray();

        const backlog = [];

        for (const col of colleges) {
            const cid = col.institution_id || col.id;
            
            // Heuristic for "Has Data": check collections for seats or cutoffs
            const [cutoffCount, seatCount] = await Promise.all([
                db.collection('engineering_cutoffs').countDocuments({ institution_id: cid }),
                db.collection('seat_matrix').countDocuments({ institution_id: cid })
            ]);

            if (cutoffCount > 0 || seatCount > 0) {
                // Now check if it's currently HIGH confidence
                // (This is a bit slow for 13k, but okay for a batch script)
                // In a real system, we'd check the registry map.
                
                // For this script, we'll assume anything NOT in CORE- format is suspect
                const isCore = String(cid).startsWith('CORE-');
                
                if (!isCore) {
                    backlog.push({
                        institution_id: cid,
                        name: col.name,
                        state: col.state,
                        data_available: {
                            cutoffs: cutoffCount,
                            seats: seatCount
                        },
                        priority: cutoffCount + seatCount
                    });
                }
            }
        }

        // Sort by priority (most data first)
        backlog.sort((a, b) => b.priority - a.priority);

        fs.writeFileSync(BACKLOG_PATH, JSON.stringify(backlog, null, 2));
        console.log(`✅ Hydration Backlog generated: ${backlog.length} candidates.`);
        console.log(`Report written to: ${BACKLOG_PATH}`);

        process.exit(0);
    } catch (err) {
        console.error("❌ Backlog generation failed:", err.message);
        process.exit(1);
    }
}

generateBacklog();
