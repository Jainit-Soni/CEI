const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const connectDB = require('../config/db');

/**
 * validate_medical_predictor_v3.js
 * ================================
 * Stress-tests the v3 percentile predictor across all medical entities.
 * Generates an audit report on statistical reliability and stability.
 */

function percentile(arr, p) {
    if (arr.length === 0) return 0;
    const idx = Math.max(0, Math.min(arr.length - 1, Math.floor((p / 100) * arr.length)));
    return arr[idx];
}

async function validate() {
    console.log("🚀 Starting Medical Predictor V3 Validator...");
    await connectDB();
    const collection = mongoose.connection.db.collection('medicalcutoffs');

    // 1. Group-based Analysis Pipeline
    const groups = await collection.aggregate([
        {
            $group: {
                _id: {
                    eid: "$medical_entity_id",
                    pt: "$program_type",
                    q: "$quota",
                    c: "$category"
                },
                ranks: { $push: "$closing_rank" },
                confidences: { $push: "$hydration_confidence" },
                lineages: { $push: "$lineage" }
            }
        }
    ]).toArray();

    const report = {
        summary: {
            total_groups: groups.length,
            valid_groups: 0,
            invalid_groups: 0,
            low_sample_groups: 0,
            volatile_groups: 0,
            valid_rate: "0.00%",
            production_ready: false
        },
        invalid_groups: [],
        low_sample_groups: [],
        volatile_groups: [],
        examples: []
    };

    groups.forEach(g => {
        const sorted = g.ranks.sort((a, b) => a - b);
        const count = sorted.length;
        
        const p25 = percentile(sorted, 25);
        const p50 = percentile(sorted, 50);
        const p75 = percentile(sorted, 75);
        const p90 = percentile(sorted, 90);
        const spread = p75 - p25;

        // Confidence distribution
        const confMap = g.confidences.reduce((acc, c) => { acc[c] = (acc[c] || 0) + 1; return acc; }, {});
        const lineageMap = g.lineages.reduce((acc, l) => { acc[l] = (acc[l] || 0) + 1; return acc; }, {});
        
        const confidence_penalty_required = (confMap['HIGH'] || 0) + (confMap['DIRECT'] || 0) < count / 2;

        const info = {
            id: g._id,
            count,
            min: sorted[0],
            max: sorted[count-1],
            p25, p50, p75, p90,
            spread,
            confidence_penalty_required
        };

        // Validity Checks
        let is_valid = true;
        let reasons = [];

        if (count < 5) {
            report.low_sample_groups.push(info);
            report.summary.low_sample_groups++;
            is_valid = false;
        }

        if (!(p25 <= p50 && p50 <= p75 && p75 <= p90)) {
            reasons.push("Non-monotonic percentiles");
            is_valid = false;
        }

        if (sorted.some(r => r === null || r === undefined)) {
            reasons.push("Null closing ranks detected");
            is_valid = false;
        }

        if (!is_valid && count >= 5) {
            info.reasons = reasons;
            report.invalid_groups.push(info);
            report.summary.invalid_groups++;
        } else if (is_valid) {
            report.summary.valid_groups++;
        }

        // Stability Check
        if (spread > 10000) {
            info.stability = "LOW";
            report.volatile_groups.push(info);
            report.summary.volatile_groups++;
        } else if (spread > 2500) {
            info.stability = "MEDIUM";
        } else {
            info.stability = "HIGH";
        }

        // Collect examples
        if (report.examples.length < 5 && is_valid) {
            report.examples.push(info);
        }
    });

    // Calculate Summary
    report.summary.valid_rate = ((report.summary.valid_groups / report.summary.total_groups) * 100).toFixed(2) + "%";
    report.summary.production_ready = parseFloat(report.summary.valid_rate) >= 90 && report.summary.invalid_groups === 0;

    // Save Report
    const reportDir = path.join(__dirname, '../reports');
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir);
    fs.writeFileSync(path.join(reportDir, 'medical_predictor_v3_validation.json'), JSON.stringify(report, null, 2));

    console.log(`\n✅ Validation Complete.`);
    console.log(`📊 Valid Rate: ${report.summary.valid_rate}`);
    console.log(`📊 Total Groups: ${report.summary.total_groups}`);
    console.log(`📊 Invalid Groups: ${report.summary.invalid_groups}`);
    console.log(`📊 Low Sample Groups: ${report.summary.low_sample_groups}`);
    console.log(`📂 Report saved to backend/reports/medical_predictor_v3_validation.json`);

    process.exit(0);
}

validate();
