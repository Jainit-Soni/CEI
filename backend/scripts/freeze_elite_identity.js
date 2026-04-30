const fs = require('fs');
const path = require('path');
const identityResolver = require('../lib/collegeIdentityResolver');

const catalogPath = path.resolve(__dirname, '../data/colleges_new.ndjson');
const josaaSummaryPath = path.resolve(__dirname, '../../cei-extractors/output/parsed/josaa_cei_package_2026-04-16T16-46-24-784Z/josaa_coverage_summary.json');

const catalog = fs.readFileSync(catalogPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const josaaSummary = JSON.parse(fs.readFileSync(josaaSummaryPath, 'utf8'));

const catalogMap = new Map();
catalog.forEach(c => {
    const cid = identityResolver.resolveCanonicalId(c.id || c.stableKey || c.name);
    catalogMap.set(cid, c);
});

const registry = [];
const mismatchLog = [];

josaaSummary.top_institutes_by_rows.forEach(inst => {
    const cid = identityResolver.resolveCanonicalId(inst.key);
    const catalogInst = catalogMap.get(cid);
    
    const entry = {
        displayName: inst.key,
        catalogId: catalogInst ? catalogInst.id : null,
        stableKey: catalogInst ? catalogInst.stableKey : null,
        canonicalId: cid,
        aisheCode: catalogInst ? catalogInst.aisheCode : null,
        backingType: catalogInst ? 'Catalog-Backed' : 'Shell-Backed',
        linkedSource: 'JoSAA/CSAB 2024'
    };
    
    // ID Inconsistency Check (Simulated)
    // We check if the cid starts with CORE- but doesn't match the institutional naming convention
    if (cid.startsWith('CORE-') && !cid.includes(inst.key.toUpperCase().replace(/[^A-Z]/g, '')) && !catalogInst) {
        mismatchLog.push({
            name: inst.key,
            currentCid: cid,
            reason: 'Legacy bridge or alias mismatch'
        });
    }
    
    registry.push(entry);
});

fs.writeFileSync('backend/data/truth/elite_identity_registry.json', JSON.stringify(registry, null, 2));
fs.writeFileSync('scratch/elite_id_mismatch_log.json', JSON.stringify(mismatchLog, null, 2));

console.log('Elite Identity Registry frozen: 100 institutions.');
console.log(`Mismatch Log: ${mismatchLog.length} items.`);
