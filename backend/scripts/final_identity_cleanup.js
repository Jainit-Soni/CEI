const fs = require('fs');
const path = require('path');

const MAIN_REGISTRY_PATH = path.join(__dirname, '../data/truth/identity_registry.json');
const HISTORY_PATH = path.join(__dirname, '../data/truth/identity_registry_history.json');

function cleanup() {
    console.log('🧹 Performing final identity cleanup...');

    const mainRegistry = JSON.parse(fs.readFileSync(MAIN_REGISTRY_PATH, 'utf8'));
    const history = JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));

    // 1. Fix IIIT Allahabad vs IIT Kanpur alias collision
    if (mainRegistry['CORE-IIT-KANPUR']) {
        const wrongAlias = 'Indian Institute of Information Technology, Allahabad';
        const initialCount = mainRegistry['CORE-IIT-KANPUR'].aliases.length;
        mainRegistry['CORE-IIT-KANPUR'].aliases = mainRegistry['CORE-IIT-KANPUR'].aliases.filter(a => a !== wrongAlias);
        if (mainRegistry['CORE-IIT-KANPUR'].aliases.length < initialCount) {
            console.log('✅ Removed incorrect IIIT Allahabad alias from IIT Kanpur.');
        }
        
        // Also add state if missing
        if (!mainRegistry['CORE-IIT-KANPUR'].state) mainRegistry['CORE-IIT-KANPUR'].state = 'Uttar Pradesh';
    }

    // 2. Fix IIEST Shibpur duplicate
    const id1 = 'CORE-INDIAN-INSTITUTE-OF-ENGINEERING-SCIENCE-AND-TECHNOLOGY-SHIBPUR';
    const id2 = 'Indian Institute of Engineering Science and Technology, Shibpur';
    
    if (mainRegistry[id1] && mainRegistry[id2]) {
        console.log('✅ Merging IIEST Shibpur duplicates...');
        mainRegistry[id2].aliases = [
            ...(mainRegistry[id2].aliases || []),
            mainRegistry[id1].canonical_name,
            ...(mainRegistry[id1].aliases || [])
        ];
        mainRegistry[id2].aliases = [...new Set(mainRegistry[id2].aliases)];
        if (!mainRegistry[id2].state) mainRegistry[id2].state = 'West Bengal';
        delete mainRegistry[id1];
    }

    // 3. Add missing states for major IITs
    const statesMap = {
        'CORE-IIT-BOMBAY': 'Maharashtra',
        'CORE-IIT-DELHI': 'Delhi',
        'CORE-IIT-GUWAHATI': 'Assam',
        'CORE-IIT-HYDERABAD': 'Telangana',
        'CORE-IIT-MADRAS': 'Tamil Nadu',
        'CORE-IIT-ROORKEE': 'Uttarakhand'
    };

    for (const [id, state] of Object.entries(statesMap)) {
        if (mainRegistry[id] && !mainRegistry[id].state) {
            mainRegistry[id].state = state;
            console.log(`✅ Added state ${state} to ${id}`);
        }
    }

    fs.writeFileSync(MAIN_REGISTRY_PATH, JSON.stringify(mainRegistry, null, 2));
    
    console.log('✨ Cleanup complete.');
}

cleanup();
