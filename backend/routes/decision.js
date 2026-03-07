/**
 * routes/decision.js — CEI Student Decision Tool API
 * ====================================================
 * POST /api/decision/recommend
 *
 * Public endpoint (no auth required). Redis-cached for 1h.
 * Uses the decisionEngine service to score 68k colleges in < 200ms.
 */

'use strict';

const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { runDecisionEngine } = require('../services/decisionEngine');
const { getRedisClient } = require('../config/redis');

// ── Cache helpers ─────────────────────────────────────────────────────────────

async function cacheGet(key) {
    try {
        const redis = await getRedisClient();
        const val = await redis?.get(key);
        return val ? JSON.parse(val) : null;
    } catch { return null; }
}

async function cacheSet(key, val, ttlSec = 3600) {
    try {
        const redis = await getRedisClient();
        await redis?.set(key, JSON.stringify(val), 'EX', ttlSec);
    } catch { /* cache miss is OK */ }
}

// ── Input Validation ─────────────────────────────────────────────────────────

const VALID_COLLEGE_TYPES = ['government', 'private', 'either'];
const VALID_CAREER_GOALS = ['job', 'research', 'startup', 'abroad'];

function validateInputs(body) {
    const errors = [];
    const { rank, budgetPerYear, preferredBranch, collegeType, careerGoal } = body;

    if (!rank || typeof rank !== 'number' || rank < 1 || rank > 10_000_000) {
        errors.push('rank must be a number between 1 and 10,000,000');
    }
    if (!budgetPerYear || typeof budgetPerYear !== 'number' || budgetPerYear < 1000) {
        errors.push('budgetPerYear must be a number (minimum ₹1,000)');
    }
    if (!preferredBranch || typeof preferredBranch !== 'string' || preferredBranch.trim().length < 2) {
        errors.push('preferredBranch is required (e.g. "Computer Science")');
    }
    if (collegeType && !VALID_COLLEGE_TYPES.includes(collegeType)) {
        errors.push(`collegeType must be one of: ${VALID_COLLEGE_TYPES.join(', ')}`);
    }
    if (careerGoal && !VALID_CAREER_GOALS.includes(careerGoal)) {
        errors.push(`careerGoal must be one of: ${VALID_CAREER_GOALS.join(', ')}`);
    }
    return errors;
}

// ── POST /api/decision/recommend ──────────────────────────────────────────────

router.post('/recommend', async (req, res) => {
    const errors = validateInputs(req.body);
    if (errors.length > 0) {
        return res.status(400).json({ error: 'Invalid input', details: errors });
    }

    const inputs = {
        rank: parseInt(req.body.rank),
        budgetPerYear: parseInt(req.body.budgetPerYear),
        preferredBranch: req.body.preferredBranch.trim(),
        preferredState: req.body.preferredState?.trim() || null,
        collegeType: req.body.collegeType || 'either',
        careerGoal: req.body.careerGoal || 'job',
    };

    // ── Redis cache check ───────────────────────────────────────────────────
    const hash = crypto.createHash('sha256').update(JSON.stringify(inputs)).digest('hex').slice(0, 16);
    const cacheKey = `decision:${hash}`;

    const cached = await cacheGet(cacheKey);
    if (cached) {
        return res.json({ source: 'cache', ...cached });
    }

    // ── Run engine ──────────────────────────────────────────────────────────
    try {
        const result = await runDecisionEngine(inputs, 10);

        await cacheSet(cacheKey, result, 3600); // 1h TTL

        return res.json({ source: 'engine', ...result });
    } catch (err) {
        console.error('[Decision] Engine error:', err.message);
        return res.status(500).json({ error: 'Decision engine failure: ' + err.message });
    }
});

// ── GET /api/decision/branches — helper for frontend autocomplete ─────────────

const COMMON_BRANCHES = [
    'Computer Science', 'Information Technology', 'Electronics and Communication',
    'Electrical Engineering', 'Mechanical Engineering', 'Civil Engineering',
    'Chemical Engineering', 'Biotechnology', 'Aerospace Engineering',
    'Biomedical Engineering', 'Data Science', 'Artificial Intelligence',
    'Mathematics', 'Physics', 'Chemistry', 'MBA', 'Management',
    'Arts', 'Commerce', 'Law', 'Medicine', 'Architecture',
];

router.get('/branches', (req, res) => {
    const { q } = req.query;
    const filtered = q
        ? COMMON_BRANCHES.filter(b => b.toLowerCase().includes(q.toLowerCase()))
        : COMMON_BRANCHES;
    res.json({ branches: filtered });
});

module.exports = router;
