/**
 * routes/explain.js — CEI Score Explainability API
 * ==================================================
 * Assembles the full explanation payload for one or more institutions.
 * All outputs are anchored to the active ScoringVersion so every
 * explanation is version-referenced and reproducible.
 *
 * Option 1 (current): Vector contributions re-derived from stored MongoDB
 * fields using the same weight vector as the active ScoringVersion.
 * This is deterministically consistent with the scoring engine output.
 *
 * Endpoints:
 *   GET  /api/explain/:id       — Single institution explanation
 *   POST /api/explain/batch     — Multi-institution comparison payload
 */

const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const ScoringVersion = require('../models/ScoringVersion');

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
    // A — Accreditation
    const naacGrade = college.meta?.naacGrade || college.accreditation || '';
    const isElite = /IIT|IIM|NIT|AIIMS|IISc|BITS|Indian Institute of (Technology|Management)/i.test(college.name || '');
    const rawA = isElite ? 1.0 : (NAAC_MAP[naacGrade?.toUpperCase?.()] ?? 0.15);

    // F — Faculty Legacy (institutional age as proxy)
    const estYear = parseInt(college.meta?.establishedYear || college.establishedYear || 1980);
    const age = Math.max(0, 2026 - estYear);
    const rawF = clamp01(age / 100); // 100-year-old institution = max

    // I — Infrastructure (derived from scale + category)
    const ownership = (college.meta?.ownership || '').toLowerCase();
    const isGovt = ownership.includes('government') || ownership.includes('central') || ownership.includes('state');
    const rawI = isGovt ? 0.80 : 0.50;

    // S — Scale (university > autonomous > college)
    const category = (college.category || college.type || '').toLowerCase();
    const rawS = category.includes('university') ? 0.90
        : category.includes('deemed') ? 0.80
            : category.includes('autonomous') ? 0.65
                : 0.45;

    // D — Demand / Selectivity (accreditation × elite bonus)
    const rawD = clamp01(rawA * (isElite ? 1.2 : 1.0));

    // U — Urban proximity (deterministic: metro > tier-2 > rural)
    const location = (college.location || college.state || '').toLowerCase();
    const metros = ['mumbai', 'delhi', 'bangalore', 'bengaluru', 'chennai', 'hyderabad', 'pune', 'kolkata'];
    const isMetro = metros.some(m => location.includes(m));
    const rawU = isMetro ? 0.85 : 0.55;

    // Penalty reconstruction
    const penaltyPts = (!college.meta?.district ? 2 : 0)
        + (!college.meta?.establishedYear ? 2 : 0)
        + (!naacGrade && !isElite ? 3 : 0);

    return { A: rawA, F: rawF, I: rawI, S: rawS, D: rawD, U: rawU, penaltyPts };
}

const VECTOR_DESCRIPTIONS = {
    A: 'Accreditation quality (NAAC grade or elite institution proxy)',
    F: 'Faculty legacy (institutional age — proxy for stability & track record)',
    I: 'Infrastructure capacity (ownership and institutional category)',
    S: 'Scale of institution (University > Autonomous > College)',
    D: 'Demand & selectivity (accreditation weighted × elite adjustment)',
    U: 'Urban proximity (geographic accessibility — deterministic mapping)',
};

/**
 * Build the full explainability payload for one college.
 */
async function buildExplanation(college, activeVersion) {
    const vectors = deriveVectors(college);
    const weights = activeVersion?.weights || { A: 0.30, F: 0.15, I: 0.15, S: 0.15, D: 0.15, U: 0.10 };
    const wSum = Object.values(weights).reduce((s, v) => s + v, 0);

    const breakdown = Object.keys(weights).map(code => {
        const raw = vectors[code] ?? 0;
        const weight = weights[code] ?? 0;
        const contribution = raw * weight * 15; // Scale of 15 pts max per vector = 90pt raw
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
    const penalty = Math.min(activeVersion?.penaltyRules?.maxPenalty ?? 10, vectors.penaltyPts);

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

    return {
        college: {
            id: college.id,
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
        const [college, activeVersion] = await Promise.all([
            mongoose.connection.db.collection('colleges').findOne(
                { id: req.params.id },
                {
                    projection: {
                        id: 1, name: 1, shortName: 1, ceiScore: 1, competitivenessBand: 1,
                        ceiScoredAt: 1, ceiEngineVersion: 1, stabilityIndex: 1,
                        confidenceBadge: 1, isScoreVolatile: 1, _recordHash: 1,
                        meta: 1, location: 1, state: 1, category: 1, type: 1,
                        accreditation: 1, establishedYear: 1
                    }
                }
            ),
            ScoringVersion.findOne({ status: 'active' }).lean(),
        ]);

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

        const [colleges, activeVersion] = await Promise.all([
            mongoose.connection.db.collection('colleges').find(
                { id: { $in: ids } },
                {
                    projection: {
                        id: 1, name: 1, shortName: 1, ceiScore: 1, competitivenessBand: 1,
                        ceiScoredAt: 1, ceiEngineVersion: 1, stabilityIndex: 1,
                        confidenceBadge: 1, isScoreVolatile: 1, _recordHash: 1,
                        meta: 1, location: 1, state: 1, category: 1, type: 1,
                        accreditation: 1, establishedYear: 1
                    }
                }
            ).toArray(),
            ScoringVersion.findOne({ status: 'active' }).lean(),
        ]);

        // Preserve order
        const orderedColleges = ids.map(id => colleges.find(c => c.id === id)).filter(Boolean);

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
        console.error('[explain/batch] Error:', err.message);
        res.status(500).json({ error: 'Failed to generate batch explanation' });
    }
});

module.exports = router;
