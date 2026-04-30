const mongoose = require('mongoose');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const connectDB = require('../config/db');

/**
 * export_colleges_to_excel.js
 * ============================
 * Generates truth-grade Excel exports for the CEI National Database.
 */

async function runExport() {
    console.log("📂 Initializing CEI Truth-Grade Excel Export...");
    await connectDB();

    const db = mongoose.connection.db;
    const exportDir = path.join(__dirname, '../exports');
    if (!fs.existsSync(exportDir)) fs.mkdirSync(exportDir);

    // --- 1. PRE-AGGREGATE COUNTS ---
    console.log("📊 Aggregating truth status counts...");
    
    const engCutoffCounts = await db.collection('engineering_cutoffs').aggregate([
        { $group: { _id: "$institution_id", count: { $sum: 1 } } }
    ]).toArray();
    const engCutoffMap = Object.fromEntries(engCutoffCounts.map(c => [c._id, c.count]));

    const engSeatCounts = await db.collection('seat_matrix').aggregate([
        { $group: { _id: "$institution_id", count: { $sum: 1 } } }
    ]).toArray();
    const engSeatMap = Object.fromEntries(engSeatCounts.map(c => [c._id, c.count]));

    const medCutoffCounts = await db.collection('medicalcutoffs').aggregate([
        { $group: { _id: "$medical_entity_id", count: { $sum: 1 } } }
    ]).toArray();
    const medCutoffMap = Object.fromEntries(medCutoffCounts.map(c => [c._id, c.count]));

    const medSeatCounts = await db.collection('medicalseats').aggregate([
        { $group: { _id: "$medical_entity_id", count: { $sum: 1 } } }
    ]).toArray();
    const medSeatMap = Object.fromEntries(medSeatCounts.map(c => [c._id, c.count]));

    // --- 2. FILE 1: colleges_master.xlsx ---
    console.log("📝 Generating colleges_master.xlsx...");
    const institutions = await db.collection('institutions').find({}).toArray();

    const masterRows = institutions.map(inst => {
        const id = inst.institution_id || inst.id || inst._id.toString();
        const engC = engCutoffMap[id] || 0;
        const engS = engSeatMap[id] || 0;
        const medC = medCutoffMap[id] || 0;
        const medS = medSeatMap[id] || 0;

        const hasCutoffs = engC > 0;
        const hasSeats = engS > 0;
        const hasMedCutoffs = medC > 0;
        const hasMedSeats = medS > 0;

        const score = (hasCutoffs ? 1 : 0) + (hasSeats ? 1 : 0) + (hasMedCutoffs ? 1 : 0) + (hasMedSeats ? 1 : 0);
        const tier = ["E", "D", "C", "B", "A"][score];

        return {
            institution_id: id,
            name: inst.name || 'Unknown',
            canonical_name: inst.canonicalName || inst.name || 'Unknown',
            state: inst.state || 'N/A',
            city: inst.city || 'N/A',
            source: inst.source || (inst.meta && inst.meta.source) || 'AICTE',
            has_cutoffs: hasCutoffs,
            has_seats: hasSeats,
            has_medical_cutoffs: hasMedCutoffs,
            has_medical_seats: hasMedSeats,
            truth_completeness_score: score,
            truth_tier: tier,
            truth_importance: inst.truthImportance || 'LOW',
            total_cutoff_rows: engC,
            total_seat_rows: engS,
            total_medical_cutoff_rows: medC,
            total_medical_seat_rows: medS,
            last_updated_at: inst.updatedAt || new Date().toISOString()
        };
    });

    const masterWS = XLSX.utils.json_to_sheet(masterRows);
    const masterWB = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(masterWB, masterWS, "Institutions");
    XLSX.writeFile(masterWB, path.join(exportDir, 'colleges_master.xlsx'));

    // --- 3. FILE 2: colleges_deep_truth.xlsx ---
    console.log("📝 Generating colleges_deep_truth.xlsx (flattened)...");
    const deepRows = [];
    const exportedFingerprints = new Set();

    // Helper to push rows
    const pushRows = (data, domain, isCutoff) => {
        data.forEach(d => {
            const hasRank = d.opening_rank !== null && d.opening_rank !== undefined;
            const hasClosing = d.closing_rank !== null && d.closing_rank !== undefined;
            const hasSeat = d.seat_count !== null && d.seat_count !== undefined || d.total_seats !== null && d.total_seats !== undefined;

            if (!hasRank && !hasClosing && !hasSeat) return; // SKIP EMPTY TRUTH

            const id = d.institution_id || d.medical_entity_id || d.id;
            const program = d.program_title || d.program_type || d.course_name || 'N/A';
            const quota = d.quota_canonical || d.quota || 'N/A';
            const category = d.canonical_category_label || d.category || 'N/A';
            const round = d.round_number || d.round || 'N/A';
            const year = d.year || null;

            const fingerprint = `${id}|${domain}|${program}|${quota}|${category}|${round}|${year}|${d.closing_rank}|${d.seat_count}`;
            if (exportedFingerprints.has(fingerprint)) return;
            exportedFingerprints.add(fingerprint);

            deepRows.push({
                institution_id: id,
                name: d.institute_name_normalized || d.college_name || 'N/A',
                domain: domain,
                program: program,
                quota: quota,
                category: category,
                gender_pool: d.gender_pool_canonical || 'GENDER_NEUTRAL',
                round: round,
                opening_rank: d.opening_rank || null,
                closing_rank: d.closing_rank || null,
                seat_count: d.seat_count || d.total_seats || null,
                source_authority: d.source_authority || d.authority || 'N/A',
                year: year,
                hydration_confidence: d.hydration_confidence || 'N/A',
                lineage: d.lineage || 'hydrator'
            });
        });
    };

    console.log(" -> Fetching engineering cutoffs...");
    const engCutoffs = await db.collection('engineering_cutoffs').find({}).toArray();
    pushRows(engCutoffs, 'engineering', true);

    console.log(" -> Fetching medical cutoffs...");
    const medCutoffs = await db.collection('medicalcutoffs').find({}).toArray();
    pushRows(medCutoffs, 'medical', true);

    console.log(" -> Fetching engineering seats...");
    const engSeats = await db.collection('seat_matrix').find({}).toArray();
    pushRows(engSeats, 'engineering', false);

    console.log(" -> Fetching medical seats...");
    const medSeats = await db.collection('medicalseats').find({}).toArray();
    pushRows(medSeats, 'medical', false);

    const deepWS = XLSX.utils.json_to_sheet(deepRows);
    const deepWB = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(deepWB, deepWS, "Deep Truth");
    XLSX.writeFile(deepWB, path.join(exportDir, 'colleges_deep_truth.xlsx'));

    console.log(`\n✅ Export Complete.`);
    console.log(`📂 master: exports/colleges_master.xlsx (${masterRows.length} rows)`);
    console.log(`📂 deep: exports/colleges_deep_truth.xlsx (${deepRows.length} rows)`);

    process.exit(0);
}

runExport();
