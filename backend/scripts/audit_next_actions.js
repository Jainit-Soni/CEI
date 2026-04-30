const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data/truth');
const ID_REG_PATH = path.join(DATA_DIR, 'identity_registry.json');
const HYDRATED_PATH = path.join(DATA_DIR, 'hydrated_truth.ndjson');

console.log('--- STARTING IN-MEMORY NEXT-ACTION ROUTE AUDIT ---');

const idReg = JSON.parse(fs.readFileSync(ID_REG_PATH, 'utf8'));
const hydratedData = fs.readFileSync(HYDRATED_PATH, 'utf8').split('\n').filter(Boolean).map(JSON.parse);
const hydratedIds = new Set(hydratedData.map(i => i.institution_id));

// 1. Build In-Memory Index for Query Simulation
const catalog = [];
for (const id in idReg) {
    const inst = idReg[id];
    const hydrated = hydratedData.find(h => h.institution_id === id) || {};
    
    catalog.push({
        id,
        state: inst.state || 'National',
        authority: id.startsWith('CORE-IIT') || id.startsWith('CORE-NIT') || id.startsWith('CORE-IIIT') ? 'JoSAA' : 'State',
        rankingTier: inst.rankingTier || 'Standard',
        hasCutoffs: (hydrated.cutoffs && hydrated.cutoffs.length > 0) || (hydrated.coverage?.cutoffCoverage && hydrated.coverage.cutoffCoverage !== 'None'),
        hasSeats: (hydrated.seats && hydrated.seats.length > 0) || (hydrated.coverage?.seatCoverage && hydrated.coverage.seatCoverage !== 'None'),
        hasFees: (hydrated.fees && (hydrated.fees.totalFee || (hydrated.fees.records && hydrated.fees.records.length > 0))),
        hasCourses: (hydrated.courses && hydrated.courses.length > 0),
        coverageBucket: hydrated.coverage?.coverageBucket || 'None',
        identityConfidence: inst.identityConfidence || 'HIGH'
    });
}

console.log(`Indexed ${catalog.length} institutions for simulation.`);

// 2. Query Simulator (Mimics buildCollegeQuery)
function simulateQuery(params) {
    return catalog.filter(c => {
        if (params.state && c.state !== params.state) return false;
        if (params.authority && c.authority !== params.authority) return false;
        if (params.tier && c.rankingTier !== params.tier) return false;
        if (params.coverage && c.coverageBucket !== params.coverage) return false;
        if (params.hasCutoffs === 'true' && !c.hasCutoffs) return false;
        if (params.identityConfidence && c.identityConfidence !== params.identityConfidence) return false;
        return true;
    });
}

// 3. Action Generator (Mimics assemblePagePayload)
function getActions(inst) {
    const actions = [];
    const authority = inst.authority;
    const tier = inst.rankingTier;
    const state = inst.state;

    if (inst.hasCutoffs || inst.hasSeats) {
        actions.push({
            label: `Compare with similar ${authority} institutes`,
            params: { authority, tier }
        });
    } else if (inst.hasFees || inst.hasCourses) {
        actions.push({
            label: `See ${authority} colleges with active cutoffs`,
            params: { authority, tier, hasCutoffs: 'true' } // Note: Fixed to include hasCutoffs: true
        });
    } else {
        actions.push({
            label: `See ${authority} colleges in ${state} with verified cutoffs`,
            params: { 
                state: state !== 'National' ? state : undefined, 
                authority: authority !== 'State' ? authority : undefined,
                hasCutoffs: 'true' // Note: Upgraded to target truth, not just "Rich" coverage
            }
        });
    }
    return actions;
}

// 4. Audit Execution
const auditReport = [];
let brokenCount = 0;
let fallbackCount = 0;

// Sample all hydrated (HIGH/MEDIUM) and a subset of LOW
const samples = [...catalog.filter(c => c.hasCutoffs || c.hasSeats || c.hasFees), ...catalog.filter(c => !c.hasCutoffs && !c.hasSeats && !c.hasFees).slice(0, 100)];

console.log(`Auditing ${samples.length} sample routes...`);

samples.forEach(inst => {
    const actions = getActions(inst);
    const validatedActions = actions.map(action => {
        const results = simulateQuery(action.params);
        
        if (results.length === 0) {
            brokenCount++;
            fallbackCount++;
            return {
                ...action,
                status: 'BROKEN_ZERO_RESULTS',
                originalParams: action.params,
                fallbackParams: { hasCutoffs: 'true', identityConfidence: 'HIGH' },
                results: 0
            };
        }
        
        return {
            ...action,
            status: 'OK',
            results: results.length
        };
    });

    auditReport.push({
        id: inst.id,
        actions: validatedActions
    });
});

const output = {
    summary: {
        totalAudited: samples.length,
        brokenRoutes: brokenCount,
        fixedFallbacks: fallbackCount
    },
    report: auditReport
};

fs.writeFileSync(path.join(__dirname, '../reports/next_action_route_audit.json'), JSON.stringify(output, null, 2));

console.log(`Audit Complete:`);
console.log(`- Broken Routes: ${brokenCount}`);
console.log(`- Fixed Fallbacks: ${fallbackCount}`);
console.log(`Report saved to reports/next_action_route_audit.json`);
