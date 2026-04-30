const path = require('path');
const fs = require('fs');

// Mock globals
global.colleges = [];
global.truthRows = [];
global.verifiedFields = [];

const dataStore = require('../backend/services/dataStore');
const identityResolver = require('../backend/lib/collegeIdentityResolver');

// Load Data
const catalogPath = path.resolve(__dirname, '../backend/data/colleges_new.ndjson');
const josaaPath = path.resolve(__dirname, '../backend/data/truth/josaa_cutoffs.ndjson');

console.log('Loading Catalog...');
global.colleges = fs.readFileSync(catalogPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
console.log('Loading JoSAA Truth...');
const josaa = fs.readFileSync(josaaPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse);

// Build map using canonical IDs
const map = new Map();
global.colleges.forEach(c => {
    const cid = identityResolver.resolveCanonicalId(c.id || c.stableKey || c.name);
    map.set(String(cid), c);
});

// Hydrate (Simulate dataStore.applyTruthEnrichment)
console.log('Hydrating Truth...');
josaa.forEach(d => {
    // RESOLUTION STEP
    const cid = identityResolver.resolveCanonicalId(d.collegeId || d.institutionName);
    const c = map.get(cid);
    if (c) {
        if (!c.cutoffs) c.cutoffs = [];
        c.cutoffs.push(d);
    }
});

const collegesRouter = require('../backend/routes/colleges');
const routes = collegesRouter.stack.filter(r => r.route).map(r => ({ path: r.route.path, handler: r.route.stack[0].handle }));

async function test(id) {
    console.log(`\n--- Testing ${id} ---`);
    const req = { params: { id } };
    const res = { json: (d) => {
        console.log(`Status: ${d.sectionStatus}`);
        console.log(`Items: ${d.items ? d.items.length : 0}`);
        if (d.items && d.items.length > 0) {
            console.log(`Sample: ${d.items[0].displayLabel} -> ${d.items[0].value}`);
            console.log(`Source: ${d.items[0].source.title}`);
        }
    }};

    const cutoffsRoute = routes.find(r => r.path === '/colleges/:id/truth/cutoffs');
    await cutoffsRoute.handler(req, res);
}

// Target IDs
test('U-0306'); // IIT Bombay
test('U-0467'); // NIT Trichy
test('U-0146'); // IIIT Vadodara
