const path = require('path');
const fs = require('fs');

// Mock globals
global.colleges = [];
global.truthRows = [];

const dataStore = require('../backend/services/dataStore');
const identityResolver = require('../backend/lib/collegeIdentityResolver');

// Load Data
const catalogPath = path.resolve(__dirname, '../backend/data/colleges_new.ndjson');
const truthDir = path.resolve(__dirname, '../backend/data/truth');

console.log('Loading Catalog...');
global.colleges = fs.readFileSync(catalogPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse);

console.log('Loading All Truth...');
const files = fs.readdirSync(truthDir).filter(f => f.endsWith('.ndjson'));
files.forEach(file => {
    const lines = fs.readFileSync(path.join(truthDir, file), 'utf8').split('\n').filter(Boolean).map(JSON.parse);
    global.truthRows.push(...lines);
});
console.log(`Loaded ${global.truthRows.length} truth rows.`);

// Build map using canonical IDs
const map = new Map();
global.colleges.forEach(c => {
    const cid = identityResolver.resolveCanonicalId(c.id || c.stableKey || c.name);
    map.set(String(cid), c);
});

// Hydrate
console.log('Hydrating...');
global.truthRows.forEach(d => {
    const cid = identityResolver.resolveCanonicalId(d.collegeId || d.institutionName);
    const c = map.get(cid);
    if (c) {
        if (d.entityType === 'counsellingCutoff') {
            if (!c.cutoffs) c.cutoffs = [];
            c.cutoffs.push(d);
        } else if (d.entityType === 'counsellingSeat') {
            if (!c.seats) c.seats = [];
            c.seats.push(d);
        }
    }
});

const collegesRouter = require('../backend/routes/colleges');
const routes = collegesRouter.stack.filter(r => r.route).map(r => ({ path: r.route.path, handler: r.route.stack[0].handle }));

async function test(id) {
    console.log(`\n--- Testing ${id} ---`);
    const req = { params: { id } };
    
    // Test Seats
    const resSeats = { json: (d) => {
        console.log(`Seats Status: ${d.sectionStatus} (${d.items ? d.items.length : 0} items)`);
        if (d.items && d.items.length > 0) {
            console.log(`Sample Seat: ${d.items[0].displayLabel} -> ${d.items[0].value} (Source: ${d.items[0].source.title})`);
        }
    }};
    const seatsRoute = routes.find(r => r.path === '/colleges/:id/truth/seats');
    await seatsRoute.handler(req, resSeats);

    // Test Cutoffs
    const resCutoffs = { json: (d) => {
        console.log(`Cutoffs Status: ${d.sectionStatus} (${d.items ? d.items.length : 0} items)`);
        if (d.items && d.items.length > 0) {
            console.log(`Sample Cutoff: ${d.items[0].displayLabel} -> ${d.items[0].value} (Source: ${d.items[0].source.title})`);
        }
    }};
    const cutoffsRoute = routes.find(r => r.path === '/colleges/:id/truth/cutoffs');
    await cutoffsRoute.handler(req, resCutoffs);
}

// Target IDs
test('U-0306'); // IIT Bombay
test('U-0467'); // NIT Trichy
test('U-0146'); // IIIT Vadodara
test('U-0798'); // IIIT Vadodara (Batch 1 ID)
test('U-0456'); // NIT Jalandhar (Dr. B R Ambedkar)
