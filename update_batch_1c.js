const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'backend', 'models', 'Gujarat_Colleges.json');
const content = fs.readFileSync(filePath, 'utf8');
const colleges = JSON.parse(content);

const updates = {
    'gec-bhavnagar': [
        {
            "examId": "gujcet",
            "year": "2025",
            "cutoff": "CE: ~6635 | IT: ~12891 | Mech: ~34413 | EC: ~36372",
            "source": "Official"
        }
    ],
    'gec-rajkot': [
        {
            "examId": "gujcet",
            "year": "2025",
            "cutoff": "CE: ~8543 | AI: ~10500 | EC: ~20413 | Mech: ~20923",
            "source": "Official"
        }
    ],
    'gec-surat': [
        {
            "examId": "gujcet",
            "year": "2025",
            "cutoff": "CE: ~4207 | EC: ~13256 | Mech: ~20950 | Elec: ~24164",
            "source": "Official"
        }
    ]
};

let updatedCount = 0;

colleges.forEach(col => {
    if (updates[col.id]) {
        console.log(`Updating ${col.name} (${col.id})...`);
        col.pastCutoffs = updates[col.id];
        updatedCount++;
    }
});

fs.writeFileSync(filePath, JSON.stringify(colleges, null, 2), 'utf8');
console.log(`Updated ${updatedCount} colleges. Saved to ${filePath}`);
