const path = require('path');
const fs = require('fs');

// Mock globals for dataStore/routes
global.colleges = [];
global.truthRows = [];
global.verifiedFields = [];

const dataStore = require('../backend/services/dataStore');
const identityResolver = require('../backend/lib/collegeIdentityResolver');

// Load Data (NDJSON)
const catalogPath = path.resolve(__dirname, '../backend/data/colleges_new.ndjson');
const cutoffPath = path.resolve(__dirname, '../backend/data/truth/cutoffs_truth.ndjson');
const seatPath = path.resolve(__dirname, '../backend/data/truth/seats_truth.ndjson');

global.colleges = fs.readFileSync(catalogPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const cutoffs = fs.readFileSync(cutoffPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const seats = fs.readFileSync(seatPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse);

// Build map
const map = new Map();
global.colleges.forEach(c => map.set(String(c.id || c.stableKey), c));

// Hydrate cutoffs/seats (Simulating dataStore.applyTruthEnrichment)
[...cutoffs, ...seats].forEach(d => {
    const cid = identityResolver.resolveCanonicalId(d.collegeId || d.name);
    const c = map.get(cid);
    if (c) {
        if (d.entityType === 'counsellingCutoff') {
            if (!c.cutoffs) c.cutoffs = [];
            c.cutoffs.push(d);
        } else if (d.entityType === 'counsellingSeatMatrix') {
            if (!c.seats) c.seats = [];
            c.seats.push(d);
        }
    }
});

const collegesRouter = require('../backend/routes/colleges');
const routes = collegesRouter.stack.filter(r => r.route).map(r => ({ path: r.route.path, handler: r.route.stack[0].handle }));

async function runProof() {
    const targets = ['C-800', 'U-0306', 'U-0467', 'S-2295', 'C-62494'];
    const paths = ['/colleges/:id/truth/seats', '/colleges/:id/truth/cutoffs'];

    for (const id of targets) {
        console.log(`\n==================================================`);
        console.log(`REQUEST: GET /api/colleges/${id}/truth/[seats|cutoffs]`);
        console.log(`==================================================`);
        
        for (const p of paths) {
            const route = routes.find(r => r.path === p);
            const req = { params: { id } };
            const res = {
                json: (data) => {
                    console.log(`\nPATH: ${p}`);
                    console.log(`STATUS: 200 OK`);
                    console.log(`sectionStatus: ${data.sectionStatus}`);
                    console.log(`itemCount: ${data.items ? data.items.length : 0}`);
                    if (data.items && data.items.length > 0) {
                        console.log(`SAMPLE ITEM:`, JSON.stringify(data.items[0], null, 2));
                    }
                }
            };
            await route.handler(req, res);
        }
    }
}

runProof();
