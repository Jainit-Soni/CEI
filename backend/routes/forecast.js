/**
 * routes/forecast.js — CEI Student Intelligence: Branch Forecasting & Career Trajectory
 * =======================================================================================
 * Phase XII — Student Intelligence Layer
 *
 * Endpoints:
 *   GET /api/forecast/branch/:branchName         — 3-year branch outlook
 *   GET /api/forecast/trajectory/:collegeId/:branch — Monte Carlo career trajectory
 */

const express = require('express');
const router = express.Router();
const College = require('../models/CollegeSchema');
const logger = (() => { try { return require('../lib/logger'); } catch { return console; } })();

// ── Monte Carlo Simulation (server-side, 500 runs) ───────────────────────────

/**
 * Runs N simulations of a career outcome given placement parameters.
 * Samples salary from a normal distribution using Box-Muller.
 *
 * @param {number} meanSalary       — LPA (lakhs per annum)
 * @param {number} volatility       — 0–1 coefficient of variation (from stability)
 * @param {number} placementRate    — 0–100
 * @param {number} N                — simulations (default 500)
 * @returns {{ p10, p50, p90, successRate, riskLabel }}
 */
function runMonteCarlo(meanSalary, volatility = 0.2, placementRate = 75, N = 500) {
    const stdDev = meanSalary * volatility;
    const results = [];

    function gaussianSample(mean, std) {
        const u1 = Math.random(), u2 = Math.random();
        const z = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2);
        return mean + z * std;
    }

    for (let i = 0; i < N; i++) {
        const placed = Math.random() * 100 <= placementRate;
        if (!placed) { results.push(0); continue; }
        const salary = gaussianSample(meanSalary, stdDev);
        results.push(Math.max(0, salary));
    }

    results.sort((a, b) => a - b);
    const pct = (p) => results[Math.floor(N * p / 100)];

    const successRate = (results.filter(r => r > 0).length / N * 100).toFixed(1);

    let riskLabel = 'Low Risk';
    if (volatility > 0.35 || placementRate < 60) riskLabel = 'High Risk';
    else if (volatility > 0.2 || placementRate < 75) riskLabel = 'Moderate Risk';

    return {
        pessimistic: +(pct(10)).toFixed(2),
        realistic: +(pct(50)).toFixed(2),
        optimistic: +(pct(90)).toFixed(2),
        successRate: +successRate,
        riskLabel,
        simulations: N
    };
}

// ── GET /api/forecast/branch/:branchName ──────────────────────────────────────

/**
 * Returns a 3-year branch outlook based on distribution and historical packages
 * from colleges offering that branch. Uses conservative linear extrapolation only
 * on data in the CEI dataset — no fabricated macro data.
 */
