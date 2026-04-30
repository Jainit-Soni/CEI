/**
 * aishe_master_ingestion.js — CEI AISHE Master Ingestion Pipeline
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const readline = require('readline');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const MASTER_FILE = path.join(__dirname, '../data/colleges_new.ndjson');

function normalizeName(name) {
    if (!name) return '';
    return name.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

function generateId(name) {
    if (!name) return 'CORE-UNKNOWN';
    const clean = name.toUpperCase()
        .replace(/[^A-Z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return `CORE-${clean}`;
}

async function run() {
    console.log('🚀 Initializing AISHE Master Ingestion...');
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
    const db = mongoose.connection.db;

    const countBefore = await db.collection('institutions').countDocuments({});
    console.log(`📊 Institutions before: ${countBefore.toLocaleString()}`);

    console.log('💾 Indexing existing institutions...');
    const existing = await db.collection('institutions').find({}, { projection: { institution_id: 1, name: 1, state: 1, aisheId: 1 } }).toArray();
    
    const existingIds = new Set();
    const existingAishe = new Set();
    const existingNameState = new Set();

    existing.forEach(inst => {
        if (inst.institution_id) existingIds.add(inst.institution_id);
        if (inst.aisheId) existingAishe.add(inst.aisheId);
        if (inst.institution_id && inst.institution_id.match(/^[CU]-\d+$/)) {
            existingAishe.add(inst.institution_id);
        }
        const nn = normalizeName(inst.name);
        const state = inst.state ? inst.state.toLowerCase() : 'unknown';
        existingNameState.add(`${nn}|${state}`);
    });

    const fileStream = fs.createReadStream(MASTER_FILE);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let processed = 0;
    let inserted = 0;
    let skippedDuplicate = 0;
    let skippedNonEngineering = 0;

    const engineeringTerms = /\b(engineering|technology|polytechnic|iit|nit|iiit|science\s+and\s+technology|technological)\b/i;

    const insertBatch = [];
    const BATCH_SIZE = 200;

    for await (const line of rl) {
        if (!line.trim()) continue;
        processed++;

        const record = JSON.parse(line);
        const name = record.name;
        const state = record.state;
        const aisheCode = record.aisheCode;

        if (!engineeringTerms.test(name)) {
            skippedNonEngineering++;
            continue;
        }

        const nn = normalizeName(name);
        const stateLow = state ? state.toLowerCase() : 'unknown';
        const nameStateKey = `${nn}|${stateLow}`;

        if (existingAishe.has(aisheCode) || existingNameState.has(nameStateKey)) {
            skippedDuplicate++;
            continue;
        }

        let instId = generateId(name);
        if (existingIds.has(instId)) {
            instId = `${instId}-${aisheCode}`;
        }

        const doc = {
            institution_id: instId,
            name: name,
            state: state,
            district: record.district || null,
            aisheId: aisheCode,
            stable_import_key: `AISHE||MASTER||${aisheCode}`,
            source: 'AISHE',
            source_authority: 'AISHE',
            ingested_at: new Date().toISOString(),
            status: 'active',
            isVisible: true,
            verificationStatus: 'verified',
            website: record.website || null,
            canonical_name: name.toUpperCase()
        };

        insertBatch.push(doc);
        existingIds.add(instId);
        existingAishe.add(aisheCode);
        existingNameState.add(nameStateKey);

        if (insertBatch.length >= BATCH_SIZE) {
            await db.collection('institutions').insertMany(insertBatch);
            inserted += insertBatch.length;
            insertBatch.length = 0;
            console.log(`   ... inserted ${inserted} institutions`);
        }
    }

    if (insertBatch.length > 0) {
        await db.collection('institutions').insertMany(insertBatch);
        inserted += insertBatch.length;
    }

    const countAfter = await db.collection('institutions').countDocuments({});
    
    console.log('\n==========================================');
    console.log(' AISHE MASTER INGESTION REPORT');
    console.log('==========================================');
    console.log(`Processed:               ${processed.toLocaleString()}`);
    console.log(`Inserted (Engineering):   ${inserted.toLocaleString()}`);
    console.log(`Skipped (Duplicate):      ${skippedDuplicate.toLocaleString()}`);
    console.log(`Skipped (Non-Eng):        ${skippedNonEngineering.toLocaleString()}`);
    console.log(`Total institutions now:  ${countAfter.toLocaleString()}`);
    console.log('==========================================\n');

    const states = await db.collection('institutions').aggregate([
        { $group: { _id: '$state', count: { $sum: 1 } } },
        { $sort: { count: -1 } }
    ]).toArray();

    console.log('--- NEW STATE DISTRIBUTION ---');
    states.slice(0, 15).forEach(s => {
        console.log(`  ${s._id || 'Unknown'}: ${s.count.toLocaleString()}`);
    });

    process.exit(0);
}

run().catch(console.error);
