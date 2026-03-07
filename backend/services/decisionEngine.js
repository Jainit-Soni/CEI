/**
 * services/decisionEngine.js — CEI Student Decision Engine
 * ==========================================================
 * Analyzes a student's profile and returns top-N recommended colleges.
 *
 * Scoring formula (0–100):
 *   CEI Score           → 30%
 *   Placement Reality   → 25%
 *   Budget Fit          → 15%
 *   Rank Probability    → 15%
 *   Branch Strength     → 10%
 *   Location Score      →  5%
 */

'use strict';

const College = require('../models/CollegeSchema');
const PlacementReality = require('../models/PlacementReality');

// ── Band eligibility: map competitivenessBand → expected closing rank range ──
const BAND_RANK_RANGES = {
    Elite: { min: 1, max: 5000 },
    High: { min: 3000, max: 25000 },
    Competitive: { min: 15000, max: 80000 },
    Moderate: { min: 50000, max: 250000 },
    Emerging: { min: 100000, max: 10000000 },
};

// Career goal → branch keywords that signal fit
const CAREER_BRANCH_BOOST = {
    job: ['Computer Science', 'Software', 'Information Technology', 'Electronics', 'Electrical', 'Mechanical'],
    research: ['Physics', 'Chemistry', 'Biotechnology', 'Mathematics', 'Research', 'Science'],
    startup: ['Computer Science', 'Management', 'Entrepreneurship', 'Design', 'Information Technology'],
    abroad: ['Computer Science', 'Electronics', 'Aerospace', 'Biomedical', 'Physics'],
};

