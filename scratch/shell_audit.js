const fs = require('fs');
const path = require('path');
const identityResolver = require('../backend/lib/collegeIdentityResolver');

// Simulate the hydration pipeline to find spawned shells
const catalogPath = path.resolve(__dirname, '../backend/data/colleges_new.ndjson');
const truthDir = path.resolve(__dirname, '../backend/data/truth');

const catalog = fs.readFileSync(catalogPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const masterMap = new Map();

catalog.forEach(c => {
    const cid = identityResolver.resolveCanonicalId(c.id || c.stableKey || c.name);
    masterMap.set(String(cid), c);
});

const initialSize = masterMap.size;
const truthFiles = fs.readdirSync(truthDir).filter(f => f.endsWith('.ndjson'));

truthFiles.forEach(file => {
    const lines = fs.readFileSync(path.join(truthDir, file), 'utf8').split('\n').filter(Boolean).map(JSON.parse);
    lines.forEach(d => {
        const cid = identityResolver.resolveCanonicalId(d.collegeId || d.institutionName);
        if (cid && !masterMap.has(cid) && String(cid).startsWith('CORE-')) {
            masterMap.set(String(cid), { id: cid, name: cid, isShell: true });
        }
    });
});

const finalSize = masterMap.size;
const shells = Array.from(masterMap.values()).filter(c => c.isShell);

console.log(`Initial Catalog Size: ${initialSize}`);
console.log(`Final Hydrated Size: ${finalSize}`);
console.log(`Auto-spawned Shells: ${shells.length}`);
console.log('\n--- Sample Shells ---');
console.log(JSON.stringify(shells.slice(0, 5), null, 2));
