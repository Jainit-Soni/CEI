const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const College = require('../models/CollegeSchema');
const TRUTH_DIR = path.join(__dirname, '../data/truth');

function loadNdjson(filename) {
    const fullPath = path.join(TRUTH_DIR, filename);
    if (!fs.existsSync(fullPath)) return [];
    const lines = fs.readFileSync(fullPath, 'utf-8').split('\n');
    const records = [];
    for (const line of lines) {
        if (!line.trim()) continue;
        try {
            records.push(JSON.parse(line));
        } catch (e) {}
    }
    return records;
}

const eliteRegistryPath = path.join(TRUTH_DIR, 'elite_identity_registry.json');
const eliteRegistry = fs.existsSync(eliteRegistryPath) ? JSON.parse(fs.readFileSync(eliteRegistryPath, 'utf8')) : [];

// 1. Load Truth Data
const feesData = [
    ...loadNdjson('core_fees_v2.ndjson'),
    ...loadNdjson('fees_truth.ndjson')
];

const placementsData = [
    ...loadNdjson('core_placements_v2.ndjson'),
    ...loadNdjson('nirf_expanded_2024_v1.ndjson'),
    ...loadNdjson('nirf_2024_placements.ndjson'),
    ...loadNdjson('placements_truth.ndjson')
];

const feesMap = new Map();
const placMap = new Map();

for (const r of feesData) {
    if (r.stableKey) feesMap.set(r.stableKey, r);
    if (r.institution_id) feesMap.set(r.institution_id, r);
    
    // Check if stableKey is an AISHE ID mapped to a CORE ID
    const mapping = eliteRegistry.find(e => e.aisheCode === r.stableKey || e.catalogId === r.stableKey);
    if (mapping) {
        feesMap.set(mapping.canonicalId, r);
    }
}

for (const r of placementsData) {
    if (r.stableKey) placMap.set(r.stableKey, r);
    if (r.institution_id) placMap.set(r.institution_id, r);
    
    // Check mapping
    const mapping = eliteRegistry.find(e => e.aisheCode === r.stableKey || e.catalogId === r.stableKey);
    if (mapping) {
        placMap.set(mapping.canonicalId, r);
    }
}

function normalizeAuthority(sourceStr) {
    if (!sourceStr) return 'secondary';
    const s = sourceStr.toLowerCase();
    if (s.includes('nirf')) return 'primary_authority';
    if (s.includes('afrc') || s.includes('apsche') || s.includes('tsche') || s.includes('order') || s.includes('circular') || s.includes('fee regulatory')) return 'primary_authority';
    if (s.includes('official') || s.includes('institute') || s.includes('website')) return 'official_institute';
    return 'secondary';
}

