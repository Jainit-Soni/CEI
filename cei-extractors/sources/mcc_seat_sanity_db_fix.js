#!/usr/bin/env node

/**
 * CEI Phase 110B: Fix DB Corrupted Seats
 */

const { MongoClient } = require('mongodb');

async function main() {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    const db = client.db('cei_v2');

    console.log(`\n--- Phase 3: DB Clean Up ---`);
    const corruptedDbSeats = await db.collection('medical_seat_matrix').find({
        $or: [
            { seat_count: { $gt: 500 } },
            { seat_count: null },
            { seat_count: { $type: 'string' } }
        ]
    }).toArray();

    for (const s of corruptedDbSeats) {
        // Safe fallback is 0 to avoid breaking UI or showing inflated numbers.
        await db.collection('medical_seat_matrix').updateOne(
            { _id: s._id },
            { $set: { seat_count: 0 } }
        );
        console.log(`[FIXED] Inst: ${s.institution_id} | MCC_ID: ${s.mcc_id} -> seat_count: 0`);
    }

    console.log(`\nFixed ${corruptedDbSeats.length} corrupted rows in DB.`);
    await client.close();
}

main().catch(console.error);
