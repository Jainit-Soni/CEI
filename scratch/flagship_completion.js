const fs = require('fs');
const path = require('path');
const identityResolver = require('../backend/lib/collegeIdentityResolver');

const catalogPath = path.resolve(__dirname, '../backend/data/colleges_new.ndjson');
const truthDir = path.resolve(__dirname, '../backend/data/truth');
const josaaSummaryPath = 'cei-extractors/output/parsed/josaa_cei_package_2026-04-16T16-46-24-784Z/josaa_coverage_summary.json';

const catalog = fs.readFileSync(catalogPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const josaaSummary = JSON.parse(fs.readFileSync(josaaSummaryPath, 'utf8'));

const map = new Map();
// Denominator: 128 JoSAA flagship institutions
josaaSummary.top_institutes_by_rows.forEach(inst => {
    const cid = identityResolver.resolveCanonicalId(inst.key);
    const catalogInst = catalog.find(c => identityResolver.resolveCanonicalId(c.id || c.stableKey || c.name) === cid);
    
    map.set(cid, { 
        name: inst.key,
        catalogFound: !!catalogInst,
        placements: catalogInst ? (catalogInst.placements && Object.keys(catalogInst.placements).length > 0) : false,
        fees: catalogInst ? (catalogInst.fees && Object.keys(catalogInst.fees).length > 0) : false,
        courses: catalogInst ? (catalogInst.courses || []) : [],
        seats: 0,
        cutoffs: 0,
        official: false
    });
});

const files = fs.readdirSync(truthDir).filter(f => f.endsWith('.ndjson'));
files.forEach(file => {
    const lines = fs.readFileSync(path.join(truthDir, file), 'utf8').split('\n').filter(Boolean).map(JSON.parse);
    lines.forEach(d => {
        const cid = identityResolver.resolveCanonicalId(d.collegeId || d.institutionName);
        const stats = map.get(cid);
        if (stats) {
            if (d.entityType === 'counsellingSeat' || d.entityType === 'counsellingSeatMatrix') {
                stats.seats++;
                // Simulate new hydration logic
                const courseName = d.programName || d.courseName;
                if (courseName && !stats.courses.some(c => c.name === courseName)) {
                    stats.courses.push({ name: courseName });
                }
            } else if (d.entityType === 'counsellingCutoff') {
                stats.cutoffs++;
            }
            if (d.officialityLevel === 'official') stats.official = true;
        }
    });
});

const results = Array.from(map.values());
const metrics = {
    denominator: results.length,
    catalog_found: results.filter(r => r.catalogFound).length,
    placements: results.filter(r => r.placements).length,
    fees: results.filter(r => r.fees).length,
    courses_fully_hydrated: results.filter(r => r.courses.length > 5).length,
    seats: results.filter(r => r.seats > 0).length,
    cutoffs: results.filter(r => r.cutoffs > 0).length,
    official_verified: results.filter(r => r.official).length
};

console.log(JSON.stringify(metrics, null, 2));

// Show first 5 partials
const partials = results.filter(r => !r.seats || !r.cutoffs).slice(0, 5);
if (partials.length > 0) {
    console.log('\n--- Sample Partial/Missing ---');
    console.log(JSON.stringify(partials.map(p => ({ name: p.name, seats: p.seats, cutoffs: p.cutoffs })), null, 2));
}
