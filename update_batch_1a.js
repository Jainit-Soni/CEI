const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'backend', 'models', 'Gujarat_Colleges.json');
const content = fs.readFileSync(filePath, 'utf8');
const colleges = JSON.parse(content);

const updates = {
    'charusat-changa': [
        {
            "examId": "gujcet",
            "year": "2025",
            "cutoff": "CE: 1500-2000 | IT: 2500-3000",
            "source": "Official"
        }
    ],
    'marwadi-uni-rajkot': [
        {
            "examId": "gujcet",
            "year": "2025",
            "cutoff": "CE: ~35061 | Cyber: ~30473",
            "source": "Official"
        },
        {
            "examId": "jee-main",
            "year": "2025",
            "cutoff": "Check official website",
            "source": "Official"
        }
    ],
    'parul-uni': [
        {
            "examId": "gujcet",
            "year": "2025",
            "cutoff": "CSE: ~12864-36987",
            "source": "Official"
        }
    ],
    'ganpat-uni': [
        {
            "examId": "gujcet",
            "year": "2025",
            "cutoff": "CE: ~30445 | IT: ~29400",
            "source": "Official"
        },
        {
            "examId": "jee-main",
            "year": "2025",
            "cutoff": "Check official website",
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