// ── Parse a tuition string like "₹1,20,000" or "2,50,000" → Number ──────────
function parseTuition(tuitionStr) {
    if (!tuitionStr) return null;
    const cleaned = String(tuitionStr).replace(/[₹,\s]/g, '').replace(/[^0-9.]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
}

// ── Rank probability: how likely is this rank to clear this college? ─────────
function computeRankProbability(studentRank, band) {
    const range = BAND_RANK_RANGES[band];
    if (!range) return 0.3;

    // Student rank <= min → very safe
    if (studentRank <= range.min) return 1.0;
    // Student rank > max → impossible
    if (studentRank > range.max * 1.3) return 0.0;

    // Linear interpolation within the band
    const prob = 1.0 - (studentRank - range.min) / (range.max - range.min);
    return Math.max(0, Math.min(1, prob));
}

// ── Branch strength: does the college offer the requested branch? ─────────────
function computeBranchStrength(college, preferredBranch) {
    if (!preferredBranch) return 0.5; // no preference → neutral
    const needle = preferredBranch.toLowerCase();
    const courses = college.courses || [];

    const exactMatch = courses.some(c => c.name?.toLowerCase().includes(needle));
    if (exactMatch) return 1.0;

    // Fuzzy: first word match
    const firstWord = needle.split(' ')[0];
    const partialMatch = courses.some(c => c.name?.toLowerCase().includes(firstWord));
    return partialMatch ? 0.65 : 0.0;
}

// ── Budget fit: 0 if over budget, scaled 0–1 within budget ───────────────────
function computeBudgetFit(college, budgetPerYear) {
    const tuition = parseTuition(college.tuition);
    if (!tuition) return 0.5; // unknown → neutral
    if (tuition < 10000) return 0.5; // implausibly low → skip noise
    if (tuition > budgetPerYear) return 0.0;
    // How well within budget
    return Math.min(1.0, (budgetPerYear - tuition) / budgetPerYear + 0.2);
}

// ── Placement reality score: from PlacementReality collection or estimates ────
function getPlacementScore(college, prMap) {
    const pr = prMap.get(college.id);
    if (pr?.placementRealityScore != null) return pr.placementRealityScore / 100;

    // Fallback: estimate from raw placement data
    const rateStr = college.placements?.placementRate;
    if (rateStr) {
        const rate = parseFloat(String(rateStr).replace('%', ''));
        if (!isNaN(rate)) return Math.min(rate / 100, 1.0);
    }
    return 0.4; // default for unknown
}

// ── Career goal bonus: adjust branch match by career goal ────────────────────
function computeCareerGoalBonus(college, preferredBranch, careerGoal) {
    const relevantBranches = CAREER_BRANCH_BOOST[careerGoal] || [];
    const courses = college.courses || [];
    const hasFit = courses.some(c =>
        relevantBranches.some(rb => c.name?.toLowerCase().includes(rb.toLowerCase()))
    );
    return hasFit ? 1.0 : 0.3;
}

// ── Reason generation ─────────────────────────────────────────────────────────
function generateReasons(college, scores, inputs, pr) {
    const reasons = [];

    if (scores.ceiNorm > 0.75) reasons.push(`Top-tier CEI intelligence score (${(scores.ceiNorm * 100).toFixed(0)}/100)`);
    else if (scores.ceiNorm > 0.5) reasons.push(`Above-average CEI score`);

    if (scores.placementNorm > 0.75) reasons.push('High placement reliability' + (pr ? ` (${pr.reliabilityLabel})` : ''));
    else if (scores.placementNorm > 0.5) reasons.push('Moderate placement confidence');

    if (scores.rankProb >= 0.85) reasons.push('Your rank is well within the closing range');
    else if (scores.rankProb >= 0.5) reasons.push('Competitive but achievable with your rank');
    else if (scores.rankProb >= 0.25) reasons.push('Stretch goal — prepare well for this one');

    if (scores.budgetFit >= 0.8) reasons.push(`Comfortably within your ₹${(inputs.budgetPerYear / 100000).toFixed(1)}L/yr budget`);
    else if (scores.budgetFit >= 0.5) reasons.push('Within your annual budget');

    if (scores.branchScore === 1.0) reasons.push(`Offers ${inputs.preferredBranch} — exact match`);
    else if (scores.branchScore === 0.65) reasons.push(`Offers a closely related branch to ${inputs.preferredBranch}`);

    if (inputs.preferredState && college.state === inputs.preferredState) reasons.push(`Located in your preferred state (${college.state})`);

    if (college.dataConfidenceLabel === 'high') reasons.push('Data verified and high-confidence');

    return reasons.slice(0, 4); // max 4 reasons
}

// ── Eligibility filter ─────────────────────────────────────────────────────────
function buildMongoFilter(inputs) {
    const { rank, budgetPerYear, preferredBranch, preferredState, collegeType } = inputs;

    const filter = {};

    // College type filter
    if (collegeType === 'government') {
        filter['meta.ownership'] = { $in: ['Government', 'government', 'Govt', 'Public'] };
    } else if (collegeType === 'private') {
        filter['meta.ownership'] = { $in: ['Private', 'private', 'Deemed', 'Self-Financed'] };
    }

    // State preference (if provided)
    if (preferredState) {
        filter.state = preferredState;
    }

    // Only colleges with a CEI score
    filter.ceiScore = { $ne: null, $gt: 0 };

    return filter;
}

// ── Main exported function ────────────────────────────────────────────────────
async function runDecisionEngine(inputs, topN = 10) {
    const {
        rank,
        budgetPerYear,
        preferredBranch,
        preferredState,
        collegeType = 'either',
        careerGoal = 'job',
    } = inputs;

    const startTime = Date.now();

    // 1. MongoDB eligibility filter
    const filter = buildMongoFilter(inputs);

    const colleges = await College.find(filter)
        .select('id name state location tuition ceiScore competitivenessBand rankingTier placements courses meta dataIntegrityScore dataConfidenceLabel verificationStatus overview')
        .lean();

    // 2. Load PlacementReality scores for these colleges (batch)
    const collegeIds = colleges.map(c => c.id).filter(Boolean);
    let prRecords = [];
    try {
        prRecords = await PlacementReality.find({ collegeId: { $in: collegeIds } })
            .select('collegeId placementRealityScore reliabilityLabel')
            .lean();
    } catch { /* PlacementReality may be empty */ }

    const prMap = new Map(prRecords.map(r => [r.collegeId, r]));

    // 3. Score each college
    const scored = [];

    for (const college of colleges) {
        const rankProb = computeRankProbability(rank, college.competitivenessBand);
        const budgetFit = computeBudgetFit(college, budgetPerYear);
        const branchScore = computeBranchStrength(college, preferredBranch);
        const careerBonus = computeCareerGoalBonus(college, preferredBranch, careerGoal);
        const adjustedBranch = (branchScore * 0.6) + (careerBonus * 0.4); // blend
        const locationScore = (preferredState && college.state === preferredState) ? 1.0 : 0.0;
        const ceiNorm = (college.ceiScore || 0) / 100;
        const placementNorm = getPlacementScore(college, prMap);

        // Skip if rank probability is 0 (impossible) or budget is totally blown
        if (rankProb === 0 && college.competitivenessBand !== 'Emerging') continue;
        if (budgetFit === 0) continue;

        const raw =
            (ceiNorm * 0.30) +
            (placementNorm * 0.25) +
            (budgetFit * 0.15) +
            (rankProb * 0.15) +
            (adjustedBranch * 0.10) +
            (locationScore * 0.05);

        const studentScore = parseFloat((raw * 100).toFixed(1));

        const scoreComponents = { ceiNorm, placementNorm, budgetFit, rankProb, branchScore, careerBonus, locationScore };
        const reasons = generateReasons(college, scoreComponents, inputs, prMap.get(college.id));

        scored.push({
            collegeId: college.id,
            name: college.name,
            state: college.state,
            location: college.location,
            rankingTier: college.rankingTier,
            band: college.competitivenessBand,
            ceiScore: college.ceiScore ?? 0,
            tuition: college.tuition,
            overview: college.overview,
            studentScore,
            match: studentScore >= 80 ? 'Excellent' : studentScore >= 60 ? 'Good' : studentScore >= 40 ? 'Fair' : 'Stretch',
            reasons,
            placementRealityScore: prMap.get(college.id)?.placementRealityScore ?? null,
            placementReliabilityLabel: prMap.get(college.id)?.reliabilityLabel ?? null,
            dataConfidenceLabel: college.dataConfidenceLabel,
            // Rough ROI estimate: if avg package known, salary/tuition ratio
            estimatedROI: (() => {
                const avgPkg = parseFloat(String(college.placements?.averagePackage || '').replace(/[^0-9.]/g, ''));
                const fee = parseTuition(college.tuition);
                if (avgPkg && fee && fee > 0) return `${(avgPkg / fee).toFixed(1)}x`;
                return null;
            })(),
        });
    }

    // 4. Sort and return top N
    scored.sort((a, b) => b.studentScore - a.studentScore);
    const recommendations = scored.slice(0, topN);

    return {
        recommendations,
        meta: {
            totalEligible: scored.length,
            processingMs: Date.now() - startTime,
            inputs,
        },
    };
}

module.exports = { runDecisionEngine };
