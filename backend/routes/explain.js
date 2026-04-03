const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ScoringVersion = require('../models/ScoringVersion');

// ── Default Scoring Constitution Fallback ────────────────────────────────────
// Used when MongoDB is disconnected or ScoringVersion is uninitialized.
const DEFAULT_CONSTITUTION = {
    versionId: '2026.04.01-v1',
    activatedAt: new Date(),
    datasetHash: 'ndjson-internal-manifest',
    engineVersion: '3.1.0',
    freezeUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    weights: { A: 0.25, F: 0.15, I: 0.15, S: 0.10, D: 0.15, P: 0.35 },
    monteCarloConfig: { runs: 500 }
};

// ── Vector derivation logic (mirrors phase3_score.py feature engineering) ─────
// All values are normalized to [0, 1] range before applying weights.
// This reproduces the engine logic deterministically from stored fields.

const NAAC_MAP = {
    'A++': 1.0, 'A+': 0.85, 'A': 0.70, 'B++': 0.55, 'B+': 0.40,
    'B': 0.25, 'C': 0.10, 'NAAC_ACCREDITED': 0.35
};

const INSTITUTE_TYPE_MAP = {
    'Central University': 1.0, 'IIT': 1.0, 'IIM': 1.0, 'NIT': 0.9,
    'Deemed University': 0.8, 'State University': 0.7,
    'Private University': 0.6, 'Autonomous College': 0.5, 'College': 0.4
};

function clamp01(v) { return Math.max(0, Math.min(1, v || 0)); }

/**
 * Derive the 6 institutional score vectors from stored college fields.
 * Returns raw [0–1] values for each vector code.
 */
function deriveVectors(college) {
    // A — Academic Excellence / Ranking (25%)
    let rankingScore = 0;
    if (college.ranking && college.ranking < 100) rankingScore = 1.0;
    else if (college.ranking < 300) rankingScore = 0.6;
    else if (college.rankingTier === 'Tier 1') rankingScore = 0.8;
    else if (college.rankingTier === 'Tier 2') rankingScore = 0.4;
    const rawA = rankingScore;

    // F — Faculty & Record (15% - Institutional age benchmark 50 years)
    const estYear = parseInt(college.meta?.establishedYear || college.establishedYear || 1980);
    const age = Math.max(0, 2026 - estYear);
    const rawF = clamp01(age / 50);

    // I — Infrastructure & Reliability (15%)
    let rawI = college.rankingTier === 'Tier 1' ? 1.0 : 0.6;
    if (college.isPremium) rawI = Math.min(1.0, rawI + 0.2);

    // S — Scale & Programs (10%)
    const coursesCount = (college.courses?.length || 0) + (college.courseOfferings?.length || 0);
    const rawS = clamp01(coursesCount / 10);

    // D — Demand & Exam Tier (15%)
    let rawD = 0.3;
    const exams = (college.acceptedExams || []).map(e => (e || "").toLowerCase());
    if (exams.includes('cat') || exams.includes('gmat') || exams.includes('xat')) rawD = 1.0;
    else if (exams.includes('cmat') || exams.includes('snap') || exams.includes('nmat')) rawD = 0.7;

    // P — Placement Outcomes (35%)
    // Support both old and new placement data structures
    const avgLpaVal = college.placements?.averagePackageNumeric || (college.placements?.highestPackageNumeric ? college.placements.highestPackageNumeric / 3 : 0);
    // Support string packages like "25.0 LPA"
    let parsedLpa = avgLpaVal;
    if (typeof avgLpaVal === 'string') {
        parsedLpa = parseFloat(avgLpaVal.replace(/[^0-9.]/g, '')) || 0;
    }
    const rawP = clamp01(parsedLpa / 20);

    return { A: rawA, F: rawF, I: rawI, S: rawS, D: rawD, P: rawP };
}

const VECTOR_DESCRIPTIONS = {
    A: 'Ranking & Academic Excellence (Top 100 / Tier 1 status)',
    F: 'Institutional Age & Record (Proven faculty and alumni networks)',
    I: 'Infrastructure & Reliability (Premium status and facilities)',
    S: 'Program Breadth (Number of specialized courses offered)',
    D: 'Entrance Standards (Accepted exams like CAT/GMAT/CMAT)',
    P: 'Placement Strength (Average package and ROI potential)',
};

/**
 * Build the full explainability payload for one college.
 */
