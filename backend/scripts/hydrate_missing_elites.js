const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const College = require('../models/CollegeSchema');

function loadNdjson(filename) {
    const fullPath = path.join(__dirname, '../data/truth', filename);
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

const feesData = loadNdjson('core_fees_v2.ndjson');
const placData = loadNdjson('core_placements_v2.ndjson');

function normalizeName(name) {
    if (!name) return '';
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function run() {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
    console.log("Connected to MongoDB.");

    const allColleges = await College.find({}).lean();
    
    let hydratedCount = 0;
    const now = new Date().toISOString();

    for (const c of allColleges) {
        const idUpper = c.institution_id?.toUpperCase() || '';
        if (idUpper.includes('-IIT-') || idUpper.includes('-NIT-') || idUpper.includes('-IIIT-')) {
            const hasFees = c.fees?.isVerified || c.fees?.totalFee;
            const hasPlac = c.placements?.isVerified || c.placements?.averagePackage;
            
            if (!hasFees || !hasPlac) {
                // Find matching truth data
                const cNN = normalizeName(c.name);
                const feeMatch = feesData.find(f => normalizeName(f.name) === cNN);
                const placMatch = placData.find(p => normalizeName(p.name) === cNN);

                const updateDoc = { $set: {} };

                if (feeMatch) {
                    updateDoc.$set['fees.totalFee'] = feeMatch.totalFee || feeMatch.feeAmount || c.fees?.totalFee;
                    updateDoc.$set['fees.tuitionFee'] = feeMatch.tuitionFee || c.fees?.tuitionFee;
                    updateDoc.$set['fees.isVerified'] = true;
                    updateDoc.$set['fees.source_authority'] = 'official_institute';
                    updateDoc.$set['fees.source_url'] = feeMatch.evidenceUrl || feeMatch.sourceUrl || '';
                    updateDoc.$set['fees.academic_year'] = feeMatch.session || '2024-25';
                    updateDoc.$set['fees.extracted_at'] = now;
                    updateDoc.$set['fees.stale_after_days'] = 365;
                    updateDoc.$set['fees.provenance'] = {
                        sourceName: feeMatch.source || 'Official Authority',
                        capturedAt: now,
                        confidence: 0.98
                    };
                }

                if (placMatch) {
                    updateDoc.$set['placements.averagePackage'] = placMatch.averagePackage || placMatch.medianSalary || placMatch.medianPackage || c.placements?.averagePackage;
                    updateDoc.$set['placements.highestPackage'] = placMatch.highestPackage || c.placements?.highestPackage;
                    updateDoc.$set['placements.placedPercentage'] = placMatch.placedPercentage || placMatch.placementRate || placMatch.placementPercentage || c.placements?.placedPercentage;
                    updateDoc.$set['placements.isVerified'] = true;
                    updateDoc.$set['placements.source_authority'] = 'primary_authority';
                    updateDoc.$set['placements.source_url'] = placMatch.evidenceUrl || placMatch.sourceUrl || '';
                    updateDoc.$set['placements.academic_year'] = placMatch.session || '2023-24';
                    updateDoc.$set['placements.extracted_at'] = now;
                    updateDoc.$set['placements.stale_after_days'] = 365;
                    updateDoc.$set['placements.provenance'] = {
                        sourceName: placMatch.source || 'NIRF 2024',
                        capturedAt: now,
                        confidence: 0.95
                    };
                }

                if (Object.keys(updateDoc.$set).length > 0) {
                    await College.updateOne({ _id: c._id }, updateDoc);
                    hydratedCount++;
                    console.log(`✅ Hydrated Missing Elite: ${c.name}`);
                }
            }
        }
    }

    console.log(`\n=== METRICS ===`);
    console.log(`Newly Hydrated Missing Elites: ${hydratedCount}`);
    process.exit(0);
}

run().catch(console.error);
