const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: 'backend/.env.local' });

// ABSOLUTE PATHS
const BACKEND_DIR = path.join(__dirname, '..', '..', '..', 'backend');

async function runAudit() {
    console.log("[SIM] Booting Verification Audit (Phase 2)...");
    
    // 1. Fetch exactly the 13k AICTE Cohort
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db('cei_v2');
    const catalogDocs = await db.collection('institutions').find({}).toArray();
    await client.close();

    console.log(`[SIM] Baseline AICTE Catalog Size: ${catalogDocs.length}`);

    // BEFORE State (Raw Mongo)
    const beforeStats = { fees: 0, placements: 0, rankings: 0, courses: 0 };
    catalogDocs.forEach(c => {
        if (c.fees && Object.keys(c.fees).length > 0) beforeStats.fees++;
        if (c.placements && Object.keys(c.placements).length > 0) beforeStats.placements++;
        if (c.rankings && c.rankings.length > 0) beforeStats.rankings++;
        if (c.courses && c.courses.length > 0) beforeStats.courses++;
    });

    // 2. Load Truth Records manually like applyTruthEnrichment does
    const truthDir = path.join(BACKEND_DIR, "data", "truth");
    let externalTruthRecords = [];
    if (fs.existsSync(truthDir)) {
        const files = fs.readdirSync(truthDir).filter(f => f.endsWith('.ndjson'));
        files.forEach(file => {
            const rawTruthLines = fs.readFileSync(path.join(truthDir, file), "utf8").split('\n');
            rawTruthLines.forEach(line => {
                if (!line.trim()) return;
                try { externalTruthRecords.push(JSON.parse(line)); } catch {}
            });
        });
    }

    // 3. Build Identity Map
    const identityResolver = require(path.join(BACKEND_DIR, 'lib', 'collegeIdentityResolver.js'));
    const { identityMap, collisionReport } = identityResolver.buildIdentityMaps(catalogDocs, externalTruthRecords);

    const enrichedCollegesMap = new Map();
    catalogDocs.forEach(c => {
        // Deep clone basic object to pretend it's in memory cache
        const clone = JSON.parse(JSON.stringify(c));
        clone.fees = clone.fees || {};
        clone.placements = clone.placements || {};
        clone.rankings = clone.rankings || [];
        enrichedCollegesMap.set(String(c.institution_id || c.id || c._id), clone);
    });

    externalTruthRecords.forEach(d => {
        const canonicalId = identityResolver.resolveCanonicalId(d.collegeId || d.stableKey || d.id);
        let c = enrichedCollegesMap.get(canonicalId);
        if (!c) return;
        if (d.entityType === 'placement') {
            c.placements = { ...c.placements, averagePackage: `${d.averagePackage} ${d.currency}` };
        } else if (d.entityType === 'fees' || d.entityType === 'fee') {
            c.fees = { ...c.fees, total: `${d.totalFee || d.tuitionFee} ${d.currency || 'INR'}` };
        } else if (d.entityType === 'ranking') {
            c.rankings.push({ source: d.source });
        }
    });

    // AFTER State
    const afterStats = { fees: 0, placements: 0, rankings: 0, courses: 0 };
    Array.from(enrichedCollegesMap.values()).forEach(c => {
        if (c.fees && Object.keys(c.fees).length > 0) afterStats.fees++;
        if (c.placements && Object.keys(c.placements).length > 0) afterStats.placements++;
        if (c.rankings && c.rankings.length > 0) afterStats.rankings++;
        if (c.courses && c.courses.length > 0) afterStats.courses++;
    });

    // Print Report
    console.log(`\n=== Truth Attachment Audit (Catalog Visible: 13k) ===`);
    console.log(`Fees       : Before = ${beforeStats.fees} | After = ${afterStats.fees}`);
    console.log(`Placements : Before = ${beforeStats.placements} | After = ${afterStats.placements}`);
    console.log(`Rankings   : Before = ${beforeStats.rankings} | After = ${afterStats.rankings}`);
    console.log(`Courses    : Before = ${beforeStats.courses} | After = ${afterStats.courses}`);
    
    console.log(`\n=== Collision Report Summary ===`);
    console.log(`Resolved Deterministic : ${collisionReport.resolved}`);
    console.log(`Unresolved / Unmatched : ${collisionReport.unresolved}`);
    console.log(`Ambiguous Dropped      : ${collisionReport.ambiguous}`);
    
    fs.writeFileSync(path.join(__dirname, 'phase2_after_audit_output.txt'), "Before: " + JSON.stringify(beforeStats) + "\nAfter: " + JSON.stringify(afterStats) + "\nLog: " + JSON.stringify(collisionReport.log, null, 2));
}

runAudit().catch(e => {
    console.error(e);
    process.exit(1);
});
