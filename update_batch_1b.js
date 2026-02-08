const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'backend', 'models', 'Gujarat_Colleges.json');
const content = fs.readFileSync(filePath, 'utf8');
const colleges = JSON.parse(content);

const updates = {
    'silver-oak-uni': [
        {
            "examId": "gujcet",
            "year": "2025",
            "cutoff": "BE: 16742-50295 | IT: ~35000",
            "source": "Official"
        }
    ],
    'indus-uni-ahmedabad': [
        {
            "examId": "gujcet",
            "year": "2025",
            "cutoff": "CSE: ~18713 | IT: ~29299 | CE: ~20849",
            "source": "Official"
        }
    ],
    'gec-gandhinagar': [
        {
            "examId": "gujcet",
            "year": "2025",
            "cutoff": "CE: 4022 | IT: 4633 | EC: 10147 | Mech: ~14414",
            "source": "Official"
        }
    ]
    // Adani and SAL will be added here if found
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
