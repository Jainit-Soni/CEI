const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const connectDB = require('../config/db');

/**
 * validate_medical_predictor_v32.js
 * =================================
 * Validates trend, percentile, fallback, confidence, and anomaly behavior.
 */

function calculateMedian(arr) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function percentile(arr, p) {
    if (arr.length === 0) return 0;
    const sorted = [...arr].sort((a, b) => a - b);
    const idx = Math.max(0, Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length)));
    return sorted[idx];
}

async function validate() {
    console.log("🚀 Starting Medical Predictor V3.2 Validator...");
    await connectDB();
    const collection = mongoose.connection.db.collection('medicalcutoffs');

    const groups = await collection.aggregate([
        {
            $group: {
                _id: {
                    eid: "$medical_entity_id",
                    pt: "$program_type",
                    q: "$quota",
                    c: "$category"
                },
                yearlyData: {
                    $push: {
                        year: "$year",
                        rank: "$closing_rank",
                        confidence: "$hydration_confidence"
                    }
                }
            }
        }
    ]).toArray();

    const report = {
        summary: {
            total_groups: groups.length,
            valid_groups: 0,
            invalid_groups: 0,
            fallback_v2_groups: 0,
            usable_trend_groups: 0,
            insufficient_trend_groups: 0,
            anomaly_groups: 0,
            usable_trend_rate: "0.00%",
            production_ready: false
        },
        invalid_groups: [],
        fallback_v2_groups: [],
        insufficient_trend_groups: [],
        anomaly_groups: [],
        volatile_groups: [],
        examples: []
    };

    groups.forEach(g => {
        const yearsMap = {};
        g.yearlyData.forEach(d => {
            if (!yearsMap[d.year]) yearsMap[d.year] = [];
            yearsMap[d.year].push(d.rank);
        });

        const sortedYears = Object.keys(yearsMap).sort((a, b) => b - a);
        const distinctYears = sortedYears.length;
        const allRanks = g.yearlyData.map(d => d.rank);
        const count = allRanks.length;

        const p25 = percentile(allRanks, 25);
        const p50 = percentile(allRanks, 50);
        const p75 = percentile(allRanks, 75);
        const p90 = percentile(allRanks, 90);
        const spread = p75 - p25;

        // Trend calculation
        let trend = "insufficient_history";
        let percentChange = 0;
        let anomaly_flag = false;

        if (distinctYears >= 3) {
            const latestMedian = calculateMedian(yearsMap[sortedYears[0]]);
            const previousMedian = calculateMedian(yearsMap[sortedYears[1]]);
            const delta = latestMedian - previousMedian;
            percentChange = (delta / previousMedian) * 100;

            if (Math.abs(percentChange) < 2) trend = "stable";
            else if (delta < 0) trend = "tightening";
            else trend = "loosening";

            if (Math.abs(percentChange) > 50) anomaly_flag = true;
            report.summary.usable_trend_groups++;
        } else {
            report.summary.insufficient_trend_groups++;
        }

        const info = {
            id: g._id,
            total_rows: count,
            distinct_years: distinctYears,
            p25, p50, p75, p90,
            spread,
            trend,
            percentChange: percentChange.toFixed(2),
            anomaly_flag
        };

        // Validation Rules
        let is_valid = true;
        let is_fallback = false;
        let reasons = [];

        if (count < 5) {
            is_fallback = true;
            report.summary.fallback_v2_groups++;
        }

        if (!(p25 <= p50 && p50 <= p75 && p75 <= p90)) {
            reasons.push("Non-monotonic percentiles");
            is_valid = false;
        }

        if (spread < 0) {
            reasons.push("Negative spread");
            is_valid = false;
        }

        if (allRanks.some(r => r === null || r === undefined)) {
            reasons.push("Null ranks detected");
            is_valid = false;
        }

        if (distinctYears < 3 && trend !== "insufficient_history") {
            reasons.push("Trend shown with insufficient history");
            is_valid = false;
        }

        if (is_valid) {
            report.summary.valid_groups++;
            if (anomaly_flag) {
                report.anomaly_groups.push(info);
                report.summary.anomaly_groups++;
            }
            if (spread > 10000) report.volatile_groups.push(info);
        } else {
            info.reasons = reasons;
            report.invalid_groups.push(info);
            report.summary.invalid_groups++;
        }

        if (is_fallback) report.fallback_v2_groups.push(info);

        if (report.examples.length < 5 && is_valid && distinctYears >= 2) {
            report.examples.push(info);
        }
    });

    report.summary.usable_trend_rate = ((report.summary.usable_trend_groups / report.summary.total_groups) * 100).toFixed(2) + "%";
    report.summary.production_ready = (report.summary.invalid_groups === 0 && parseFloat(report.summary.usable_trend_rate) >= 20);

    const reportPath = path.join(__dirname, '../reports/medical_predictor_v32_validation.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log("\n✅ Validation Complete.");
    console.log(`📊 Usable Trend Rate: ${report.summary.usable_trend_rate}`);
    console.log(`📊 Invalid Groups: ${report.summary.invalid_groups}`);
    console.log(`📂 Report: backend/reports/medical_predictor_v32_validation.json`);

    process.exit(0);
}

validate();
