const fs = require('fs');
const path = require('path');
const identityResolver = require('../backend/lib/collegeIdentityResolver');

const catalogPath = path.resolve(__dirname, '../backend/data/colleges_new.ndjson');
const josaaSummaryPath = 'cei-extractors/output/parsed/josaa_cei_package_2026-04-16T16-46-24-784Z/josaa_coverage_summary.json';

const catalog = fs.readFileSync(catalogPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const josaaSummary = JSON.parse(fs.readFileSync(josaaSummaryPath, 'utf8'));

const catalogMap = new Map();
catalog.forEach(c => {
    const cid = identityResolver.resolveCanonicalId(c.id || c.stableKey || c.name);
    catalogMap.set(cid, c);
});

const gaps = [];
josaaSummary.top_institutes_by_rows.forEach(inst => {
    const cid = identityResolver.resolveCanonicalId(inst.key);
    const resolved = catalogMap.get(cid);
    if (!resolved) {
        gaps.push({
            name: inst.key,
            cid: cid,
            count: inst.count
        });
    }
});

console.log(`Total JoSAA Institutions in Summary: ${josaaSummary.top_institutes_by_rows.length}`);
console.log(`Total Gaps: ${gaps.length}`);
console.log(JSON.stringify(gaps, null, 2));
