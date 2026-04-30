const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const MedicalSeat = require('../models/MedicalSeatSchema');
const MedicalCutoff = require('../models/MedicalCutoffSchema');

const connectDB = require('../config/db');

const SEAT_TRUTH_PATH = path.join(__dirname, '../data/truth/medical_seat_truth_final.ndjson');
const CUTOFF_TRUTH_PATH = path.join(__dirname, '../data/truth/medical_cutoff_truth_final.ndjson');

async function ingest() {
    try {
        console.log("🚀 Starting Medical Truth Ingestion to MongoDB...");
        await connectDB();
        console.log("✅ Connected to MongoDB.");

        // 1. Ingest Seats
        if (fs.existsSync(SEAT_TRUTH_PATH)) {
            console.log("📦 Ingesting Medical Seats...");
            const seatLines = fs.readFileSync(SEAT_TRUTH_PATH, 'utf8').trim().split('\n').filter(Boolean);
            let seatCount = 0;

            for (const line of seatLines) {
                const row = JSON.parse(line);
                const program_type = row.medical_entity_id.endsWith('-MBBS') ? 'MBBS' : 'BDS';
                const fingerprint = `${row.medical_entity_id}|${row.quota}|${row.category}|${row.round}|${row.year || 2025}|${row.source_url || 'N/A'}`;
                
                await MedicalSeat.findOneAndUpdate(
                    { fingerprint },
                    { ...row, program_type, fingerprint },
                    { upsert: true, new: true, runValidators: true }
                );
                seatCount++;
            }
            console.log(`✅ Ingested ${seatCount} medical seats.`);
        }

        // 2. Ingest Cutoffs
        if (fs.existsSync(CUTOFF_TRUTH_PATH)) {
            console.log("📦 Ingesting Medical Cutoffs...");
            const cutoffLines = fs.readFileSync(CUTOFF_TRUTH_PATH, 'utf8').trim().split('\n').filter(Boolean);
            let cutoffCount = 0;

            for (const line of cutoffLines) {
                const row = JSON.parse(line);
                const program_type = row.medical_entity_id.endsWith('-MBBS') ? 'MBBS' : 'BDS';
                const fingerprint = `${row.medical_entity_id}|${row.quota}|${row.category}|${row.round}|${row.year || 2025}|${row.closing_rank}`;
                
                await MedicalCutoff.findOneAndUpdate(
                    { fingerprint },
                    { ...row, program_type, fingerprint },
                    { upsert: true, new: true, runValidators: true }
                );
                cutoffCount++;
            }
            console.log(`✅ Ingested ${cutoffCount} medical cutoffs.`);
        }

        console.log("🎉 Ingestion Complete.");
    } catch (err) {
        console.error("❌ Ingestion Failed:", err);
    } finally {
        await mongoose.connection.close();
    }
}

ingest();
