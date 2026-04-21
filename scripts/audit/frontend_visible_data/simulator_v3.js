const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

// ABSOLUTE PATHS to ensure no require errors
const BACKEND_DIR = path.join(__dirname, '..', '..', '..', 'backend');
const LIB_DATASTORE_PATH = path.join(BACKEND_DIR, 'lib', 'dataStore');
const ENV_PATH = path.join(BACKEND_DIR, '.env.local');

require('dotenv').config({ path: ENV_PATH });

// ── Simulator v4 — CEI Frontend Truth-Bridge Engine ────────────────────

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DATABASE_NAME = 'cei_v2';

/**
 * findTruthForCollege(college, dataStore)
 * Mirrors the backend Truth-Bridge logic (Name-based + ID-based).
 */
function enrichWithTruth(c, dataStore) {
    const truthByCid = global.truthByCid || new Map();
    const truthByName = global.truthByName || new Map();
    
    const id = String(c.id || c._id || c.stableKey || "");
    const name = (c.institution_name || c.name || "").toLowerCase().replace(/[^a-z0-9]/g, '');

    const truthEntries = [];
    
    // 1. ID-based Bridge
    if (id && truthByCid.has(id)) truthEntries.push(...truthByCid.get(id));
    
    // 2. Name-based Bridge
    if (name && truthByName.has(name)) truthEntries.push(...truthByName.get(name));

    // 3. AICTE-ID Bridge (Specific for AICTE cohort)
    const aicteId = id.startsWith('aicte:') ? id.split(':')[1] : c.aicte_id;
    if (aicteId && truthByCid.has(aicteId)) truthEntries.push(...truthByCid.get(aicteId));

    // Enrich the object with truth potential
    const enriched = { ...c };
    if (!enriched.fees) enriched.fees = {};
    if (!enriched.placements) enriched.placements = {};
    if (!enriched.rankings) enriched.rankings = [];
    if (!enriched.courses) enriched.courses = [];

    truthEntries.forEach(tr => {
        if (tr.entityType === 'fees' || tr.medianSalary || tr.totalFee) enriched.fees.isVerified = true;
        if (tr.entityType === 'placement' || tr.averagePackage || tr.placedPercentage) enriched.placements.isVerified = true;
        if (tr.entityType === 'ranking') enriched.rankings.push(tr);
        if (tr.entityType === 'course') enriched.courses.push(tr);
    });

    return enriched;
}

function evaluateVisibility(rawCollege, dataStore) {
    const enriched = enrichWithTruth(rawCollege, dataStore);
    
    const name = enriched.institution_name || enriched.name;
    if (!name) return null;

    const metrics = {
        addressText: !!(enriched.address || enriched.location || enriched.district),
        addressLink: !!(name && (enriched.address || enriched.location || enriched.district)),
        websiteUrl: !!(enriched.website && enriched.website !== 'N/A' && enriched.website !== ''),
        nirfRanking: Array.isArray(enriched.rankings) && enriched.rankings.some(r => r.source?.toUpperCase().includes('NIRF')),
        courses: (Array.isArray(enriched.courses) && enriched.courses.length > 0) || !!enriched.course_details_ref,
        truthFees: enriched.fees.isVerified || enriched.fees.totalNumeric > 0,
        truthPlacements: enriched.placements.isVerified || enriched.placements.averagePackageNumeric > 0,
        truthSeats: (Array.isArray(enriched.courses) && enriched.courses.some(cr => cr.intake > 0)),
        truthCutoffs: !!(enriched.engineeringCutoffs && enriched.engineeringCutoffs.length > 0)
    };

    return metrics;
}

async function runSimulator() {
    console.log("[SIM] Initializing Simulation Engine v4.0 (Truth-Bridge)...");

    // 1. Data Sources
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DATABASE_NAME);
    const mongoDocs = await db.collection('institutions').find({}).toArray();
    await client.close();

    const dataStore = require(LIB_DATASTORE_PATH);
    await dataStore.loadDataFromNDJSON();
    const ndjsonDocs = global.colleges || [];

    // 2. Population Groups
    console.log(`[SIM] Catalog Cohort (Mongo): ${mongoDocs.length}`);
    console.log(`[SIM] Search Cohort (NDJSON): ${ndjsonDocs.length}`);

    const auditResults = {
        catalogVisible: { denominator: 0, counts: {}, samples: { positive: {}, negative: {} } },
        searchOnly: { denominator: 0, counts: {} }
    };

    const metricKeys = ['addressText', 'addressLink', 'websiteUrl', 'nirfRanking', 'courses', 'truthFees', 'truthPlacements', 'truthSeats', 'truthCutoffs'];
    metricKeys.forEach(m => {
        auditResults.catalogVisible.counts[m] = 0;
        auditResults.catalogVisible.samples.positive[m] = [];
        auditResults.catalogVisible.samples.negative[m] = [];
        auditResults.searchOnly.counts[m] = 0;
    });

    // 3. Process Catalog Cohort (Primary Denominator)
    const catalogIdsProcessed = new Set();
    mongoDocs.forEach(doc => {
        const visibility = evaluateVisibility(doc, dataStore);
        if (!visibility) return;

        auditResults.catalogVisible.denominator++;
        const id = String(doc.institution_id || doc.id || doc._id);
        catalogIdsProcessed.add(id);

        metricKeys.forEach(m => {
            if (visibility[m]) {
                auditResults.catalogVisible.counts[m]++;
                if (auditResults.catalogVisible.samples.positive[m].length < 10) auditResults.catalogVisible.samples.positive[m].push(id);
            } else {
                if (auditResults.catalogVisible.samples.negative[m].length < 10) auditResults.catalogVisible.samples.negative[m].push(id);
            }
        });
    });

    // 4. Process Search-Only Cohort
    ndjsonDocs.forEach(doc => {
        const id = String(doc.stableKey || doc.id || doc._id);
        if (catalogIdsProcessed.has(id)) return; // Already in Catalog

        const visibility = evaluateVisibility(doc, dataStore);
        if (!visibility) return;

        auditResults.searchOnly.denominator++;

        metricKeys.forEach(m => {
            if (visibility[m]) {
                auditResults.searchOnly.counts[m]++;
            }
        });
    });

    // 5. Export
    const outPath = path.join(__dirname, 'simulator_v4_results.json');
    fs.writeFileSync(outPath, JSON.stringify({
        summary: {
            catalogCount: auditResults.catalogVisible.denominator,
            searchOnlyCount: auditResults.searchOnly.denominator,
            totalPopulation: auditResults.catalogVisible.denominator + auditResults.searchOnly.denominator
        },
        report: auditResults
    }, null, 2));

    console.log(`[SIM] Final Audit Result: Catalog [${auditResults.catalogVisible.denominator}] | Search-Only [${auditResults.searchOnly.denominator}]`);
}

runSimulator().catch(err => {
    console.error("[SIM] FATAL:", err);
    process.exit(1);
});
