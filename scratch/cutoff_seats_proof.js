const path = require('path');
const fs = require('fs');

// Mocking required globals and services
global.colleges = [];
global.truthRows = [];
global.verifiedFields = [];

const dataStore = require('../backend/services/dataStore');
const identityResolver = require('../backend/lib/collegeIdentityResolver');

// Load Data
const catalogPath = path.resolve(__dirname, '../backend/data/colleges_new.ndjson');
const truthPath = path.resolve(__dirname, '../backend/data/truth/cutoffs_truth.ndjson');
const seatsPath = path.resolve(__dirname, '../backend/data/truth/seats_truth.ndjson');

global.colleges = fs.readFileSync(catalogPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const cutoffs = fs.readFileSync(truthPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const seats = fs.readFileSync(seatsPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse);

// Build map like dataStore does
const map = new Map();
global.colleges.forEach(c => map.set(c.id || c.stableKey, c));

// Hydrate like dataStore does
cutoffs.forEach(d => {
    const cid = d.collegeId;
    const c = map.get(cid);
    if (c) {
        if (!c.cutoffs) c.cutoffs = [];
        c.cutoffs.push(d);
    }
});
seats.forEach(d => {
    const cid = d.collegeId;
    const c = map.get(cid);
    if (c) {
        if (!c.seats) c.seats = [];
        c.seats.push(d);
    }
});

const collegesRouter = require('../backend/routes/colleges');
const routes = collegesRouter.stack.filter(r => r.route).map(r => ({ path: r.route.path, handler: r.route.stack[0].handle }));

async function test(id) {
    console.log(`\n--- Testing ${id} ---`);
    const req = { params: { id } };
    const res = { json: (d) => console.log(JSON.stringify(d, null, 2)) };

    console.log('SEATS:');
    const seatsRoute = routes.find(r => r.path === '/colleges/:id/truth/seats');
    await seatsRoute.handler(req, res);

    console.log('CUTOFFS:');
    const cutoffsRoute = routes.find(r => r.path === '/colleges/:id/truth/cutoffs');
    await cutoffsRoute.handler(req, res);
}

test('C-800');
