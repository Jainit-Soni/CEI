const express = require('express');
const router = express.Router();
const medicalTruthService = require('../services/medicalTruthService');
const medicalPredictorService = require('../services/medicalPredictorV3Service');

// GET /api/medical/seats?entityId=...
router.get('/seats', async (req, res) => {
    const { entityId } = req.query;
    if (!entityId) return res.status(400).json({ error: 'entityId query param required' });
    
    const items = await medicalTruthService.getSeatsForEntity(entityId);
    res.json({
        items,
        meta: {
            total: items.length,
            sectionStatus: items.length > 0 ? 'available' : 'official_data_unavailable'
        }
    });
});

// GET /api/medical/cutoffs?entityId=...
router.get('/cutoffs', async (req, res) => {
    const { entityId } = req.query;
    if (!entityId) return res.status(400).json({ error: 'entityId query param required' });
    
    const items = await medicalTruthService.getCutoffsForEntity(entityId);
    res.json({
        items,
        meta: {
            total: items.length,
            sectionStatus: items.length > 0 ? 'available' : 'official_data_unavailable'
        }
    });
});

// GET /api/medical/predict?rank=...&quota=...&category=...&programType=...&state=...
router.get('/predict', async (req, res) => {
    try {
        const { rank, quota, category, programType, state } = req.query;
        if (!rank || !quota || !category) {
            return res.status(400).json({ error: 'rank, quota, and category are required' });
        }

        const prediction = await medicalPredictorService.predictMedicalV3({
            rank,
            quota,
            category,
            state,
            programType: programType || 'MBBS'
        });

        res.json(prediction);
    } catch (err) {
        console.error("[MedicalRoute] Error:", err.message, err.stack);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
