const fs = require('fs');
const readline = require('readline');
const path = require('path');

/**
 * CEI UNIFIED TRUTH HYDRATION ENGINE (V3)
 * 
 * Formalized Identity Layer: Uses identity_master_index.json as the sole authority.
 * Eliminated parallel identity systems.
 */

const DATA_DIR = path.join(__dirname, '../data/truth');
const OUTPUT_FILE = path.join(DATA_DIR, 'hydrated_truth.ndjson');

// 1. Master Index Loading
const masterIndex = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'identity_master_index.json'), 'utf8'));

/**
 * Resolve CORE-ID from any supported code or identifier.
 */
function resolveCoreId(query) {
    const { aishe, josaa, aicte, name, institution_id } = query;

    // 1. Direct ID check (Highest priority)
    if (institution_id && masterIndex.institutions[institution_id]) return institution_id;

    // 2. Code resolution via index
    if (aishe && masterIndex.index.aishe[aishe]) return masterIndex.index.aishe[aishe];
    if (josaa && masterIndex.index.josaa[josaa]) return masterIndex.index.josaa[josaa];
    if (aicte && masterIndex.index.aicte[aicte]) return masterIndex.index.aicte[aicte];

    // 3. Name fallback (Controlled heuristic)
    if (name) {
        const normalize = (n) => n ? n.toLowerCase().replace(/[.,&()]/g, ' ').replace(/\s+/g, ' ').trim() : '';
        const norm = normalize(name);
        if (masterIndex.index.names[norm]) return masterIndex.index.names[norm];
    }

    return null;
}

const institutionalTruth = new Map();

function getOrCreate(coreId) {
    if (!institutionalTruth.has(coreId)) {
        institutionalTruth.set(coreId, {
            institution_id: coreId,
            seats: [],
            cutoffs: [],
            fees: [],
            placements: null,
            rankings: []
        });
    }
    return institutionalTruth.get(coreId);
}

async function processFile(filename, type, dataExtractor) {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) {
        console.warn(`[WARN] File not found: ${filename}`);
        return;
    }

    const rl = readline.createInterface({
        input: fs.createReadStream(filePath),
        crlfDelay: Infinity
    });

    let count = 0;
    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            const record = JSON.parse(line);
            const query = dataExtractor(record);
            const coreId = resolveCoreId(query);

            if (coreId) {
                const truth = getOrCreate(coreId);
                
                if (type === 'seat') truth.seats.push(record);
                else if (type === 'cutoff') truth.cutoffs.push(record);
                else if (type === 'fee') truth.fees.push(record);
                else if (type === 'placement') truth.placements = record;
                else if (type === 'ranking') truth.rankings.push(record);
                
                count++;
            }
        } catch (e) {
            // Skip malformed lines
        }
    }
    console.log(`[SUCCESS] ${filename}: Hydrated ${count} records`);
}

async function run() {
    console.log('--- STARTING UNIFIED TRUTH HYDRATION (V3) ---');

    // 1. JoSAA (Using AISHE codes in record)
    await processFile('josaa_seats.ndjson', 'seat', (r) => ({ aishe: r.collegeId }));
    await processFile('josaa_cutoffs.ndjson', 'cutoff', (r) => ({ aishe: r.collegeId }));

    // 2. CSAB (Using numerical codes in stableKey)
    await processFile('csab_seats.ndjson', 'seat', (r) => {
        const parts = r.stableKey.split('||');
        return { josaa: parts[1] };
    });
    await processFile('csab_cutoffs.ndjson', 'cutoff', (r) => {
        const parts = r.stableKey.split('||');
        // If it's a special round name, fallback to institutional name
        if (parts[1] === 'CSAB_SPECIAL') return { name: r.institutionName };
        return { josaa: parts[1] };
    });

    // 3. NIRF (Using pre-linked IDs)
    await processFile('nirf_code_linked.ndjson', 'placement', (r) => ({ institution_id: r.institution_id }));

    // 4. Gujarat ACPC (AICTE Link)
    await processFile('gujarat_acpc_2025.ndjson', 'cutoff', (r) => ({ aicte: r.institutionAicteId }));
    await processFile('gujarat_acpc_2025.ndjson', 'seat', (r) => ({ aicte: r.institutionAicteId }));

    // 5. TNEA Tamil Nadu (AISHE Link)
    await processFile('tamil_nadu_tnea_2024_bulk.ndjson', 'fee', (r) => {
        // TNEA uses AISHE code as stableKey in this version
        return { aishe: r.stableKey };
    });

    // 6. Rankings
    await processFile('engineering_rankings_2024.ndjson', 'ranking', (r) => ({ institution_id: r.institution_id }));

    // Write Output
    const writeStream = fs.createWriteStream(OUTPUT_FILE);
    for (const [coreId, data] of institutionalTruth) {
        // Attach basic identity metadata for easier debugging/rendering
        const meta = masterIndex.institutions[coreId];
        const enriched = {
            ...data,
            name: meta.canonical.name,
            location: `${meta.canonical.city}, ${meta.canonical.state}`
        };
        writeStream.write(JSON.stringify(enriched) + '\n');
    }
    writeStream.end();

    console.log(`--- HYDRATION COMPLETE: ${institutionalTruth.size} institutions hydrated ---`);
    console.log(`Output: ${OUTPUT_FILE}`);
}

run().catch(err => {
    console.error('Fatal Hydration Error:', err);
    process.exit(1);
});
