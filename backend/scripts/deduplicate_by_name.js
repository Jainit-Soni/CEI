const fs = require('fs');
const path = require('path');

const MAIN_REGISTRY_PATH = path.join(__dirname, '../data/truth/identity_registry.json');
const HISTORY_PATH = path.join(__dirname, '../data/truth/identity_registry_history.json');

function normalizeName(name) {
    if (!name) return '';
    let clean = name.replace(/^\d+-/, ''); // Strip AICTE prefixes
    return clean.toUpperCase()
        .replace(/[^A-Z0-9]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function deduplicate() {
    console.log('📝 Deduplicating by normalized name...');

    const mainRegistry = JSON.parse(fs.readFileSync(MAIN_REGISTRY_PATH, 'utf8'));
    const history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));

    const nameGroups = {}; // normalizedName|state -> list of IDs

    for (const [id, data] of Object.entries(mainRegistry)) {
        const norm = normalizeName(data.canonical_name);
        const state = (data.state || '').toUpperCase();
        const key = `${norm}|${state}`;

        if (!nameGroups[key]) nameGroups[key] = [];
        nameGroups[key].push(id);
    }

    let mergeCount = 0;
    for (const [key, ids] of Object.entries(nameGroups)) {
        if (ids.length > 1) {
            // Priority:
            // 1. Shortest ID (CORE-NIT-XXX vs CORE-NATIONAL-INSTITUTE-...)
            // 2. ID that doesn't look like a UUID
            const sortedIds = ids.sort((a, b) => {
                const aIsShort = a.length < 25;
                const bIsShort = b.length < 25;
                if (aIsShort && !bIsShort) return -1;
                if (!aIsShort && bIsShort) return 1;
                return a.length - b.length;
            });

            const targetId = sortedIds[0];
            const duplicates = sortedIds.slice(1);

            console.log(`💡 Merging ${duplicates.join(', ')} into ${targetId} (${key.split('|')[0]})`);

            for (const dupId of duplicates) {
                // Merge aliases
                mainRegistry[targetId].aliases = [
                    ...(mainRegistry[targetId].aliases || []),
                    mainRegistry[dupId].canonical_name,
                    ...(mainRegistry[dupId].aliases || [])
                ];
                mainRegistry[targetId].aliases = [...new Set(mainRegistry[targetId].aliases)];

                // Delete duplicate
                delete mainRegistry[dupId];

                history.push({
                    timestamp: new Date().toISOString(),
                    action: 'NAME_DEDUPE',
                    institution_id: targetId,
                    details: `Merged duplicate ${dupId} (Name collision in same state)`
                });

                mergeCount++;
            }
        }
    }

    fs.writeFileSync(MAIN_REGISTRY_PATH, JSON.stringify(mainRegistry, null, 2));
    fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));

    console.log(`✅ Deduplication complete! Merged ${mergeCount} institutions.`);
}

deduplicate();
