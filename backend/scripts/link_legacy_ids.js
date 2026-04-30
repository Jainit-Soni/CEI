const fs = require('fs');
const path = require('path');

const registryPath = 'backend/data/truth/core_id_mapping_batch1.json';
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

const eMap = registry.engineering_map;

const LEGACY_ID_MAP = {
    "CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-MUMBAI": "CORE-IIT-BOMBAY",
    "CORE-INDIANINSTITUTEOFTECHNOLOGYDELHI": "CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-DELHI",
    "CORE-INDIANINSTITUTEOFTECHNOLOGYMADRAS": "CORE-INDIAN-INSTITUTE-OF-TECHNOLOGY-MADRAS",
    "CORE-NATIONAL-INSTITUTE-OF-TECHNOLOGY-TIRUCHIRAPPALLI": "CORE-NATIONAL-INSTITUTE-OF-TECHNOLOGY-TIRUCHIRAPALLI"
};

Object.assign(eMap, LEGACY_ID_MAP);

registry.updatedAt = new Date().toISOString();
fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
console.log('Legacy CORE IDs linked to canonical catalog nodes.');
