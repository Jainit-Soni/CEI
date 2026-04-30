const MedicalSeat = require('../models/MedicalSeatSchema');
const MedicalCutoff = require('../models/MedicalCutoffSchema');

/**
 * medicalTruthService.js
 * =======================
 * Production-grade query service for medical admission truth.
 * Switched from NDJSON files to MongoDB for query efficiency and scalability.
 */

async function getSeatsForEntity(entityId) {
    try {
        if (!entityId) return [];
        return await MedicalSeat.find({ medical_entity_id: entityId })
            .sort({ quota: 1, category: 1 })
            .lean();
    } catch (err) {
        console.error('[MedicalTruthService] Error fetching seats:', err.message);
        return [];
    }
}

async function getCutoffsForEntity(entityId) {
    try {
        if (!entityId) return [];
        return await MedicalCutoff.find({ medical_entity_id: entityId })
            .sort({ round: 1, quota: 1, category: 1 })
            .lean();
    } catch (err) {
        console.error('[MedicalTruthService] Error fetching cutoffs:', err.message);
        return [];
    }
}

/**
 * Legacy support for pre-loading truth files.
 * Now performs a simple health check or warm-up if needed.
 */
async function loadTruth() {
    // MongoDB handles lazy loading/pooling, but we can verify connection here
    const seatCount = await MedicalSeat.countDocuments();
    const cutoffCount = await MedicalCutoff.countDocuments();
    console.log(`[MedicalTruthService] Connected to MongoDB. Indexed: ${seatCount} seats, ${cutoffCount} cutoffs.`);
}

module.exports = {
    getSeatsForEntity,
    getCutoffsForEntity,
    loadTruth
};
