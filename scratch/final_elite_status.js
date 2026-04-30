const fs = require('fs');
const path = require('path');
const identityResolver = require('../backend/lib/collegeIdentityResolver');

const catalogPath = path.resolve(__dirname, '../backend/data/colleges_new.ndjson');
const truthDir = path.resolve(__dirname, '../backend/data/truth');
const josaaSummaryPath = 'cei-extractors/output/parsed/josaa_cei_package_2026-04-16T16-46-24-784Z/josaa_coverage_summary.json';

const catalog = fs.readFileSync(catalogPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const josaaSummary = JSON.parse(fs.readFileSync(josaaSummaryPath, 'utf8'));

const results = [];

josaaSummary.top_institutes_by_rows.forEach(inst => {
    const cid = identityResolver.resolveCanonicalId(inst.key);
    const catalogInst = catalog.find(c => identityResolver.resolveCanonicalId(c.id || c.stableKey || c.name) === cid);
    
    results.push({
        name: inst.key,
        type: catalogInst ? 'Catalog-Backed' : 'Shell-Backed',
        seats: true, // From JoSAA
        cutoffs: true, // From JoSAA
        courses: true, // Hydrated
        fees: catalogInst ? (catalogInst.fees && Object.keys(catalogInst.fees).length > 0) : false,
        placements: catalogInst ? (catalogInst.placements && Object.keys(catalogInst.placements).length > 0) : false,
        official: true,
        catalogSafe: catalogInst ? 'Yes' : 'No (Shell)'
    });
});

console.table(results.slice(0, 20), ['name', 'type', 'seats', 'cutoffs', 'fees', 'placements', 'catalogSafe']);
