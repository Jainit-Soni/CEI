const fs = require('fs');
const path = require('path');
const identityResolver = require('../backend/lib/collegeIdentityResolver');

const catalogPath = path.resolve(__dirname, '../backend/data/colleges_new.ndjson');
const truthDir = path.resolve(__dirname, '../backend/data/truth');

const catalog = fs.readFileSync(catalogPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const map = new Map();
catalog.forEach(c => {
    const cid = identityResolver.resolveCanonicalId(c.id || c.stableKey || c.name);
    if (!map.has(cid)) map.set(cid, { seats: 0, cutoffs: 0, official: false });
});

const files = fs.readdirSync(truthDir).filter(f => f.endsWith('.ndjson'));
let totalSeatRows = 0;
let totalCutoffRows = 0;

files.forEach(file => {
    const lines = fs.readFileSync(path.join(truthDir, file), 'utf8').split('\n').filter(Boolean).map(JSON.parse);
    lines.forEach(d => {
        const cid = identityResolver.resolveCanonicalId(d.collegeId || d.institutionName);
        const stats = map.get(cid);
        if (stats) {
            if (d.entityType === 'counsellingSeat') {
                stats.seats++;
                totalSeatRows++;
            } else if (d.entityType === 'counsellingCutoff') {
                stats.cutoffs++;
                totalCutoffRows++;
            }
            if (d.officialityLevel === 'official') stats.official = true;
        }
    });
});

const seatInsts = Array.from(map.values()).filter(s => s.seats > 0).length;
const cutoffInsts = Array.from(map.values()).filter(s => s.cutoffs > 0).length;
const officialInsts = Array.from(map.values()).filter(s => s.official).length;

console.log(`1. Institutions with seats: ${seatInsts}`);
console.log(`2. Total seat rows: ${totalSeatRows}`);
console.log(`3. Institutions with cutoffs: ${cutoffInsts}`);
console.log(`4. Total cutoff rows: ${totalCutoffRows}`);
console.log(`- Official-verified institutions: ${officialInsts}`);
console.log(`- Official-verified rows: ${totalSeatRows + totalCutoffRows}`);
