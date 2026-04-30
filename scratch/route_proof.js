const path = require('path');
const fs = require('fs');

// Mocking required globals and services
global.colleges = [];
global.truthRows = [];
global.verifiedFields = [];
global.sourceEvidence = [];

const dataStore = require('./backend/services/dataStore');
const identityResolver = require('./backend/lib/identityResolver');
const VerifiedField = require('./backend/models/VerifiedField');
const SourceEvidence = require('./backend/models/SourceEvidence');

// Load Data
console.log('--- LOADING DATA ---');
const catalogPath = path.resolve(__dirname, 'backend/data/colleges_new.ndjson');
const truthPath = path.resolve(__dirname, 'backend/data/truth/core_enrichment.ndjson');
const verifiedPath = path.resolve(__dirname, 'backend/data/verified/verified_fields.ndjson');
const evidencePath = path.resolve(__dirname, 'backend/data/verified/source_evidence.ndjson');

global.colleges = fs.readFileSync(catalogPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
global.truthRows = fs.readFileSync(truthPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
global.verifiedFields = fs.readFileSync(verifiedPath, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
global.sourceEvidence = fs.readFileSync(evidencePath, 'utf8').split('\n').filter(Boolean).map(JSON.parse);

console.log(`Loaded ${global.colleges.length} colleges, ${global.truthRows.length} truth rows, ${global.verifiedFields.length} verified fields.`);

// Mocking the router handlers
const collegesRouter = require('./backend/routes/colleges');
const routes = collegesRouter.stack.filter(r => r.route).map(r => ({ path: r.route.path, method: Object.keys(r.route.methods)[0], handler: r.route.stack[0].handle }));

async function testRoute(routePath, id) {
    const route = routes.find(r => r.path === routePath);
    if (!route) {
        console.log(`Route ${routePath} not found`);
        return;
    }

    const req = { params: { id }, query: {} };
    let responseData = null;
    const res = {
        json: (data) => { responseData = data; },
        status: (code) => ({ json: (data) => { responseData = { code, ...data }; } })
    };

    try {
        await route.handler(req, res);
        console.log(`[${routePath}] for ${id}:`, JSON.stringify(responseData, null, 2));
    } catch (e) {
        console.log(`[${routePath}] for ${id} FAILED:`, e.message);
    }
}

async function run() {
    const targets = ['U-0306', 'U-0467', 'C-63929'];
    const paths = [
        '/colleges/:id/truth/placements',
        '/colleges/:id/truth/fees',
        '/colleges/:id/truth/seats',
        '/colleges/:id/truth/cutoffs'
    ];

    for (const id of targets) {
        console.log(`\n=== TESTING INSTITUTION: ${id} ===`);
        for (const p of paths) {
            await testRoute(p, id);
        }
    }
}

run();
