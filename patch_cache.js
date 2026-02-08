const fs = require('fs');
const path = require('path');
const { saveCollege, getRedisClient } = require('./backend/services/dataStore');

// Define the IDs of the colleges we updated
const UPDATED_COLLEGE_IDS = [
    'nirma-uni',
    'pdeu-gandhinagar',
    'da-iict',
    'au-ahmedabad',
    'ldce-ahmedabad',
    'iit-gandhinagar',
    'msu-baroda',
    'svnit-surat',
    'bvm-anand',
    'ddu-nadiad',
    'vgec-chandkheda',
    'charusat-changa',
    'parul-uni',
    'ganpat-uni',
    'marwadi-uni-rajkot',
    'silver-oak-uni',
    'indus-uni-ahmedabad',
    'gec-bhavnagar',
    'gec-rajkot',
    'gec-surat',
    'scet-surat',
    'au-ahmedabad',
    'st-xaviers-ahmedabad'
];

const COL_FILE = path.join(__dirname, 'backend', 'models', 'Gujarat_Colleges.json');

async function patchCache() {
    try {
        console.log("Reading updated Gujarat_Colleges.json...");
        const raw = fs.readFileSync(COL_FILE, 'utf8');
        const colleges = JSON.parse(raw);

        console.log(`Found ${colleges.length} colleges in file.`);

        for (const id of UPDATED_COLLEGE_IDS) {
            const college = colleges.find(c => c.id === id);
            if (college) {
                console.log(`Patching cache for: ${college.name} (${id})...`);
                await saveCollege(college);
                console.log(`  > Success.`);
            } else {
                console.error(`  > ERROR: College ${id} not found in file.`);
            }
        }

        console.log("-----------------------------------");
        console.log("Cache patch complete. Changes should be live.");
        process.exit(0);

    } catch (err) {
        console.error("Patch failed:", err);
        process.exit(1);
    }
}

patchCache();
