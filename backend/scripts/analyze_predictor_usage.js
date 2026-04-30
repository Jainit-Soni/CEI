const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const PredictorUsageEvent = require('../models/PredictorUsageEvent');
const connectDB = require('../config/db');

/**
 * analyze_predictor_usage.js
 * ===========================
 * Generates an analytics summary from anonymous predictor telemetry.
 */

async function analyzeUsage() {
    console.log("📊 Analyzing Predictor Telemetry...");
    await connectDB();

    const report = {
        summary: {
            total_runs: 0,
            total_clicks: 0,
            total_feedback: 0,
            ctr: "0%",
            helpful_rate: "0%"
        },
        domains: {
            engineering: { runs: 0, clicks: 0, feedback: 0 },
            medical: { runs: 0, clicks: 0, feedback: 0 }
        },
        behavior: {
            avg_results_per_run: 0,
            band_click_distribution: {},
            top_clicked_institutions: [],
            zero_result_runs: 0
        },
        risk_segments: {
            high_rank_zero_safe: 0,
            repeated_risky_clicks: 0
        }
    };

    // 1. Core Counts
    report.summary.total_runs = await PredictorUsageEvent.countDocuments({ event_type: 'prediction_run' });
    report.summary.total_clicks = await PredictorUsageEvent.countDocuments({ event_type: 'result_click' });
    report.summary.total_feedback = await PredictorUsageEvent.countDocuments({ event_type: 'feedback' });

    // 2. Domain Breakdown
    for (const domain of ['engineering', 'medical']) {
        report.domains[domain].runs = await PredictorUsageEvent.countDocuments({ domain, event_type: 'prediction_run' });
        report.domains[domain].clicks = await PredictorUsageEvent.countDocuments({ domain, event_type: 'result_click' });
        report.domains[domain].feedback = await PredictorUsageEvent.countDocuments({ domain, event_type: 'feedback' });
    }

    // 3. helpfulness Rate
    const helpfulCount = await PredictorUsageEvent.countDocuments({ event_type: 'feedback', 'feedback.helpful': true });
    if (report.summary.total_feedback > 0) {
        report.summary.helpful_rate = ((helpfulCount / report.summary.total_feedback) * 100).toFixed(2) + "%";
    }

    // 4. CTR
    if (report.summary.total_runs > 0) {
        report.summary.ctr = ((report.summary.total_clicks / report.summary.total_runs) * 100).toFixed(2) + "%";
    }

    // 5. Band Click Distribution
    const bandAgg = await PredictorUsageEvent.aggregate([
        { $match: { event_type: 'result_click' } },
        { $group: { _id: "$clicked_result.band", count: { $sum: 1 } } }
    ]);
    bandAgg.forEach(b => { report.behavior.band_click_distribution[b._id] = b.count; });

    // 6. Top Clicked Institutions
    const instAgg = await PredictorUsageEvent.aggregate([
        { $match: { event_type: 'result_click' } },
        { 
            $group: { 
                _id: "$clicked_result.institution_id", 
                count: { $sum: 1 },
                name: { $first: "$clicked_result.program" } // Using program as a proxy for name context
            } 
        },
        { $sort: { count: -1 } },
        { $limit: 10 }
    ]);
    report.behavior.top_clicked_institutions = instAgg;

    // 7. High Risk Segments
    report.risk_segments.high_rank_zero_safe = await PredictorUsageEvent.countDocuments({
        event_type: 'prediction_run',
        'input.rank': { $gt: 50000 },
        'result_summary.safe_count': 0
    });

    const reportPath = path.join(__dirname, '../reports/predictor_usage_summary.json');
    if (!fs.existsSync(path.dirname(reportPath))) fs.mkdirSync(path.dirname(reportPath));
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`\n✅ Analytics Complete.`);
    console.log(`📈 CTR: ${report.summary.ctr}`);
    console.log(`📈 Helpful Rate: ${report.summary.helpful_rate}`);
    console.log(`📂 Report: backend/reports/predictor_usage_summary.json`);

    process.exit(0);
}

analyzeUsage();
