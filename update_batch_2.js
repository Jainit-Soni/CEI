const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'backend', 'models', 'Gujarat_Colleges.json');
const content = fs.readFileSync(filePath, 'utf8');
let colleges = JSON.parse(content);

const idsToDelete = [
    'indian-institute-of-technology-gandhinagar',
    'pandit-deendayal-energy-univer-gandhinagar',
    'sardar-vallabhbhai-national-in-surat',
    'national-institute-of-technolo-surat',
    'dhirubhai-ambani-institute-of--gandhinagar'
];

const initialCount = colleges.length;
colleges = colleges.filter(c => !idsToDelete.includes(c.id));
const deletedCount = initialCount - colleges.length;
console.log(`Deleted ${deletedCount} duplicate colleges.`);

const updates = {
    'scet-surat': [
        {
            "examId": "gujcet",
            "year": "2025",
            "cutoff": "CE: 4559 | IT: 6666 | AI: 7056 | EC: 12805",
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
