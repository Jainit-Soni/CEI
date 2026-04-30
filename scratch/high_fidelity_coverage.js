const fs = require('fs');
const path = require('path');
const identityResolver = require('../backend/lib/collegeIdentityResolver');

const catalog = fs.readFileSync('backend/data/colleges_new.ndjson', 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const truthDir = 'backend/data/truth';
const truthFiles = fs.readdirSync(truthDir).filter(f => f.endsWith('.ndjson'));

const truthMap = new Map();
truthFiles.forEach(file => {
    const lines = fs.readFileSync(path.join(truthDir, file), 'utf8').split('\n').filter(Boolean);
    lines.forEach(l => {
        try {
            const d = JSON.parse(l);
            const cid = identityResolver.resolveCanonicalId(d.collegeId || d.name);
            if (!cid) return;
            if (!truthMap.has(cid)) truthMap.set(cid, []);
            truthMap.get(cid).push(d);
        } catch {}
    });
});

const results = ['placements', 'fees', 'courses', 'seats', 'cutoffs'].map(s => {
    let available = 0;
    catalog.forEach(c => {
        const cid = identityResolver.resolveCanonicalId(c.id || c.stableKey || c.name);
        const truths = truthMap.get(cid) || [];
        
        let hasData = false;
        if (s === 'placements') hasData = c.placements && c.placements.averagePackageNumeric > 0;
        else if (s === 'fees') hasData = c.fees && c.fees.totalNumeric > 0;
        else if (s === 'courses') hasData = c.courses && c.courses.length > 0;
        else if (s === 'seats') hasData = truths.some(t => t.entityType === 'counsellingSeatMatrix' || t.entityType === 'joinedInstitutionProgramTruth');
        else if (s === 'cutoffs') hasData = truths.some(t => t.entityType === 'counsellingCutoff' || t.entityType === 'joinedInstitutionProgramTruth');

        if (hasData) available++;
    });

    return {
        section: s,
        catalog_visible: catalog.length,
        available: available,
        method: 'Live Hybrid Bridge'
    };
});

console.table(results);
