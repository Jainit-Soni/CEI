const fs = require('fs');
const path = require('path');

const registryPath = 'backend/data/truth/core_id_mapping_batch1.json';
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

const eMap = registry.engineering_map;

// Canonical Targets
const NORMALIZATION_RULES = {
    "CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-MUMBAI": "CORE-IIT-BOMBAY",
    "CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-CHENNAI": "CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-MADRAS",
    "CORE-IIT-MADRAS": "CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-MADRAS",
    "CORE-NIT-TRICHY": "CORE-NATIONAL-INSTITUTE-OF-TECHNOLOGY-TIRUCHIRAPALLI",
    "CORE-NATIONAL-INSTITUTE-OF-TECHNOLOGY-TIRUCHIRAPPALLI": "CORE-NATIONAL-INSTITUTE-OF-TECHNOLOGY-TIRUCHIRAPALLI",
    "CORE-NIT-SURATHKAL": "CORE-NATIONAL-INSTITUTE-OF-TECHNOLOGY-KARNATAKA",
    "CORE-MNIT-JAIPUR": "CORE-MALVIYA-NATIONAL-INSTITUTE-OF-TECHNOLOGY-JAIPUR",
    "CORE-IIEST-SHIBPUR": "CORE-INDIAN-INSTITUTE-OF-ENGINEERING-SCIENCE-AND-TECHNOLOGY-SHIBPUR",
    "CORE-BIT-MESRA": "CORE-BIRLA-INSTITUTE-OF-TECHNOLOGY-MESRA-RANCHI"
};

// Apply rules
Object.keys(eMap).forEach(alias => {
    const target = eMap[alias];
    if (NORMALIZATION_RULES[target]) {
        console.log(`Normalizing ${alias}: ${target} -> ${NORMALIZATION_RULES[target]}`);
        eMap[alias] = NORMALIZATION_RULES[target];
    }
});

// Add missing direct aliases found in Phase 104
eMap["Indian Institute of Technology Bombay"] = "CORE-IIT-BOMBAY";
eMap["Indian Institute of Technology Madras"] = "CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-MADRAS";
eMap["National Institute of Technology Karnataka, Surathkal"] = "CORE-NATIONAL-INSTITUTE-OF-TECHNOLOGY-KARNATAKA";
eMap["National Institute of Technology, Tiruchirappalli"] = "CORE-NATIONAL-INSTITUTE-OF-TECHNOLOGY-TIRUCHIRAPALLI";

registry.updatedAt = new Date().toISOString();
fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
console.log('Registry normalized and linkage collisions resolved.');
