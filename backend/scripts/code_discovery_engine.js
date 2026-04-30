const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Paths
const IDENTITY_REGISTRY_PATH = path.join(__dirname, '../data/truth/identity_registry.json');
const CODE_REGISTRY_PATH = path.join(__dirname, '../data/truth/official_code_registry.json');
const WEBSITES_TRUTH_PATH = path.join(__dirname, '../data/truth/websites_truth.ndjson');
const AICTE_ICEBERG_PATH = path.join(__dirname, '../data/truth/aicte_iceberg_truth.ndjson');
const JOSAA_SEATS_PATH = path.join(__dirname, '../data/truth/josaa_seats.ndjson');
const DISCOVERY_CANDIDATES_PATH = path.join(__dirname, '../data/truth/code_discovery_candidates.json');

async function runDiscovery() {
    console.log('🚀 Starting Refined Code Discovery Engine...');

    // 1. Load Primary Registries
    const identityRegistry = JSON.parse(fs.readFileSync(IDENTITY_REGISTRY_PATH, 'utf8'));
    const codeRegistry = JSON.parse(fs.readFileSync(CODE_REGISTRY_PATH, 'utf8'));

    // Reverse maps
    const aisheToId = new Map(Object.entries(codeRegistry.aishe || {}).map(([k, v]) => [k, v]));
    const idToAishe = new Map(Object.entries(codeRegistry.aishe || {}).map(([k, v]) => [v, k]));

    // 2. Build Reference Maps
    console.log('📚 Building AISHE Reference Maps...');
    const aisheNames = new Map(); // code -> Set of names
    const aisheStates = new Map(); // code -> state

    // Load names from websites_truth
    const websiteStream = fs.createReadStream(WEBSITES_TRUTH_PATH);
    const rlWeb = readline.createInterface({ input: websiteStream, crlfDelay: Infinity });
    for await (const line of rlWeb) {
        if (!line.trim()) continue;
        const entry = JSON.parse(line);
        if (entry.id && entry.name) {
            if (!aisheNames.has(entry.id)) aisheNames.set(entry.id, new Set());
            aisheNames.get(entry.id).add(normalizeName(entry.name));
        }
    }

    // Load from iceberg (State)
    const icebergStream = fs.createReadStream(AICTE_ICEBERG_PATH);
    const rlIce = readline.createInterface({ input: icebergStream, crlfDelay: Infinity });
    for await (const line of rlIce) {
        if (!line.trim()) continue;
        const entry = JSON.parse(line);
        if (entry.collegeId && entry.state) {
            aisheStates.set(entry.collegeId, entry.state.toUpperCase());
        }
    }

    // Load from JoSAA Seats (Code + Name)
    console.log('📚 Loading JoSAA Seats for extra links...');
    const josaaAisheLinks = new Map(); // aishe -> name
    const josaaStream = fs.createReadStream(JOSAA_SEATS_PATH);
    const rlJos = readline.createInterface({ input: josaaStream, crlfDelay: Infinity });
    for await (const line of rlJos) {
        if (!line.trim() || line.startsWith('Created At')) continue;
        try {
            const entry = JSON.parse(line);
            if (entry.collegeId && entry.institutionName) {
                josaaAisheLinks.set(entry.collegeId, normalizeName(entry.institutionName));
            }
        } catch (e) {}
    }

    // 3. Build Lookup Table: normalized(name) + state -> code
    const lookupTable = new Map();
    const nameOnlyLookup = new Map(); // For high-confidence names only

    for (const [code, names] of aisheNames.entries()) {
        const state = aisheStates.get(code);
        for (const name of names) {
            if (state) {
                lookupTable.set(`${name}|${state}`, code);
            }
            // nameOnlyLookup is risky, only for long unique names
            if (name.length > 30) {
                if (!nameOnlyLookup.has(name)) nameOnlyLookup.set(name, []);
                nameOnlyLookup.get(name).push(code);
            }
        }
    }

    // Add JoSAA links to lookup
    for (const [code, name] of josaaAisheLinks.entries()) {
        const state = aisheStates.get(code);
        if (state) lookupTable.set(`${name}|${state}`, code);
        if (name.length > 20) {
            if (!nameOnlyLookup.has(name)) nameOnlyLookup.set(name, []);
            if (!nameOnlyLookup.get(name).includes(code)) nameOnlyLookup.get(name).push(code);
        }
    }

    // 4. Discovery Pass
    console.log('🔍 Scanning registry for missing codes...');
    const candidates = [];
    let matchCount = 0;

    for (const [id, data] of Object.entries(identityRegistry)) {
        if (idToAishe.has(id)) continue;

        const normName = normalizeName(data.canonical_name);
        const state = data.state ? data.state.toUpperCase() : '';
        const key = `${normName}|${state}`;

        let discoveredCode = null;
        let matchSource = '';

        if (lookupTable.has(key)) {
            discoveredCode = lookupTable.get(key);
            matchSource = 'aishe_geo_match';
        } else if (nameOnlyLookup.has(normName)) {
            const possibleCodes = nameOnlyLookup.get(normName);
            if (possibleCodes.length === 1) {
                discoveredCode = possibleCodes[0];
                matchSource = 'aishe_name_unique_match';
            }
        }

        if (discoveredCode) {
            // Safety check: collision
            const existingOwner = aisheToId.get(discoveredCode);
            if (existingOwner && existingOwner !== id) continue;

            candidates.push({
                institution_id: id,
                canonical_name: data.canonical_name,
                state: data.state,
                discovered_aishe_code: discoveredCode,
                confidence: matchSource === 'aishe_geo_match' ? 'HIGH' : 'MEDIUM',
                source: matchSource
            });
            matchCount++;
        }
    }

    console.log(`🎉 Discovery complete! Found ${matchCount} AISHE candidates.`);
    fs.writeFileSync(DISCOVERY_CANDIDATES_PATH, JSON.stringify(candidates, null, 2));
}

function normalizeName(name) {
    if (!name) return '';
    // Strip leading ID if present (e.g. 100007-)
    let clean = name.replace(/^\d+-/, '');
    return clean.toUpperCase()
        .replace(/[^A-Z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

runDiscovery().catch(console.error);
