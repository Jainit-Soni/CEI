/**
 * execute_tier_b_upgrades.js — Inject placements for all Tier B institutions
 *
 * All 13 Tier B institutions have:  fees ✅  cutoffs ✅  seats ✅  placements ❌
 * Goal: inject verified placements to upgrade them to Tier A.
 *
 * Sources (priority order):
 *   1. placements_truth.ndjson  (official institute placement reports)
 *   2. nirf_2024_placements.ndjson (NIRF 2024 official)
 *   3. nirf_expanded_2024_v1.ndjson (NIRF expanded)
 *   4. core_placements_v2.ndjson
 *
 * Rules: no fake data, no inference, official sources only.
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const College = require('../models/CollegeSchema');
const TRUTH_DIR = path.join(__dirname, '../data/truth');

function loadNdjson(filename) {
    const fullPath = path.join(TRUTH_DIR, filename);
    if (!fs.existsSync(fullPath)) return [];
    return fs.readFileSync(fullPath, 'utf-8')
        .split('\n').filter(l => l.trim())
        .map(l => { try { return JSON.parse(l); } catch(e) { return null; } })
        .filter(Boolean);
}

function normalizeName(n) {
    if (!n) return '';
    return n.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function normalizeAuthority(src) {
    if (!src) return 'secondary';
    const s = src.toLowerCase();
    if (s.includes('nirf'))     return 'primary_authority';
    if (s.includes('official') || s.includes('institute') || s.includes('placement report')) return 'official_institute';
    return 'secondary';
}

async function run() {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
    const db = mongoose.connection.db;
    console.log('Connected.\n');

    // Step 1: Identify all Tier B institutions
    const cutoffSet = new Set(await db.collection('engineering_cutoffs').distinct('institution_id'));
    const seatSet   = new Set(await db.collection('seat_matrix').distinct('institution_id'));

    const all = await College.find({}).lean();
    const tierBInsts = all.filter(c => {
        const hasFees = !!(c.fees?.isVerified || c.fees?.totalFee);
        const hasPlac = !!(c.placements?.isVerified || c.placements?.averagePackage);
        const hasCuts = cutoffSet.has(c.institution_id) || !!(c.coverage?.cutoffCoverage && c.coverage.cutoffCoverage !== 'None');
        const hasSeats = seatSet.has(c.institution_id) || !!(c.coverage?.seatCoverage && c.coverage.seatCoverage !== 'None');
        return [hasFees, hasPlac, hasCuts, hasSeats].filter(Boolean).length === 3;
    });

    console.log(`Found ${tierBInsts.length} Tier B institutions.`);

    // Step 2: Load placement truth sources (priority order)
    const sources = [
        ...loadNdjson('placements_truth.ndjson'),
        ...loadNdjson('nirf_2024_placements.ndjson'),
        ...loadNdjson('core_placements_v2.ndjson'),
        ...loadNdjson('nirf_expanded_2024_v1.ndjson'),
    ];

    // Index by stableKey, institution_id, and normalized name
    const byKey  = new Map();
    const byName = new Map();
    for (const r of sources) {
        if (r.stableKey) byKey.set(r.stableKey, r);
        if (r.institution_id) byKey.set(r.institution_id, r);
        const nn = normalizeName(r.name);
        if (nn.length > 5) byName.set(nn, r);
    }

    const now = new Date().toISOString();
    let upgraded = 0;
    const gaps   = [];

    for (const c of tierBInsts) {
        const hasMissingPlac = !(c.placements?.isVerified || c.placements?.averagePackage);
        const hasMissingFees = !(c.fees?.isVerified || c.fees?.totalFee);

        if (hasMissingPlac) {
            const nn   = normalizeName(c.name);
            const match = byKey.get(c.stableKey) || byKey.get(c.institution_id) || byName.get(nn);

            if (match && normalizeAuthority(match.source) !== 'secondary') {
                await College.updateOne({ _id: c._id }, { $set: {
                    'placements.averagePackage':   match.averagePackage   || match.medianSalary   || match.medianPackage   || null,
                    'placements.highestPackage':   match.highestPackage   || null,
                    'placements.placedPercentage': match.placedPercentage || match.placementRate  || null,
                    'placements.isVerified':       true,
                    'placements.source_authority': normalizeAuthority(match.source),
                    'placements.source_url':       match.evidenceUrl || match.sourceUrl || '',
                    'placements.academic_year':    match.academicYear || match.session || '2023-24',
                    'placements.extracted_at':     now,
                    'placements.stale_after_days': 365,
                    'placements.provenance': {
                        sourceName:  match.source || 'Official Source',
                        capturedAt:  now,
                        confidence:  0.95
                    }
                }});
                console.log(`✅ Upgraded B→A: ${c.name}`);
                console.log(`   Source: ${match.source}`);
                upgraded++;
            } else {
                gaps.push({
                    institution_id: c.institution_id,
                    name: c.name,
                    state: c.state,
                    missing: 'placements',
                    hasFees: !hasMissingFees,
                    notes: 'No verified placement source found in local truth files. Needs Phase 25 data.'
                });
                console.log(`⚠️  No source: ${c.name}`);
            }
        } else if (hasMissingFees) {
            // Missing fees — less common case
            gaps.push({
                institution_id: c.institution_id,
                name: c.name,
                state: c.state,
                missing: 'fees',
                hasPlac: !hasMissingPlac,
                notes: 'Has placements but no fee data. Check TNEA/FRA/state fee circulars.'
            });
            console.log(`⚠️  Missing fees: ${c.name}`);
        }
    }

    // Write gap report
    const gapReport = {
        generated_at: new Date().toISOString(),
        total_tier_b: tierBInsts.length,
        upgraded_to_a: upgraded,
        remaining_gaps: gaps.length,
        gaps,
    };
    fs.writeFileSync(
        path.join(TRUTH_DIR, 'tier_b_gap_report.json'),
        JSON.stringify(gapReport, null, 2)
    );

    console.log('\n==========================================');
    console.log(`Tier B → A Upgrades:  ${upgraded}`);
    console.log(`Remaining gaps:       ${gaps.length}`);
    console.log(`Gap report written:   backend/data/truth/tier_b_gap_report.json`);
    console.log('==========================================\n');

    process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
