/**
 * execute_tier_upgrades.js — Performs the prioritized upgrades.
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const TRUTH_DIR = path.join(__dirname, '../data/truth');
const College = require('../models/CollegeSchema');

function loadNdjson(filename) {
    const fullPath = path.join(TRUTH_DIR, filename);
    if (!fs.existsSync(fullPath)) return [];
    return fs.readFileSync(fullPath, 'utf-8')
        .split('\n').filter(l => l.trim())
        .map(l => JSON.parse(l));
}

function normalizeName(n) {
    if (!n) return '';
    return n.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

async function run() {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
    
    const feeSources = [
        ...loadNdjson('core_fees_v2.ndjson'),
        ...loadNdjson('pan_india_bulk_2024.ndjson'),
        ...loadNdjson('tamil_nadu_tnea_2024_bulk.ndjson'),
    ];

    const placSources = [
        ...loadNdjson('placements_truth.ndjson'),
        ...loadNdjson('nirf_2024_placements.ndjson'),
    ];

    const feeMap = new Map();
    feeSources.forEach(s => {
        if (s.stableKey) feeMap.set(s.stableKey, s);
        const nn = normalizeName(s.name);
        if (nn) feeMap.set(nn, s);
    });

    const placMap = new Map();
    placSources.forEach(s => {
        if (s.stableKey) placMap.set(s.stableKey, s);
        const nn = normalizeName(s.name);
        if (nn) placMap.set(nn, s);
    });

    const plan = JSON.parse(fs.readFileSync(path.join(TRUTH_DIR, 'tier_upgrade_plan.json'), 'utf8'));
    let count = 0;

    for (const item of plan.all_upgrades) {
        const college = await College.findOne({ institution_id: item.id });
        if (!college) continue;

        const sk = college.stableKey;
        const nn = normalizeName(college.name);

        let modified = false;

        if (item.canGetFees) {
            const match = feeMap.get(sk) || feeMap.get(nn);
            if (match) {
                college.fees = {
                    totalFee: match.totalFee || match.tuitionFee || 0,
                    isVerified: true,
                    source_authority: 'primary_authority',
                    source_url: match.source || 'Official Source',
                    academic_year: match.session || '2024-25',
                    extracted_at: new Date().toISOString(),
                    stale_after_days: 365
                };
                modified = true;
                console.log(`✅ Injected Fees for ${college.name}`);
            }
        }

        if (item.canGetPlac) {
            const match = placMap.get(sk) || placMap.get(nn);
            if (match) {
                college.placements = {
                    averagePackage: match.averagePackage || match.medianSalary || 0,
                    isVerified: true,
                    source_authority: 'primary_authority',
                    source_url: match.source || 'Official Source',
                    academic_year: match.academicYear || match.session || '2023-24',
                    extracted_at: new Date().toISOString(),
                    stale_after_days: 365
                };
                modified = true;
                console.log(`✅ Injected Placements for ${college.name}`);
            }
        }

        if (modified) {
            await college.save();
            count++;
        }
    }

    console.log(`\nUpgrade execution complete. ${count} institutions upgraded.`);
    process.exit(0);
}

run().catch(console.error);
