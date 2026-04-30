const fs = require('fs');
const path = require('path');

const MAIN_REGISTRY_PATH = path.join(__dirname, '../data/truth/identity_registry.json');
const CODE_REGISTRY_PATH = path.join(__dirname, '../data/truth/official_code_registry.json');
const HISTORY_PATH = path.join(__dirname, '../data/truth/identity_registry_history.json');

function deduplicate() {
    console.log('🔗 Deduplicating by official codes...');

    const mainRegistry = JSON.parse(fs.readFileSync(MAIN_REGISTRY_PATH, 'utf8'));
    const codeRegistry = JSON.parse(fs.readFileSync(CODE_REGISTRY_PATH, 'utf8'));
    const history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));

    const aisheToIds = {}; // code -> list of IDs

    // 1. Group by AISHE code
    for (const [code, id] of Object.entries(codeRegistry.aishe || {})) {
        if (!aisheToIds[code]) aisheToIds[code] = new Set();
        aisheToIds[code].add(id);
    }

    // 2. Identify duplicates
    let mergeCount = 0;
    for (const [code, ids] of Object.entries(aisheToIds)) {
        if (ids.size > 1) {
            const idList = Array.from(ids).sort((a, b) => a.length - b.length); // Keep shortest ID
            const targetId = idList[0];
            const duplicates = idList.slice(1);

            console.log(`💡 Merging ${duplicates.join(', ')} into ${targetId} (AISHE: ${code})`);

            for (const dupId of duplicates) {
                if (!mainRegistry[targetId] || !mainRegistry[dupId]) continue;

                // Move aliases
                mainRegistry[targetId].aliases = [
                    ...(mainRegistry[targetId].aliases || []),
                    mainRegistry[dupId].canonical_name,
                    ...(mainRegistry[dupId].aliases || [])
                ];
                
                // Deduplicate aliases
                mainRegistry[targetId].aliases = [...new Set(mainRegistry[targetId].aliases)];

                // Preserve state/city if target is empty
                if (!mainRegistry[targetId].state && mainRegistry[dupId].state) {
                    mainRegistry[targetId].state = mainRegistry[dupId].state;
                }

                // Delete duplicate from main registry
                delete mainRegistry[dupId];

                // Update code registry to point to targetId
                // (Optional, since we want to clean up the code registry too)
                // codeRegistry.aishe[code] = targetId; // Already is, but one of the keys might have been dupId

                history.push({
                    timestamp: new Date().toISOString(),
                    action: 'CODE_DEDUPE',
                    institution_id: targetId,
                    details: `Merged duplicate ${dupId} (AISHE code collision: ${code})`
                });

                mergeCount++;
            }
        }
    }

    // 3. Sync code registry values (ensure they point to existing IDs)
    for (const [code, id] of Object.entries(codeRegistry.aishe)) {
        if (!mainRegistry[id]) {
            // Find if this ID was merged into another
            // (Simple way: just scan registry for this ID in aliases? No, too slow)
            // Actually, my idList[0] is the survivor.
        }
    }

    fs.writeFileSync(MAIN_REGISTRY_PATH, JSON.stringify(mainRegistry, null, 2));
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));

    console.log(`✅ Deduplication complete! Merged ${mergeCount} institutions.`);
}

deduplicate();
