#!/usr/bin/env node

/**
 * MCC Rehydration Script (Resilient Aggregation v2)
 * ==============================================
 */

const fs = require('fs-extra');
const { MongoClient } = require('mongodb');

const REGISTRY_PATH = 'e:/CMAT-PROBLEM/backend/data/truth/medical_identity_registry.json';
const CUTOFF_SOURCE = 'e:/CMAT-PROBLEM/cei-extractors/sources/output/mcc_ug_selected_docs/parsed_results/cutoff_tuples_v2.ndjson';
const SEATS_SOURCE = 'e:/CMAT-PROBLEM/cei-extractors/sources/output/mcc_ug_selected_docs/parsed_seat_matrix/mcc_ug_seat_matrix_clean_headers.ndjson';

async function main() {
    const client = new MongoClient('mongodb://localhost:27017');
    await client.connect();
    const db = client.db('cei_v2');

    console.log('Loading Registry...');
    const registryLines = await fs.readJson(REGISTRY_PATH);

    // 1. Process Cutoffs
    console.log('Hydrating Cutoffs...');
    const cutoffLines = fs.readFileSync(CUTOFF_SOURCE, 'utf8').split('\n').filter(Boolean);
    const aggregatedCutoffs = new Map();

    for (const l of cutoffLines) {
        const d = JSON.parse(l);
        const reg = registryLines.find(r => r.mccId === d.mcc_id && r.linkStatus === 'LINKED');
        if (!reg) continue;

        const quota = d.quota_canonical || 'UNKNOWN';
        const category = normalizeCategory(d.category_canonical);
        const course = d.course_canonical || 'MBBS';
        
        const key = `${reg.targetId}||${d.round_inferred}||${course}||${quota}||${category}`;
        
        if (!aggregatedCutoffs.has(key)) {
            aggregatedCutoffs.set(key, {
                institution_id: reg.targetId,
                institution_name: reg.targetName,
                round: d.round_inferred,
                course: course,
                quota: quota,
                category: category,
                closing_rank: d.rank,
                bridge: {
                    mcc_id: reg.mccId,
                    mapping_rule: reg.linkReason,
                    is_manual_override: reg.linkReason === 'Manual Override' || reg.linkReason.includes('Auto-Provisioned')
                }
            });
        } else {
            const existing = aggregatedCutoffs.get(key);
            if (d.rank > existing.closing_rank) {
                existing.closing_rank = d.rank;
            }
        }
    }

    const cutoffOps = Array.from(aggregatedCutoffs.values()).map(c => {
        const stableKey = `MCC||CUTOFF||${c.round}||${c.institution_id}||${c.course}||${c.quota}||${c.category}`;
        const { bridge, ...data } = c;
        return {
            updateOne: {
                filter: { stable_import_key: stableKey },
                update: { $set: {
                    stable_import_key: stableKey,
                    ...data,
                    authority: 'MCC',
                    identity_bridge: {
                        ...bridge,
                        registry_version: '108C'
                    },
                    ingested_at: new Date()
                }},
                upsert: true
            }
        };
    });

    if (cutoffOps.length > 0) await db.collection('medical_cutoffs').bulkWrite(cutoffOps);
    console.log(`Ingested ${cutoffOps.length} aggregated cutoffs.`);

    // 2. Process Seats
    console.log('Hydrating Seats...');
    const seatLines = fs.readFileSync(SEATS_SOURCE, 'utf8').split('\n').filter(Boolean);
    const aggregatedSeats = new Map();

    for (const l of seatLines) {
        const d = JSON.parse(l);
        const reg = registryLines.find(r => r.mccId === d.mcc_id && r.linkStatus === 'LINKED');
        if (!reg) continue;

        const mccId = d.mcc_id || null;
        const key = `${mccId}_${d.course_canonical}_${d.quota_canonical}_${d.category_canonical || 'OPEN'}`;

        // --- SEAT COUNT REGRESSION GUARD (PHASE 110B) ---
        if (typeof d.seat_count !== 'number' || d.seat_count > 500 || (mccId && d.seat_count === parseInt(mccId, 10))) {
            console.error(`[REGRESSION GUARD FAILED] Corrupted seat_count detected: ${d.seat_count} for MCC_ID: ${mccId}`);
            process.exit(1);
        }

        if (!aggregatedSeats.has(key)) {
            aggregatedSeats.set(key, {
                institution_id: reg.targetId,
                institution_name: reg.targetName,
                round: d.round_inferred,
                course: d.course_canonical,
                quota: d.quota_canonical,
                category: d.category_canonical,
                seat_count: d.seat_count,
                bridge: {
                    mcc_id: reg.mccId,
                    mapping_rule: reg.linkReason,
                    is_manual_override: reg.linkReason === 'Manual Override' || reg.linkReason.includes('Auto-Provisioned')
                }
            });
        } else {
            aggregatedSeats.get(key).seat_count += d.seat_count;
        }
    }

    const seatOps = Array.from(aggregatedSeats.values()).map(s => {
        const stableKey = `MCC||SEATS||${s.round}||${s.institution_id}||${s.course}||${s.quota}||${s.category}`;
        const { bridge, ...data } = s;
        return {
            updateOne: {
                filter: { stable_import_key: stableKey },
                update: { $set: {
                    stable_import_key: stableKey,
                    ...data,
                    authority: 'MCC',
                    identity_bridge: {
                        ...bridge,
                        registry_version: '108C'
                    },
                    ingested_at: new Date()
                }},
                upsert: true
            }
        };
    });

    if (seatOps.length > 0) await db.collection('medical_seat_matrix').bulkWrite(seatOps);
    console.log(`Ingested ${seatOps.length} aggregated seats.`);

    await client.close();
}

function normalizeCategory(t) {
  t = String(t || '').toUpperCase();
  let base = null;
  if (t.includes('OBC')) base = 'OBC';
  else if (t.includes('EWS')) base = 'EWS';
  else if (t.includes('SC')) base = 'SC';
  else if (t.includes('ST')) base = 'ST';
  else base = 'OPEN';

  if (t.includes('PWD')) return `${base}_PWD`;
  return base;
}

main().catch(console.error);
