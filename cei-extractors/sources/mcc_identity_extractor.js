#!/usr/bin/env node

/**
 * MCC Identity Extractor (Refined)
 * ================================
 * Extracts (mccId, collegeName, state) from raw seat matrix candidate lines.
 */

const fs = require('fs-extra');
const path = require('path');

const INPUT_PATH = 'e:/CMAT-PROBLEM/cei-extractors/sources/output/mcc_ug_selected_docs/parsed_seat_matrix/seat_matrix_row_candidates.ndjson';
const OUTPUT_PATH = 'e:/CMAT-PROBLEM/cei-extractors/output/medical_identity_raw_registry.ndjson';

async function main() {
    const lines = fs.readFileSync(INPUT_PATH, 'utf8').split('\n').filter(Boolean);
    const registry = new Map();

    console.log(`Processing ${lines.length} candidate lines...`);

    for (let i = 0; i < lines.length; i++) {
        const doc = JSON.parse(lines[i]);
        const line = doc.raw_line;
        const match = line.match(/\((\d{6})\)/);

        if (match) {
            const mccId = match[1];
            let namePart = line.split('(' + mccId + ')')[0].trim();
            
            // If namePart is empty or just state, look at previous lines
            if (namePart.length < 10) {
                // Peek back up to 3 lines
                let joined = namePart;
                for (let j = 1; j <= 3; j++) {
                    if (i - j < 0) break;
                    const prevDoc = JSON.parse(lines[i - j]);
                    // Don't go past another ID
                    if (prevDoc.raw_line.includes('(') && prevDoc.raw_line.match(/\(\d{6}\)/)) break;
                    joined = prevDoc.raw_line + ' ' + joined;
                    if (joined.length > 20) break;
                }
                namePart = joined.trim();
            }

            // Cleanup name
            let cleanName = namePart
                .replace(/^\w+\s+Pradesh/i, '') // Remove State if at start
                .replace(/All India|Deemed\/Paid Seats|Open Seat|Quota/gi, '')
                .replace(/MBBS|BDS|B\.Sc/g, '')
                .replace(/,\s*$/g, '')
                .trim();

            if (!registry.has(mccId) || cleanName.length > registry.get(mccId).name.length) {
                registry.set(mccId, {
                    mccId,
                    name: cleanName,
                    state: inferState(line, doc.previous_line)
                });
            }
        }
    }

    const out = Array.from(registry.values());
    await fs.writeFile(OUTPUT_PATH, out.map(o => JSON.stringify(o)).join('\n') + '\n', 'utf8');
    console.log(`Extracted ${out.length} unique MCC identities.`);
}

function inferState(line, prev) {
    const states = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi", "Chandigarh", "Puducherry", "Andaman", "Lakshadweep", "Ladakh", "Jammu"];
    for (const s of states) {
        if (line.includes(s) || (prev && prev.includes(s))) return s;
    }
    return null;
}

main().catch(console.error);