async function buildExplanation(college, activeVersion) {
    const vectors = deriveVectors(college);
    // Weights from the constitution or default
    const weights = activeVersion?.weights || { A: 0.25, F: 0.15, I: 0.15, S: 0.10, D: 0.15, P: 0.35 };
    const wSum = Object.values(weights).reduce((s, v) => s + v, 0);

    const breakdown = Object.keys(weights).map(code => {
        const raw = vectors[code] ?? 0;
        const weight = weights[code] ?? 0;
        const contribution = raw * weight * 100; // Scaled to 100 max
        return {
            code,
            description: VECTOR_DESCRIPTIONS[code] || code,
            weight,
            weightPct: `${(weight * 100).toFixed(0)}%`,
            rawValue: parseFloat(raw.toFixed(3)),
            rawPct: `${(raw * 100).toFixed(0)}%`,
            contribution: parseFloat(contribution.toFixed(2)),
            contributionPct: wSum > 0 ? `${((weight / wSum) * 100).toFixed(0)}%` : '–',
        };
    });

    const grossScore = breakdown.reduce((s, v) => s + v.contribution, 0);
    const penalty = 0; // Simplified for now since we recomputed core values

    // Stability meta
    const stabilityIndex = college.stabilityIndex ?? null;
    const confidenceBadge = college.confidenceBadge ?? null;
    const isVolatile = college.isScoreVolatile ?? false;

    let stabilityLabel, stabilityIcon, stabilityColor;
    if (stabilityIndex === null) {
        stabilityLabel = 'Not computed';
        stabilityIcon = '⬜';
        stabilityColor = 'neutral';
    } else if (stabilityIndex >= 75) {
        stabilityLabel = 'High Stability';
        stabilityIcon = '🟢';
        stabilityColor = 'stable';
    } else if (stabilityIndex >= 45) {
        stabilityLabel = 'Moderate Stability';
        stabilityIcon = '🟡';
        stabilityColor = 'moderate';
    } else {
        stabilityLabel = 'Volatile Ranking';
        stabilityIcon = '🔴';
        stabilityColor = 'volatile';
    }

    const cid = String(college.id || college._id);

    return {
        college: {
            id: cid,
            name: college.name,
            shortName: college.shortName,
            ceiScore: college.ceiScore,
            band: college.competitivenessBand,
            ceiScoredAt: college.ceiScoredAt,
            ceiEngineVersion: college.ceiEngineVersion,
            recordHash: college._recordHash,
        },
        methodology: activeVersion ? {
            versionId: activeVersion.versionId,
            activatedAt: activeVersion.activatedAt,
            datasetHash: activeVersion.datasetHash,
            engineVersion: activeVersion.engineVersion,
            freezeUntil: activeVersion.freezeUntil,
        } : null,
        vectorBreakdown: breakdown,
        scoreSummary: {
            grossScore: parseFloat(grossScore.toFixed(2)),
            penalty: penalty,
            finalScore: college.ceiScore,
            derivedScore: parseFloat((grossScore - penalty).toFixed(2)),
        },
        stabilityMeta: {
            stabilityIndex,
            confidenceBadge,
            isVolatile,
            stabilityLabel,
            stabilityIcon,
            stabilityColor,
            monteCarloRuns: activeVersion?.monteCarloConfig?.runs ?? null,
        },
    };
}

// ── GET /api/explain/:id ──────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        
        // --- Memory-First In-Memory Path (Phase 24) ---
        let college = (global.colleges || []).find(c => String(c.id || c._id) === String(id));
        
        let activeVersion = null;
        try {
            activeVersion = await ScoringVersion.findOne({ status: 'active' }).lean();
        } catch (e) {
            console.warn('[explain] MongoDB/Mongoose version lookup failed, using fallback.');
        }
        
        if (!activeVersion) activeVersion = DEFAULT_CONSTITUTION;

        if (!college) return res.status(404).json({ error: 'Institution not found' });

        const explanation = await buildExplanation(college, activeVersion);

        // Cache for constitution freeze window duration
        const maxAge = activeVersion?.freezeUntil
            ? Math.max(0, Math.floor((new Date(activeVersion.freezeUntil) - Date.now()) / 1000))
            : 3600;
        res.setHeader('Cache-Control', `public, max-age=${Math.min(maxAge, 86400)}`);

        res.json({ success: true, ...explanation });
    } catch (err) {
        console.error('[explain] Error:', err.message);
        res.status(500).json({ error: 'Failed to generate explanation' });
    }
});

// ── POST /api/explain/batch ────────────────────────────────────────────────────
router.post('/batch', async (req, res) => {
    try {
        let { ids } = req.body;
        if (!Array.isArray(ids) || ids.length < 1 || ids.length > 5) {
            return res.status(400).json({ error: 'Provide 1–5 institution IDs in `ids` array' });
        }
        ids = ids.map(id => String(id).slice(0, 100));

        // --- Memory-First In-Memory Path ---
        const matchedColleges = (global.colleges || []).filter(c => ids.includes(String(c.id || c._id)));
        
        let activeVersion = null;
        try {
            activeVersion = await ScoringVersion.findOne({ status: 'active' }).lean();
        } catch (e) {
            // Silently fallback to default in file-based mode
        }
        
        if (!activeVersion) activeVersion = DEFAULT_CONSTITUTION;

        // Preserve order
        const orderedColleges = ids.map(id => matchedColleges.find(c => String(c.id || c._id) === id)).filter(Boolean);

        // Version mismatch check
        const versions = [...new Set(orderedColleges.map(c => c.ceiEngineVersion).filter(Boolean))];
        const versionMismatch = versions.length > 1;

        const explanations = await Promise.all(
            orderedColleges.map(c => buildExplanation(c, activeVersion))
        );

        res.json({
            success: true,
            versionMismatch,
            versionIds: versions,
            activeVersion: activeVersion ? {
                versionId: activeVersion.versionId,
                activatedAt: activeVersion.activatedAt,
                datasetHash: activeVersion.datasetHash,
            } : null,
            explanations,
        });
    } catch (err) {
        console.error('[explain/batch] Error:', err.message, err.stack);
        res.status(500).json({ error: 'Failed to generate batch explanation' });
    }
});

module.exports = router;
