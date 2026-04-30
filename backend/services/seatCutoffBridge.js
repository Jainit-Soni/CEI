const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

let engineeringMappingCache = null;
let mccMappingCache = null;

function loadMappings() {
    if (engineeringMappingCache && mccMappingCache) return;
    
    try {
        const mapPath = path.join(__dirname, '../data/truth/core_id_mapping_batch1.json');
        const data = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
        
        engineeringMappingCache = {};
        for (const [name, id] of Object.entries(data.engineering_map || {})) {
            if (!engineeringMappingCache[id]) engineeringMappingCache[id] = new Set();
            engineeringMappingCache[id].add(name);
        }

        // --- NEW: Medical Identity Registry (Strict Gate) ---
        const medicalRegistryPath = path.join(__dirname, '../data/truth/medical_identity_registry.json');
        if (fs.existsSync(medicalRegistryPath)) {
            const medicalData = JSON.parse(fs.readFileSync(medicalRegistryPath, 'utf8'));
            mccMappingCache = {};
            for (const entry of medicalData) {
                if (entry.linkStatus === 'LINKED' && entry.targetId) {
                    if (!mccMappingCache[entry.targetId]) mccMappingCache[entry.targetId] = new Set();
                    if (entry.mccId) mccMappingCache[entry.targetId].add(entry.mccId);
                }
            }
        } else {
            console.warn('[SeatCutoffBridge] Medical registry missing at', medicalRegistryPath);
            mccMappingCache = {};
        }
    } catch (err) {
        console.error('[SeatCutoffBridge] Failed to load mappings', err);
        engineeringMappingCache = {};
        mccMappingCache = {};
    }
}

async function getSeatsAndCutoffsForCollege(canonicalId) {
    loadMappings();
    
    // Safety check for mongoose
    if (mongoose.connection.readyState !== 1) {
        console.log('[SeatCutoffBridge] MongoDB disconnected, bypassing seat matrix fetch');
        return { cutoffs: [], seats: [] };
    }
    
    const db = mongoose.connection.db;

    const results = {
        cutoffs: [],
        seats: [],
        metadata: {
            medical_link_status: 'UNLINKED',
            medical_source: 'MCC'
        }
    };

    // 1. Attempt Medical Resolution
    const mccIds = mccMappingCache[canonicalId] ? Array.from(mccMappingCache[canonicalId]) : [];
    if (mccIds.length > 0) {
        results.metadata.medical_link_status = 'LINKED';
        // Query using exact MCC ID (highest confidence), or fallback to known ID keys
        const seats = await db.collection('medical_seat_matrix').find({
            $or: [
                { institution_id: canonicalId },
                { canonical_id: canonicalId },
                { mcc_id: { $in: mccIds } }
            ]
        }).toArray();
        if (seats.length > 0) {
            results.seats = results.seats.concat(seats);
        }
        
        const cutoffs = await db.collection('medical_cutoffs').find({
            $or: [
                { institution_id: canonicalId },
                { canonical_id: canonicalId },
                { mcc_id: { $in: mccIds } }
            ]
        }).toArray();
        if (cutoffs.length > 0) {
            results.cutoffs = results.cutoffs.concat(cutoffs);
        }
    }

    // 2. Attempt Engineering Resolution
    const engNames = engineeringMappingCache[canonicalId] ? Array.from(engineeringMappingCache[canonicalId]) : [];
    if (engNames.length > 0) {
        // Query Cutoffs
        const engCutoffs = await db.collection('engineering_cutoffs').find({
            $or: [
                { institution_id: canonicalId },
                { canonical_id: canonicalId },
                { institute_name_normalized: { $in: engNames } }
            ]
        }).toArray();
        if (engCutoffs.length > 0) {
            results.cutoffs = results.cutoffs.concat(engCutoffs);
        }

        // Query Seats
        const engSeats = await db.collection('seat_matrix').find({
            $or: [
                { institution_id: canonicalId },
                { canonical_id: canonicalId },
                { institute_name_normalized: { $in: engNames } }
            ]
        }).toArray();
        if (engSeats.length > 0) {
            results.seats = results.seats.concat(engSeats);
        }
    }

    // 3. Last Resort Fallback (If no mappings matched, try pure ID match)
    if (mccIds.length === 0 && engNames.length === 0) {
        const fallbackCutoffs = await db.collection('engineering_cutoffs').find({
            $or: [{ institution_id: canonicalId }, { canonical_id: canonicalId }]
        }).toArray();
        if (fallbackCutoffs.length > 0) results.cutoffs = results.cutoffs.concat(fallbackCutoffs);
        
        const fallbackSeats = await db.collection('seat_matrix').find({
            $or: [{ institution_id: canonicalId }, { canonical_id: canonicalId }]
        }).toArray();
        if (fallbackSeats.length > 0) results.seats = results.seats.concat(fallbackSeats);
    }
    
    return results;
}