async function run() {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
    console.log("Connected to MongoDB.");

    const db = mongoose.connection.db;
    
    const cutoffsCount = await db.collection('engineering_cutoffs').aggregate([
        { $group: { _id: "$institution_id", count: { $sum: 1 } } }
    ]).toArray();
    
    const seatsCount = await db.collection('seat_matrix').aggregate([
        { $group: { _id: "$institution_id", count: { $sum: 1 } } }
    ]).toArray();

    const cutoffMap = new Map(cutoffsCount.map(c => [c._id, c.count]));
    const seatMap = new Map(seatsCount.map(s => [s._id, s.count]));

    const allColleges = await College.find({}).lean();
    console.log(`Loaded ${allColleges.length} colleges.`);

    const candidates = [];
    let initialFullCoverage = 0;

    for (const c of allColleges) {
        const hasFees = c.fees?.isVerified || c.fees?.totalFee;
        const hasPlac = c.placements?.isVerified || c.placements?.averagePackage;
        
        if (hasFees && hasPlac) {
            initialFullCoverage++;
            continue; 
        }

        let availableFee = feesMap.get(c.stableKey) || feesMap.get(c.institution_id) || feesMap.get(c.id);
        let availablePlac = placMap.get(c.stableKey) || placMap.get(c.institution_id) || placMap.get(c.id);

        if (availableFee && normalizeAuthority(availableFee.source) === 'secondary') availableFee = null;
        if (availablePlac && normalizeAuthority(availablePlac.source) === 'secondary') availablePlac = null;

        if (!availableFee && !availablePlac) continue;

        let score = (c.institutionStrengthScore || c.ceiScore || 0);
        
        const nameUpper = c.name?.toUpperCase() || '';
        const idUpper = c.institution_id?.toUpperCase() || '';
        
        if (nameUpper.includes('INDIAN INSTITUTE OF TECHNOLOGY') || idUpper.includes('-IIT-')) score += 500;
        else if (nameUpper.includes('NATIONAL INSTITUTE OF TECHNOLOGY') || idUpper.includes('-NIT-')) score += 400;
        else if (nameUpper.includes('INDIAN INSTITUTE OF INFORMATION TECHNOLOGY') || idUpper.includes('-IIIT-')) score += 300;
        else if (c.collegeType === 'Government') score += 100;
        
        if (cutoffMap.get(c.institution_id) > 0) score += 100;
        if (seatMap.get(c.institution_id) > 0) score += 100;

        candidates.push({ college: c, availableFee, availablePlac, score });
    }

    candidates.sort((a, b) => b.score - a.score);

    const top150 = candidates.slice(0, 150);
    console.log(`\nFound ${candidates.length} candidates with truth data. Selecting Top ${top150.length}.`);

    let hydratedCount = 0;
    const now = new Date().toISOString();

    for (const item of top150) {
        const updateDoc = { $set: {} };
        const c = item.college;
        
        if (item.availableFee) {
            updateDoc.$set['fees.totalFee'] = item.availableFee.totalFee || item.availableFee.feeAmount || c.fees?.totalFee;
            updateDoc.$set['fees.tuitionFee'] = item.availableFee.tuitionFee || c.fees?.tuitionFee;
            updateDoc.$set['fees.isVerified'] = true;
            updateDoc.$set['fees.source_authority'] = normalizeAuthority(item.availableFee.source);
            updateDoc.$set['fees.source_url'] = item.availableFee.evidenceUrl || item.availableFee.sourceUrl || '';
            updateDoc.$set['fees.academic_year'] = item.availableFee.session || '2024-25';
            updateDoc.$set['fees.extracted_at'] = now;
            updateDoc.$set['fees.stale_after_days'] = 365;
            updateDoc.$set['fees.provenance'] = {
                sourceName: item.availableFee.source || 'Official Authority',
                capturedAt: now,
                confidence: 0.98
            };
        }

        if (item.availablePlac) {
            updateDoc.$set['placements.averagePackage'] = item.availablePlac.averagePackage || item.availablePlac.medianSalary || item.availablePlac.medianPackage || c.placements?.averagePackage;
            updateDoc.$set['placements.highestPackage'] = item.availablePlac.highestPackage || c.placements?.highestPackage;
            updateDoc.$set['placements.placedPercentage'] = item.availablePlac.placedPercentage || item.availablePlac.placementRate || item.availablePlac.placementPercentage || c.placements?.placedPercentage;
            updateDoc.$set['placements.isVerified'] = true;
            updateDoc.$set['placements.source_authority'] = normalizeAuthority(item.availablePlac.source);
            updateDoc.$set['placements.source_url'] = item.availablePlac.evidenceUrl || item.availablePlac.sourceUrl || '';
            updateDoc.$set['placements.academic_year'] = item.availablePlac.session || '2023-24';
            updateDoc.$set['placements.extracted_at'] = now;
            updateDoc.$set['placements.stale_after_days'] = 365;
            updateDoc.$set['placements.provenance'] = {
                sourceName: item.availablePlac.source || 'NIRF 2024',
                capturedAt: now,
                confidence: 0.95
            };
        }

        if (Object.keys(updateDoc.$set).length > 0) {
            await College.updateOne({ _id: c._id }, updateDoc);
            hydratedCount++;
            console.log(`✅ Hydrated: ${c.name} (Score: ${item.score})`);
        }
    }

    const finalFullCoverage = initialFullCoverage + hydratedCount; 
    console.log(`\n=== HYDRATION METRICS ===`);
    console.log(`Previous Full Coverage: ${initialFullCoverage}`);
    console.log(`Newly Hydrated: ${hydratedCount}`);
    console.log(`Estimated New Full Coverage: ${finalFullCoverage}`);
    console.log(`Percentage: ${((finalFullCoverage / allColleges.length) * 100).toFixed(2)}%`);

    process.exit(0);
}

run().catch(console.error);
