const express = require('express');
const router = express.Router();
const PredictorUsageEvent = require('../models/PredictorUsageEvent');

/**
 * predictor_telemetry.js
 * =======================
 * @route   POST /api/predictor/telemetry/run
 * @route   POST /api/predictor/telemetry/click
 * @route   POST /api/predictor/telemetry/feedback
 */

// 1. POST /api/predictor/telemetry/run
router.post('/run', async (req, res) => {
    try {
        const { session_id, domain, input, result_summary } = req.body;

        if (!session_id || !domain || !input) {
            return res.status(400).json({ error: "Missing required telemetry fields" });
        }

        const event = new PredictorUsageEvent({
            session_id,
            domain,
            event_type: 'prediction_run',
            input,
            result_summary
        });

        await event.save();
        res.json({ ok: true });
    } catch (err) {
        console.error("[Telemetry] Run Error:", err.message);
        res.status(500).json({ error: "Internal telemetry failure" });
    }
});

// 2. POST /api/predictor/telemetry/click
router.post('/click', async (req, res) => {
    try {
        const { session_id, domain, clicked_result } = req.body;

        if (!session_id || !domain || !clicked_result) {
            return res.status(400).json({ error: "Missing required click fields" });
        }

        const event = new PredictorUsageEvent({
            session_id,
            domain,
            event_type: 'result_click',
            clicked_result
        });

        await event.save();
        res.json({ ok: true });
    } catch (err) {
        console.error("[Telemetry] Click Error:", err.message);
        res.status(500).json({ error: "Internal telemetry failure" });
    }
});

// 3. POST /api/predictor/telemetry/feedback
router.post('/feedback', async (req, res) => {
    try {
        const { session_id, domain, feedback } = req.body;

        if (!session_id || !domain || feedback === undefined) {
            return res.status(400).json({ error: "Missing feedback data" });
        }

        const event = new PredictorUsageEvent({
            session_id,
            domain,
            event_type: 'feedback',
            feedback
        });

        await event.save();
        res.json({ ok: true });
    } catch (err) {
        console.error("[Telemetry] Feedback Error:", err.message);
        res.status(500).json({ error: "Internal telemetry failure" });
    }
});

module.exports = router;
