#!/usr/bin/env node

/**
 * MCC Auto-Provision Selector (Refined)
 * =====================================
 */

const fs = require('fs-extra');

const REGISTRY_PATH = 'e:/CMAT-PROBLEM/backend/data/truth/medical_identity_registry.json';
const SEAT_MATRIX_PATH = 'e:/CMAT-PROBLEM/cei-extractors/sources/output/mcc_ug_selected_docs/parsed_seat_matrix/mcc_ug_seat_matrix_clean_headers.ndjson';

async function main() {
    const registry = await fs.readJson(REGISTRY_PATH);
    const unmatched = registry.filter(r => r.linkStatus === 'UNMATCHED');

    // Load seat volumes
    const seatLines = fs.readFileSync(SEAT_MATRIX_PATH, 'utf8').split('\n').filter(Boolean);
    const seatVolumes = {}; 
    seatLines.forEach(l => {
        const d = JSON.parse(l);
        if (d.mcc_id) {
            seatVolumes[d.mcc_id] = (seatVolumes[d.mcc_id] || 0) + (d.seat_count || 0);
        }
    });

    const candidates = [];
    for (const entry of unmatched) {
        if (!entry.mccId) continue; // Skip if no MCC ID to anchor on

        const name = entry.rawName.toUpperCase();
        const seats = seatVolumes[entry.mccId] || 0;

        const isGMC = (name.includes('GOVT') || name.includes('GOVERNMENT') || name.includes('MEDICAL COLLEGE')) && 
                      !name.includes('DENTAL') && !name.includes('NURSING') && !name.includes('PRIVATE');

        if (isGMC && seats > 0) {
            candidates.push({
                mccId: entry.mccId,
                rawName: entry.rawName,
                seats: seats,
                state: inferState(name),
                source: 'MCC_SEAT_MATRIX_2025'
            });
        }
    }

    console.log(`\n--- Phase 1: Candidate Selection ---`);
    console.log(`GMC Candidates Found: ${candidates.length}`);
    
    const sorted = candidates.sort((a,b) => b.seats - a.seats);
    console.table(sorted.slice(0, 20));

    await fs.writeJson('e:/CMAT-PROBLEM/cei-extractors/output/mcc_provision_candidates_raw.json', sorted, { spaces: 2 });
}

function inferState(s) {
    const states = ["ANDHRA", "ARUNACHAL", "ASSAM", "BIHAR", "CHHATTISGARH", "GOA", "GUJARAT", "HARYANA", "HIMACHAL", "JHARKHAND", "KARNATAKA", "KERALA", "MADHYA", "MAHARASHTRA", "MANIPUR", "MEGHALAYA", "MIZORAM", "NAGALAND", "ODISHA", "PUNJAB", "RAJASTHAN", "SIKKIM", "TAMIL", "TELANGANA", "TRIPURA", "UTTAR", "UTTARAKHAND", "WEST BENGAL", "DELHI", "PUDUCHERRY"];
    for (const st of states) {
        if (s.includes(st)) return st;
    }
    return "UNKNOWN";
}

main().catch(console.error);
