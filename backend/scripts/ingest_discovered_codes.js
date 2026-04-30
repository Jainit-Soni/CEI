const fs = require('fs');
const path = require('path');

const CANDIDATES_PATH = path.join(__dirname, '../data/truth/code_discovery_candidates.json');
const MAIN_REGISTRY_PATH = path.join(__dirname, '../data/truth/identity_registry.json');
const CODE_REGISTRY_PATH = path.join(__dirname, '../data/truth/official_code_registry.json');
const HISTORY_PATH = path.join(__dirname, '../data/truth/identity_registry_history.json');

function ingestAndDedupe() {
    console.log('📥 Ingesting discovered codes with deduplication logic...');

    const candidates = JSON.parse(fs.readFileSync(CANDIDATES_PATH, 'utf8'));
    const mainRegistry = JSON.parse(fs.readFileSync(MAIN_REGISTRY_PATH, 'utf8'));
    const codeRegistry = JSON.parse(fs.readFileSync(CODE_REGISTRY_PATH, 'utf8'));
    const history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));

    let ingestedCount = 0;
    let mergedCount = 0;

    for (const cand of candidates) {
        const code = cand.discovered_aishe_code;
        const id = cand.institution_id;

        // If this ID doesn't exist in registry anymore (maybe merged earlier), skip
        if (!mainRegistry[id]) continue;

        // If this code is already mapped to a different ID
        const existingId = codeRegistry.aishe[code];
        if (existingId && existingId !== id) {
            if (!mainRegistry[existingId]) {
                // Orphaned code registry entry? Just overwrite.
                codeRegistry.aishe[code] = id;
            } else {
                // COLLISION! Merge id into existingId
                console.log(`💡 Collision detected: ${id} vs ${existingId} (Code: ${code}). Merging...`);
                
                mainRegistry[existingId].aliases = [
                    ...(mainRegistry[existingId].aliases || []),
                    mainRegistry[id].canonical_name,
                    ...(mainRegistry[id].aliases || [])
                ];
                mainRegistry[existingId].aliases = [...new Set(mainRegistry[existingId].aliases)];
                
                if (!mainRegistry[existingId].state && mainRegistry[id].state) {
                    mainRegistry[existingId].state = mainRegistry[id].state;
                }

                delete mainRegistry[id];
                
                history.push({
                    timestamp: new Date().toISOString(),
                    action: 'CODE_DEDUPE_INGEST',
                    institution_id: existingId,
                    details: `Merged duplicate ${id} discovered during code ingestion (AISHE: ${code})`
                });
                mergedCount++;
                continue;
            }
        }

        // Normal ingestion
        codeRegistry.aishe[code] = id;
        history.push({
            timestamp: new Date().toISOString(),
            action: 'DISCOVERY_INGEST',
            institution_id: id,
            details: `Discovered AISHE code ${code} (Confidence: ${cand.confidence})`
        });
        ingestedCount++;
    }

    fs.writeFileSync(MAIN_REGISTRY_PATH, JSON.stringify(mainRegistry, null, 2));
    fs.writeFileSync(CODE_REGISTRY_PATH, JSON.stringify(codeRegistry, null, 2));
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));

    console.log(`✅ Ingestion complete! Added: ${ingestedCount}, Merged: ${mergedCount}`);
}

ingestAndDedupe();
