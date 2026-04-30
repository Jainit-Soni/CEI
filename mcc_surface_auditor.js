#!/usr/bin/env node

/**
 * CEI Phase 110: User-Facing Truth Surface Auditor
 * ================================================
 */

const bridge = require('./backend/services/seatCutoffBridge');
const mongoose = require('mongoose');

async function main() {
    await mongoose.connect('mongodb://localhost:27017/cei_v2');

    const sampleSet = {
        'Engineering Elite': [
            { id: 'CORE-IIT-BOMBAY', name: 'IIT Bombay' },
            { id: 'CORE-IIT-DELHI', name: 'IIT Delhi' },
            { id: 'CORE-NIT-TRICHY', name: 'NIT Trichy' },
            { id: 'CORE-BITS-PILANI', name: 'BITS Pilani' },
            { id: 'CORE-IIIT-HYDERABAD', name: 'IIIT Hyderabad' }
        ],
        'Public Medical': [
            { id: 'CORE-AIIMS-DELHI', name: 'AIIMS Delhi' },
            { id: 'MCC-GMC-200124', name: 'Lt. B R K Government Medical College' },
            { id: 'MCC-GMC-200169', name: 'GOVT. D.C. & RESEARCH INST' },
            { id: 'MCC-GMC-200473', name: 'Government Medical College Firozabad' },
            { id: 'MCC-GMC-200564', name: 'Government Medical College' }
        ],
        'Held Medical': [
            { id: 'C-28507', name: 'Maulana Azad Institute of Dental Sciences' },
            { id: 'C-59392', name: 'ESIC Dental College' },
            { id: 'CORE-VMMC-DELHI', name: 'Vardhman Mahavir Medical College' }
        ]
    };

    console.log(`\n--- Phase 2 & 3: UI Truth & Trust Badge Check ---`);

    let copyIssues = 0;

    for (const [group, nodes] of Object.entries(sampleSet)) {
        console.log(`\n[${group}]`);
        for (const node of nodes) {
            try {
                const results = await bridge.getSeatsAndCutoffsForCollege(node.id);
                const compliance = bridge.normalizeComplianceItems(results);
                
                console.log(`\n- ${node.name} (${node.id})`);
                console.log(`  Seats Available: ${results.seats.length > 0}`);
                console.log(`  Cutoffs Available: ${results.cutoffs.length > 0}`);
                console.log(`  Link Status: ${results.metadata.medical_link_status || 'N/A'}`);
                
                if (compliance.length === 0) {
                    console.log(`  WARNING: No compliance items generated. (Is this expected?)`);
                    copyIssues++;
                }

                compliance.forEach((c, idx) => {
                    console.log(`  Compliance [${idx}]: Label: '${c.displayLabel}', Value: '${c.value}'`);
                    if (c.source) {
                        console.log(`    Source: '${c.source.title}' | Freshness: '${c.source.freshness}' | Disclaimer: '${c.source.disclaimer || 'NONE'}'`);
                    } else {
                        console.log(`    WARNING: Missing source block!`);
                        copyIssues++;
                    }
                });

                if (results.seats.length === 0 && results.cutoffs.length === 0) {
                    console.log(`  UNAVAILABLE STATE: Frontend typically shows "Official data unavailable."`);
                }

            } catch (e) {
                console.log(`- ${node.name} (${node.id}) -> Error: ${e.message}`);
            }
        }
    }

    console.log(`\n--- Phase 4: Misinterpretation Test ---`);
    console.log(`- MCC AIQ seats = total seats? -> Mitigated if 'MCC AIQ Seats' label and disclaimer are present.`);
    console.log(`- Unavailable = college has no data? -> Mitigated if frontend copy says "Official data unavailable" instead of "No data".`);
    console.log(`- Dental vs MBBS? -> Mitigated by holding dental nodes.`);
    console.log(`- Shell nodes look public? -> Mitigated by isVisible: false filter in search.`);
    
    console.log(`\n--- Phase 6: Release Readiness ---`);
    console.log(`Copy Issues Found: ${copyIssues}`);

    await mongoose.disconnect();
}

main().catch(console.error);
