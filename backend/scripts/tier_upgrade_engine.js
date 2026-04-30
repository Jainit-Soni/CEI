/**
 * tier_upgrade_engine.js — CEI Phase 24 Gap Detection & Upgrade Priority Engine
 *
 * This script identifies institutions that are close to a tier upgrade
 * and matches them against offline truth data.
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const TRUTH_DIR = path.join(__dirname, '../data/truth');
const OUT_DIR   = path.join(__dirname, '../data/truth');

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
    return n.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

async function run() {
    console.log('🚀 Starting Tier Upgrade Engine...');
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
    const db = mongoose.connection.db;

    const cutoffs = new Set(await db.collection('engineering_cutoffs').distinct('institution_id'));
    const seats = new Set(await db.collection('seat_matrix').distinct('institution_id'));

    // Load all truth sources
    const feeSources = [
        ...loadNdjson('core_fees_v2.ndjson'),
        ...loadNdjson('pan_india_bulk_2024.ndjson'),
        ...loadNdjson('maharashtra_fra_2024_bulk.ndjson'),
        ...loadNdjson('karnataka_kea_2024_bulk.ndjson'),
        ...loadNdjson('tamil_nadu_tnea_2024_bulk.ndjson'),
    ];

    const placementSources = [
        ...loadNdjson('placements_truth.ndjson'),
        ...loadNdjson('nirf_2024_placements.ndjson'),
        ...loadNdjson('core_placements_v2.ndjson'),
    ];

    // Indexing
    const feeMap = new Map();
    feeSources.forEach(s => {
        if (s.stableKey) feeMap.set(s.stableKey, s);
        const nn = normalizeName(s.name);
        if (nn) feeMap.set(nn, s);
    });

    const placMap = new Map();
    placementSources.forEach(s => {
        if (s.stableKey) placMap.set(s.stableKey, s);
        const nn = normalizeName(s.name);
        if (nn) placMap.set(nn, s);
    });

    const institutions = await db.collection('institutions').find({}).toArray();
    
    const priority1 = []; // Tier B -> A (Placements missing)
    const priority2 = []; // Tier C -> B (Fees missing)
    const upgrades = [];

    for (const c of institutions) {
        const id = c.institution_id;
        const sk = c.stableKey;
        const nn = normalizeName(c.name);

        const hasFees = !!(c.fees?.isVerified || c.fees?.totalFee);
        const hasPlac = !!(c.placements?.isVerified || c.placements?.averagePackage);
        const hasCuts = cutoffs.has(id) || !!(c.coverage?.cutoffCoverage && c.coverage.cutoffCoverage !== 'None');
        const hasSeats = seats.has(id) || !!(c.coverage?.seatCoverage && c.coverage.seatCoverage !== 'None');

        const score = [hasFees, hasPlac, hasCuts, hasSeats].filter(Boolean).length;
        
        // Priority 1: 3/4 missing placements
        if (score === 3 && !hasPlac) {
            const match = placMap.get(sk) || placMap.get(nn);
            priority1.push({
                name: c.name,
                id: id,
                actionable: !!match,
                source: match ? match.source : null
            });
        }

        // Priority 2: 2/4 (usually missing fees)
        if (score === 2 && !hasFees && hasCuts && hasSeats) {
            const match = feeMap.get(sk) || feeMap.get(nn);
            priority2.push({
                name: c.name,
                id: id,
                actionable: !!match,
                source: match ? match.source : null
            });
        }
        
        // Any upgrade potential
        if (score < 4) {
            const canGetFees = !hasFees && (feeMap.has(sk) || feeMap.has(nn));
            const canGetPlac = !hasPlac && (placMap.has(sk) || placMap.has(nn));
            if (canGetFees || canGetPlac) {
                upgrades.push({
                    name: c.name,
                    id: id,
                    currentScore: score,
                    canGetFees,
                    canGetPlac
                });
            }
        }
    }

    const report = {
        summary: {
            total_institutions: institutions.length,
            priority1_count: priority1.length,
            priority1_actionable: priority1.filter(x=>x.actionable).length,
            priority2_count: priority2.length,
            priority2_actionable: priority2.filter(x=>x.actionable).length,
            total_actionable_upgrades: upgrades.length
        },
        priority1,
        priority2,
        all_upgrades: upgrades.slice(0, 100) // limit for visibility
    };

    fs.writeFileSync(path.join(OUT_DIR, 'tier_upgrade_plan.json'), JSON.stringify(report, null, 2));

    console.log('\n--- UPGRADE ENGINE REPORT ---');
    console.log(`Priority 1 (B->A): ${report.summary.priority1_count} (Actionable: ${report.summary.priority1_actionable})`);
    console.log(`Priority 2 (C->B): ${report.summary.priority2_count} (Actionable: ${report.summary.priority2_actionable})`);
    console.log(`Total actionable upgrades found: ${report.summary.total_actionable_upgrades}`);
    console.log('Full plan written to backend/data/truth/tier_upgrade_plan.json');

    process.exit(0);
}

run().catch(console.error);
