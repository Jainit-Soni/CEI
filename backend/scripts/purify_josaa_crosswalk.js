/**
 * backend/scripts/purify_josaa_crosswalk.js
 * ========================================
 * Rebuilds josaa_institutes as a pure raw inventory from selects.json.
 * REMOVES all name-based inference and institution_id linking at this layer.
 */

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const RAW_SELECTS_PATH = 'e:\\CMAT-PROBLEM\\cei-extractors\\output\\raw\\josaa_2026-04-13T09-31-17-680Z\\josaa_admissions_nic_in__applicant__seatmatrix__seatmatrixinfo.aspx__selects.json';

async function purify() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;

        const collection = db.collection('josaa_institutes');
        
        // Drop and recreate for purity
        console.log('Dropping existing josaa_institutes...');
        try { await collection.drop(); } catch (e) {}
        
        await collection.createIndex({ josaa_code: 1 }, { unique: true });

        console.log('Reading JoSAA raw selects...');
        const selects = JSON.parse(fs.readFileSync(RAW_SELECTS_PATH, 'utf8'));
        const instituteSelect = selects.find(s => s.id.includes('ddlInstitute'));

        if (!instituteSelect) throw new Error('Could not find ddlInstitute in selects.json');

        const rawMappings = instituteSelect.options.filter(o => o.value !== '0');
        console.log(`Ingesting ${rawMappings.length} raw JoSAA records...`);

        const docs = rawMappings.map(m => ({
            josaa_code: m.value,
            institute_name_raw: m.text,
            source: 'JOSAA',
            verified: true,
            extracted_at: new Date('2026-04-13T09-31-17.680Z')
        }));

        await collection.insertMany(docs);
        console.log('✅ Purified josaa_institutes rebuilt.');

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

purify();
