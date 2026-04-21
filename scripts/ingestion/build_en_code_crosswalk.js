/**
 * scripts/ingestion/build_en_code_crosswalk.js
 * ==============================================
 * Phase 3 Extension: Maharashtra EN-code → AICTE-ID Crosswalk
 * 
 * ONLY uses deterministic methods:
 *   1. Exact normalized name + state=Maharashtra (unique match only)
 *   2. Exact city + state corroboration for multi-match resolution
 *
 * Outputs:
 *   backend/data/mappings/en_code_crosswalk.ndjson  (resolved)
 *   backend/data/mappings/en_code_review_queue.json (ambiguous/unresolved)
 */

const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: 'backend/.env.local' });

const DATA_DIR     = path.join(__dirname, '..', '..', 'backend', 'data');
const TRUTH_DIR    = path.join(DATA_DIR, 'truth');
const MAPPINGS_DIR = path.join(DATA_DIR, 'mappings');

function normStr(s) { return (s||'').toLowerCase().replace(/[^a-z0-9]/g, ''); }

function parseCSVLine(line) {
    const result = [];
    let cur = '', inQ = false;
    for (const c of line) {
        if (c === '"') inQ = !inQ;
        else if (c === ',' && !inQ) { result.push(cur); cur = ''; }
        else cur += c;
    }
    result.push(cur);
    return result;
}

async function main() {
    console.log('[EN-Crosswalk] Starting Maharashtra EN-Code Bridge...');

    // 1. Fetch all AICTE docs from Maharashtra
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db('cei_v2');
    const aicteDocs = await db.collection('institutions').find({ state_name: 'Maharashtra' }).toArray();
    await client.close();

    console.log(`[EN-Crosswalk] AICTE Maharashtra records: ${aicteDocs.length}`);

    // Build name index
    const aicteByNormName = new Map();
    aicteDocs.forEach(c => {
        const n = normStr(c.institution_name);
        if (!aicteByNormName.has(n)) aicteByNormName.set(n, []);
        aicteByNormName.get(n).push({
            cId:  c.institution_id,
            name: c.institution_name,
            city: normStr(c.district)
        });
    });

    // 2. Collect all unique EN-coded institutions from every Maharashtra truth file
    const fraFiles = ['maharashtra_fra_2024.ndjson', 'maharashtra_fra_2024_bulk.ndjson'];
    const enCodeMap = new Map(); // enCode → { name, city (from truth) }
    
    fraFiles.forEach(f => {
        const p = path.join(TRUTH_DIR, f);
        if (!fs.existsSync(p)) return;
        fs.readFileSync(p, 'utf8').split('\n').filter(Boolean).forEach(line => {
            try {
                const d = JSON.parse(line);
                const id = d.collegeId || d.id;
                if (!id || !id.startsWith('EN')) return;
                if (!enCodeMap.has(id)) {
                    enCodeMap.set(id, { name: d.name, city: normStr(d.city || d.district || '') });
                }
            } catch {}
        });
    });

    console.log(`[EN-Crosswalk] Unique EN-codes collected: ${enCodeMap.size}`);

    // 3. Try deterministic resolution for each EN code
    const resolved   = [];
    const reviewQueue = [];
    const stats = { exactName: 0, ambigGeo: 0, unresolved: 0, tooAbbreviated: 0 };

    enCodeMap.forEach((info, enCode) => {
        const normName = normStr(info.name);
        const cands    = aicteByNormName.get(normName);

        if (!cands) {
            // No exact name match — likely an abbreviation — cannot resolve
            stats.tooAbbreviated++;
            reviewQueue.push({ enCode, name: info.name, reason: 'no_exact_name_in_aicte_mh', requiresManualCuration: true });
            return;
        }

        if (cands.length === 1) {
            // Unique exact name match within Maharashtra
            stats.exactName++;
            resolved.push({
                canonicalCatalogId:   cands[0].cId,
                enCode,
                stableKey:            enCode,
                normalizedName:       normName,
                state:                'Maharashtra',
                city:                 info.city,
                mappingMethod:        'exact_name_maharashtra_unique',
                mappingConfidence:    'deterministic',
                reviewed:             false,
                evidence:             ['Maharashtra FRA NDJSON']
            });
            return;
        }

        // Multiple AICTE matches — try city corroboration
        if (info.city) {
            const cityMatch = cands.filter(c => c.city === info.city);
            if (cityMatch.length === 1) {
                stats.ambigGeo++;
                resolved.push({
                    canonicalCatalogId:   cityMatch[0].cId,
                    enCode,
                    stableKey:            enCode,
                    normalizedName:       normName,
                    state:                'Maharashtra',
                    city:                 info.city,
                    mappingMethod:        'exact_name_maharashtra_city_corroborated',
                    mappingConfidence:    'deterministic',
                    reviewed:             false,
                    evidence:             ['Maharashtra FRA NDJSON + city']
                });
                return;
            }
        }

        // Still ambiguous
        stats.unresolved++;
        reviewQueue.push({
            enCode, name: info.name, city: info.city,
            reason:    'ambiguous_multiple_aicte_candidates',
            candidates: cands.map(c => ({ cId: c.cId, name: c.name, city: c.city }))
        });
    });

    // 4. Inject resolved EN-codes into the main institution crosswalk
    const mainCwPath = path.join(MAPPINGS_DIR, 'institution_crosswalk.ndjson');
    const enCwPath   = path.join(MAPPINGS_DIR, 'en_code_crosswalk.ndjson');
    const enRvPath   = path.join(MAPPINGS_DIR, 'en_code_review_queue.json');

    fs.writeFileSync(enCwPath, resolved.map(r => JSON.stringify(r)).join('\n'));
    fs.writeFileSync(enRvPath, JSON.stringify(reviewQueue, null, 2));

    // Append EN resolutions into the main crosswalk so the resolver picks them up
    if (fs.existsSync(mainCwPath)) {
        const appendLines = resolved.map(r => JSON.stringify(r)).join('\n');
        fs.appendFileSync(mainCwPath, '\n' + appendLines);
    }

    console.log('[EN-Crosswalk] Complete.');
    console.log(`  Exact name (unique MH): ${stats.exactName}`);
    console.log(`  City corroborated:      ${stats.ambigGeo}`);
    console.log(`  Abbreviated (review):   ${stats.tooAbbreviated}`);
    console.log(`  Ambiguous (review):     ${stats.unresolved}`);
    console.log(`  Total resolved:         ${resolved.length}`);
    console.log(`  Review queue size:      ${reviewQueue.length}`);
}

main().catch(console.error);
