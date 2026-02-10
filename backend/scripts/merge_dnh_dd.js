const fs = require('fs');
const path = require('path');

const MODELS_DIR = path.join(__dirname, '..', 'models');
const FILE_DNH = path.join(MODELS_DIR, 'Dadra_and_Nagar_Haveli_Colleges.json');
const FILE_DD = path.join(MODELS_DIR, 'Daman_and_Diu_Colleges.json');
const FILE_NEW = path.join(MODELS_DIR, 'Dadra_and_Nagar_Haveli_and_Daman_and_Diu_Colleges.json');

function load(p) {
    if (!fs.existsSync(p)) return [];
    return JSON.parse(fs.readFileSync(p, 'utf8'));
}

const dnh = load(FILE_DNH);
const dd = load(FILE_DD);

console.log(`Loaded ${dnh.length} from DNH and ${dd.length} from DD`);

const merged = [...dnh, ...dd].map(c => ({
    ...c,
    state: "Dadra and Nagar Haveli and Daman and Diu",
    // Update location to ensure consistent formatting if needed, but 'state' field takes precedence in filter logic if present
    meta: {
        ...c.meta,
        state: "Dadra and Nagar Haveli and Daman and Diu"
    }
}));

fs.writeFileSync(FILE_NEW, JSON.stringify(merged, null, 2));
console.log(`Saved ${merged.length} to ${FILE_NEW}`);

// Delete old files
try {
    if (fs.existsSync(FILE_DNH)) fs.unlinkSync(FILE_DNH);
    if (fs.existsSync(FILE_DD)) fs.unlinkSync(FILE_DD);
    console.log("Deleted old split files.");
} catch (e) {
    console.error("Error deleting old files:", e);
}
