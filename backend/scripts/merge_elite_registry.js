const fs = require('fs');
const path = require('path');

const MAIN_REGISTRY_PATH = path.join(__dirname, '../data/truth/identity_registry.json');
const ELITE_REGISTRY_PATH = path.join(__dirname, '../data/truth/elite_identity_registry.json');
const CODE_REGISTRY_PATH = path.join(__dirname, '../data/truth/official_code_registry.json');
const HISTORY_PATH = path.join(__dirname, '../data/truth/identity_registry_history.json');

function mergeRegistries() {
    console.log('🔄 Performing Smart Merge of Elite Registry...');

    const mainRegistry = JSON.parse(fs.readFileSync(MAIN_REGISTRY_PATH, 'utf8'));
    const eliteRegistry = JSON.parse(fs.readFileSync(ELITE_REGISTRY_PATH, 'utf8'));
    const codeRegistry = JSON.parse(fs.readFileSync(CODE_REGISTRY_PATH, 'utf8'));
    const history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));

    let addedCount = 0;
    let mergedCount = 0;

    for (const elite of eliteRegistry) {
        const aishe = elite.aisheCode;
        const eliteId = elite.canonicalId;
        
        // Who currently owns this AISHE code in our registry?
        let targetId = null;
        if (aishe && codeRegistry.aishe[aishe]) {
            targetId = codeRegistry.aishe[aishe];
        } else if (mainRegistry[eliteId]) {
            targetId = eliteId;
        }

        if (targetId) {
            // MERGE into existing
            if (!mainRegistry[targetId]) {
                // This shouldn't happen if code registry is in sync
                mainRegistry[targetId] = { canonical_name: elite.displayName, aliases: [], state: elite.state || '' };
            }

            // Add as alias if different
            if (elite.displayName !== mainRegistry[targetId].canonical_name) {
                if (!mainRegistry[targetId].aliases.includes(elite.displayName)) {
                    mainRegistry[targetId].aliases.push(elite.displayName);
                }
            }
            
            // Sync AISHE if missing
            if (aishe && !codeRegistry.aishe[aishe]) {
                codeRegistry.aishe[aishe] = targetId;
            }

            mergedCount++;
        } else {
            // ADD new
            mainRegistry[eliteId] = {
                canonical_name: elite.displayName,
                aliases: [],
                state: elite.state || ''
            };
            if (aishe) codeRegistry.aishe[aishe] = eliteId;
            addedCount++;
        }
    }

    fs.writeFileSync(MAIN_REGISTRY_PATH, JSON.stringify(mainRegistry, null, 2));
    fs.writeFileSync(CODE_REGISTRY_PATH, JSON.stringify(codeRegistry, null, 2));
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));

    console.log(`✅ Smart Merge complete! Added: ${addedCount}, Merged: ${mergedCount}`);
}

mergeRegistries();
