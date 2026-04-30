#!/usr/bin/env node

/**
 * CEI Phase 110B: Seat Count Sanity Regression
 * ============================================
 */

const fs = require('fs-extra');
const { MongoClient } = require('mongodb');
const readline = require('readline');

const NDJSON_PATH = 'e:/CMAT-PROBLEM/cei-extractors/sources/output/mcc_ug_selected_docs/parsed_seat_matrix/mcc_ug_seat_matrix_clean_headers.ndjson';

async function main() {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    const db = client.db('cei_v2');

    console.log(`\n--- Phase 1: DB Scan ---`);
    const corruptedDbSeats = await db.collection('medical_seat_matrix').find({
        $or: [
            { seat_count: { $gt: 500 } },
            { seat_count: null },
            { seat_count: { $type: 'string' } }
        ]
    }).toArray();

    console.log(`Found ${corruptedDbSeats.length} corrupted rows in DB.`);
    corruptedDbSeats.forEach(s => {
        console.log(`[DB CORRUPT] Inst: ${s.institution_id} | MCC_ID: ${s.mcc_id} | Seat Count: ${s.seat_count}`);
    });

    console.log(`\n--- Phase 2: Source NDJSON Scan ---`);
    const fileStream = fs.createReadStream(NDJSON_PATH);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    const corruptedNdjsonRows = [];
    const cleanLines = [];
    let lineNum = 0;

    for await (const line of rl) {
        lineNum++;
        if (!line.trim()) continue;
        try {
            const doc = JSON.parse(line);
            const rawCount = doc.seat_count;
            let isCorrupt = false;
            let reason = '';

            if (typeof rawCount !== 'number') {
                isCorrupt = true; reason = 'Not numeric';
            } else if (rawCount > 500) {
                isCorrupt = true; reason = 'Exceeds 500';
            } else if (rawCount === parseInt(doc.mcc_id, 10)) {
                isCorrupt = true; reason = 'Matches MCC ID';
            }

            if (isCorrupt) {
                console.log(`[NDJSON CORRUPT L${lineNum}] MCC: ${doc.mcc_id} | Count: ${rawCount} | Reason: ${reason} | Raw: ${doc.provenance.raw_line}`);
                corruptedNdjsonRows.push(doc);
                // Fix it by attempting to parse from raw_line, or fallback to 0
                const match = doc.provenance.raw_line.match(/\s(\d+)$/);
                if (match && parseInt(match[1], 10) < 500) {
                    doc.seat_count = parseInt(match[1], 10);
                    console.log(`  -> Fixed to: ${doc.seat_count}`);
                } else {
                    doc.seat_count = 0; // Safe fallback
                    console.log(`  -> Fixed to fallback: 0`);
                }
            }
            
            cleanLines.push(JSON.stringify(doc));

        } catch (e) {
            console.error(`Error parsing line ${lineNum}: ${e.message}`);
        }
    }

    console.log(`Found ${corruptedNdjsonRows.length} corrupted rows in source NDJSON.`);

    // Write back clean ndjson
    if (corruptedNdjsonRows.length > 0) {
        await fs.writeFile(NDJSON_PATH, cleanLines.join('\n') + '\n');
        console.log(`\nFixed source NDJSON saved.`);
    }

    await client.close();
}

main().catch(console.error);