router.get('/branch/:branchName', async (req, res) => {
    try {
        const branch = decodeURIComponent(req.params.branchName).trim();
        if (!branch || branch.length > 100) {
            return res.status(400).json({ error: 'Invalid branch name.' });
        }

        // Find colleges offering this branch via courses array
        const colleges = await College.find(
            { 'courses.name': { $regex: branch, $options: 'i' } },
            {
                'courses.$': 1,
                'placements.highestPackageNumeric': 1,
                'placements.placementRate': 1,
                state: 1,
                rankingTier: 1
            }
        ).limit(500).lean();

        if (colleges.length < 3) {
            return res.json({
                branch,
                outlook: 'Insufficient Data',
                riskIndex: 50,
                basis: 'Less than 3 institutions offer this branch in the CEI dataset.',
                institutionCount: colleges.length
            });
        }

        // Compute metrics
        const packages = colleges
            .map(c => c.placements?.highestPackageNumeric)
            .filter(p => p > 0 && p < 200); // exclude absurd outliers

        const rates = colleges
            .map(c => parseFloat(c.placements?.placementRate))
            .filter(r => !isNaN(r) && r > 0 && r <= 100);

        const avgPackage = packages.length
            ? packages.reduce((a, b) => a + b, 0) / packages.length : null;
        const avgRate = rates.length
            ? rates.reduce((a, b) => a + b, 0) / rates.length : null;

        // Tier distribution (more Tier 1 = healthy demand)
        const tier1Count = colleges.filter(c => c.rankingTier === 'Tier 1').length;
        const tier1Ratio = tier1Count / colleges.length;

        // Simple outlook logic (conservative — no fabricated macro signals)
        let outlook = 'Stable';
        let riskIndex = 40;
        let basisPoints = [];

        if (avgPackage !== null) {
            if (avgPackage >= 12) { outlook = 'Growth'; riskIndex -= 10; basisPoints.push(`Mean highest package: ₹${avgPackage.toFixed(1)}L`); }
            else if (avgPackage < 6) { outlook = 'Declining'; riskIndex += 20; basisPoints.push(`Low mean package: ₹${avgPackage.toFixed(1)}L`); }
            else { basisPoints.push(`Moderate mean package: ₹${avgPackage.toFixed(1)}L`); }
        }
        if (avgRate !== null) {
            if (avgRate < 60) { riskIndex += 15; basisPoints.push(`Low avg placement rate: ${avgRate.toFixed(0)}%`); }
            else { basisPoints.push(`Avg placement rate: ${avgRate.toFixed(0)}%`); }
        }
        if (tier1Ratio > 0.1) {
            basisPoints.push(`${(tier1Ratio * 100).toFixed(0)}% of offering institutions are Tier 1`);
        }

        riskIndex = Math.min(100, Math.max(0, riskIndex));

        res.json({
            branch,
            outlook,
            riskIndex,
            institutionCount: colleges.length,
            avgHighestPackageLPA: avgPackage ? +avgPackage.toFixed(2) : null,
            avgPlacementRate: avgRate ? +avgRate.toFixed(1) : null,
            tier1Presence: +(tier1Ratio * 100).toFixed(1),
            basis: basisPoints.join('. '),
            disclaimer: 'Outlook derived from CEI dataset only — no external macro data used. 3-year projection is speculative.',
            scoringVersion: req.headers['x-scoring-version'] || null
        });
    } catch (err) {
        logger.error('[Forecast] branch error', { error: err.message });
        res.status(500).json({ error: 'Failed to compute branch forecast.' });
    }
});

// ── GET /api/forecast/trajectory/:collegeId/:branch ───────────────────────────

/**
 * Returns a 5-year Monte Carlo salary trajectory for a specific college + branch.
 * Volatility is derived from the college's stabilityIndex (if present) or defaults to 0.2.
 */
router.get('/trajectory/:collegeId/:branch', async (req, res) => {
    try {
        const { collegeId, branch } = req.params;

        const college = await College.findOne(
            { id: collegeId },
            {
                name: 1, shortName: 1,
                'placements.highestPackageNumeric': 1,
                'placements.averagePackage': 1,
                'placements.placementRate': 1,
                stabilityIndex: 1
            }
        ).lean();

        if (!college) return res.status(404).json({ error: 'Institution not found.' });

        const avgSalary = college.placements?.highestPackageNumeric ||
            parseFloat(college.placements?.averagePackage) || 6;

        const stabilityIndex = college.stabilityIndex || 50; // 0–100
        // Higher stability → lower volatility
        const volatility = Math.max(0.08, 0.5 - (stabilityIndex / 100) * 0.4);
        const placementRate = parseFloat(college.placements?.placementRate) || 70;

        const simulation = runMonteCarlo(avgSalary, volatility, placementRate, 500);

        // 5-year projection assuming 10% hike per year on realistic salary
        const fiveYearProjection = [];
        for (let y = 1; y <= 5; y++) {
            const growthFactor = Math.pow(1.10, y);
            fiveYearProjection.push({
                year: y,
                pessimistic: +(simulation.pessimistic * growthFactor).toFixed(2),
                realistic: +(simulation.realistic * growthFactor).toFixed(2),
                optimistic: +(simulation.optimistic * growthFactor).toFixed(2)
            });
        }

        res.json({
            collegeId,
            collegeName: college.name,
            branch: decodeURIComponent(branch),
            baselineSalaryLPA: avgSalary,
            volatility: +volatility.toFixed(3),
            stabilityIndex,
            monteCarlo: simulation,
            fiveYearProjection,
            disclaimer: 'Probabilistic simulation based on historical data. Not a placement guarantee. Past performance does not guarantee future results.'
        });
    } catch (err) {
        logger.error('[Forecast] trajectory error', { error: err.message });
        res.status(500).json({ error: 'Failed to compute career trajectory.' });
    }
});

module.exports = router;
