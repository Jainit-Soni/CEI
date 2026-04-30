const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PredictorUsageEvent = require('../models/PredictorUsageEvent');
const connectDB = require('../config/db');

/**
 * predictor_insight_engine.js
 * ============================
 * Deep analysis of predictor telemetry to identify product optimization opportunities.
 */

const RANK_RANGES = [
    { label: "1–5k", min: 1, max: 5000 },
    { label: "5k–15k", min: 5001, max: 15000 },
    { label: "15k–30k", min: 15001, max: 30000 },
    { label: "30k–75k", min: 30001, max: 75000 },
    { label: "75k+", min: 75001, max: 10000000 }
];

async function runInsightEngine() {
    console.log("🧠 Starting Predictor Insight Engine...");
    await connectDB();

    const insights = {
        timestamp: new Date().toISOString(),
        overview: {
            total_runs: 0,
            domain_split: {},
            ctr: 0,
            helpful_rate: 0
        },
        behavior: {
            clicks_by_band: {},
            highest_ctr_band: "SAFE",
            rank_range_distribution: {},
            repeated_risky_click_sessions: 0
        },
        satisfaction: {
            low_satisfaction_segments: [],
            zero_result_patterns: []
        },
        top_performers: {
            institutions: []
        }
    };

    // 1. Overview
    const totalRuns = await PredictorUsageEvent.countDocuments({ event_type: 'prediction_run' });
    const totalClicks = await PredictorUsageEvent.countDocuments({ event_type: 'result_click' });
    const totalFeedback = await PredictorUsageEvent.countDocuments({ event_type: 'feedback' });
    const helpfulCount = await PredictorUsageEvent.countDocuments({ event_type: 'feedback', 'feedback.helpful': true });

    insights.overview.total_runs = totalRuns;
    insights.overview.ctr = totalRuns > 0 ? (totalClicks / totalRuns) : 0;
    insights.overview.helpful_rate = totalFeedback > 0 ? (helpfulCount / totalFeedback) : 0;

    // 2. Domain Split
    const engRuns = await PredictorUsageEvent.countDocuments({ domain: 'engineering', event_type: 'prediction_run' });
    const medRuns = await PredictorUsageEvent.countDocuments({ domain: 'medical', event_type: 'prediction_run' });
    insights.overview.domain_split = { engineering: engRuns, medical: medRuns };

    // 3. Band CTR
    const bandAgg = await PredictorUsageEvent.aggregate([
        { $match: { event_type: 'result_click' } },
        { $group: { _id: "$clicked_result.band", count: { $sum: 1 } } }
    ]);
    let maxBandCount = 0;
    bandAgg.forEach(b => {
        insights.behavior.clicks_by_band[b._id] = b.count;
        if (b.count > maxBandCount) {
            maxBandCount = b.count;
            insights.behavior.highest_ctr_band = b._id;
        }
    });

    // 4. Rank Range Distribution
    for (const range of RANK_RANGES) {
        const count = await PredictorUsageEvent.countDocuments({
            event_type: 'prediction_run',
            'input.rank': { $gte: range.min, $lte: range.max }
        });
        insights.behavior.rank_range_distribution[range.label] = count;
    }

    // 5. Zero Result Patterns
    const zeroResults = await PredictorUsageEvent.aggregate([
        { $match: { event_type: 'prediction_run', 'result_summary.total_count': 0 } },
        { $group: { _id: { quota: "$input.quota", category: "$input.category" }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
    ]);
    insights.satisfaction.zero_result_patterns = zeroResults;

    // 6. Top Clicked
    const topInst = await PredictorUsageEvent.aggregate([
        { $match: { event_type: 'result_click' } },
        { $group: { _id: "$clicked_result.institution_id", name: { $first: "$clicked_result.program" }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
    ]);
    insights.top_performers.institutions = topInst;

    const reportPath = path.join(__dirname, '../reports/predictor_insights.json');
    fs.writeFileSync(reportPath, JSON.stringify(insights, null, 2));

    console.log(`\n✅ Insights Generated.`);
    console.log(`📈 Total Runs: ${insights.overview.total_runs}`);
    console.log(`📈 Highest CTR Band: ${insights.behavior.highest_ctr_band}`);
    console.log(`📂 Report: backend/reports/predictor_insights.json`);

    process.exit(0);
}

runInsightEngine();