function normalizeComplianceItems(seatsAndCutoffsResult) {
    const items = [];
    if (seatsAndCutoffsResult.cutoffs && seatsAndCutoffsResult.cutoffs.length > 0) {
        const isMedical = seatsAndCutoffsResult.cutoffs.some(c => c.authority === 'MCC' || c.mcc_id);
        items.push({
            displayLabel: isMedical ? 'MCC Official Data (Linked)' : 'Engineering Cutoffs (Verified)',
            value: isMedical ? `${seatsAndCutoffsResult.cutoffs.length} verified cutoff rounds` : `${seatsAndCutoffsResult.cutoffs.length} historical variant tracks`,
            rawValue: seatsAndCutoffsResult.cutoffs.length,
            confidence: 1.0,
            source: { 
                title: isMedical ? 'Medical Counselling Committee (Official)' : 'JoSAA Official Cutoffs Archive', 
                type: 'counselling_allotment',
                freshness: '2025-2026'
            }
        });
    }

    if (seatsAndCutoffsResult.seats && seatsAndCutoffsResult.seats.length > 0) {
        const isMedical = seatsAndCutoffsResult.seats.some(s => s.authority === 'MCC' || s.mcc_id);
        const validSeats = seatsAndCutoffsResult.seats.filter(s => (s.seat_count || 0) < 10000); // Filter corrupted seat_counts
        
        items.push({
            displayLabel: isMedical ? 'MCC Official Data (Linked)' : 'Engineering Seat Matrix (Verified)',
            value: isMedical ? `${validSeats.reduce((sum, s) => sum + (s.seat_count || 0), 0)} MCC AIQ Seats` : `${validSeats.length} verified quota pools`,
            rawValue: isMedical ? validSeats.reduce((sum, s) => sum + (s.seat_count || 0), 0) : validSeats.length,
            confidence: 1.0,
            source: { 
                title: isMedical ? 'Medical Counselling Committee (Official)' : 'JoSAA Engineering Seat Matrices', 
                type: isMedical ? 'counselling_matrix' : 'official_seat_matrix',
                freshness: '2025-2026',
                disclaimer: isMedical ? 'This represents MCC All-India Quota allocation, not total institutional intake.' : null
            }
        });
    }
    
    return items;
}

function getEngineeringNamesForId(canonicalId) {
    loadMappings();
    if (!engineeringMappingCache) return [];
    return engineeringMappingCache[canonicalId] ? Array.from(engineeringMappingCache[canonicalId]) : [];
}

function getMccIdsForId(canonicalId) {
    loadMappings();
    if (!mccMappingCache) return [];
    return mccMappingCache[canonicalId] ? Array.from(mccMappingCache[canonicalId]) : [];
}

module.exports = {
   getSeatsAndCutoffsForCollege,
   normalizeComplianceItems,
   getEngineeringNamesForId,
   getMccIdsForId
};
