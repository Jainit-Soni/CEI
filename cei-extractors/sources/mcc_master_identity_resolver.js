#!/usr/bin/env node

/**
 * MCC Master Identity Resolver
 * ============================
 * Merges Seat Matrix IDs with Result Names using Pincode + Name overlap.
 */

const fs = require('fs-extra');
const path = require('path');

const SEAT_MATRIX_PATH = 'e:/CMAT-PROBLEM/cei-extractors/sources/output/mcc_ug_selected_docs/parsed_seat_matrix/seat_matrix_row_candidates.ndjson';
const RESULTS_PATH = 'e:/CMAT-PROBLEM/cei-extractors/sources/output/mcc_ug_selected_docs/parsed_results/mcc_ug_closing_ranks_v2.ndjson';
const OUTPUT_PATH = 'e:/CMAT-PROBLEM/cei-extractors/output/medical_identity_registry_master.ndjson';

async function main() {
    console.log('Loading Seat Matrix IDs...');
    const smLines = fs.readFileSync(SEAT_MATRIX_PATH, 'utf8').split('\n').filter(Boolean);
    const idMap = new Map(); // pin -> { id, nameCandidates }

    for (const l of smLines) {
        const d = JSON.parse(l);
        const match = d.raw_line.match(/\((\d{6})\)/);
        const pinMatch = (d.raw_line + ' ' + d.previous_line).match(/\b(\d{6})\b/);
        
        if (match) {
            const id = match[1];
            const pin = pinMatch ? pinMatch[1] : 'UNKNOWN';
            if (!idMap.has(pin)) idMap.set(pin, []);
            idMap.get(pin).push({ id, raw: d.raw_line + ' ' + d.previous_line });
        }
    }

    console.log('Loading Result Names...');
    const resLines = fs.readFileSync(RESULTS_PATH, 'utf8').split('\n').filter(Boolean);
    const results = new Map(); // cleanName -> { raw, pin }

    for (const l of resLines) {
        const d = JSON.parse(l);
        const raw = d.institute_raw;
        const pinMatch = raw.match(/\b(\d{6})\b/);
        const pin = pinMatch ? pinMatch[1] : 'UNKNOWN';
        
        if (!results.has(raw)) {
            results.set(raw, { raw, pin });
        }
    }

    console.log(`Resolving ${results.size} result entities against ${idMap.size} pins...`);
    
    const resolved = [];
    for (const res of results.values()) {
        const candidates = idMap.get(res.pin) || [];
        let bestId = null;
        
        if (candidates.length === 1) {
            bestId = candidates[0].id;
        } else if (candidates.length > 1) {
            // Fuzzy match name
            let maxOverlap = 0;
            for (const cand of candidates) {
                const overlap = getOverlap(res.raw.toLowerCase(), cand.raw.toLowerCase());
                if (overlap > maxOverlap) {
                    maxOverlap = overlap;
                    bestId = cand.id;
                }
            }
        }

        resolved.push({
            result_name_raw: res.raw,
            mcc_id: bestId,
            pin: res.pin
        });
    }

    await fs.writeFile(OUTPUT_PATH, resolved.map(o => JSON.stringify(o)).join('\n') + '\n');
    console.log(`Saved master registry with ${resolved.filter(r => r.mcc_id).length} ID associations.`);
}

function getOverlap(a, b) {
    const tokensA = new Set(a.split(/[^a-z]/).filter(t => t.length > 3));
    const tokensB = new Set(b.split(/[^a-z]/).filter(t => t.length > 3));
    let intersect = 0;
    for (const t of tokensA) { if (tokensB.has(t)) intersect++; }
    return intersect;
}

main().catch(console.error);
