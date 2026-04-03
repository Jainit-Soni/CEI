const fs = require('fs');
const path = require('path');

const PLACEMENTS_FILE = 'e:\\CMAT-PROBLEM\\backend\\data\\truth\\placements_truth.ndjson';
const FEES_FILE = 'e:\\CMAT-PROBLEM\\backend\\data\\truth\\fees_truth.ndjson';
const RANKINGS_FILE = 'e:\\CMAT-PROBLEM\\backend\\data\\truth\\rankings_truth.ndjson';

const patchData = {
    "Indian Institute of Technology Bombay": {
        placement: { averagePackage: 2350000, highestPackage: 23000000, placedPercentage: 91, academicYear: "2023-24" },
        fee: { tuition: 200000, currency: "INR", period: "yearly" },
        ranking: { source: "NIRF", rank: 3, category: "Engineering", year: 2024 }
    },
    "Indian Institute of Technology Delhi": {
        placement: { averagePackage: 2050000, highestPackage: 36700000, placedPercentage: 89, academicYear: "2023-24" },
        fee: { tuition: 200000, currency: "INR", period: "yearly" },
        ranking: { source: "NIRF", rank: 2, category: "Engineering", year: 2024 }
    },
    "Indian Institute of Technology Madras": {
        placement: { averagePackage: 2148000, highestPackage: 28000000, placedPercentage: 85, academicYear: "2023-24" },
        fee: { tuition: 200000, currency: "INR", period: "yearly" },
        ranking: { source: "NIRF", rank: 1, category: "Engineering", year: 2024 }
    },
    "Indian Institute of Management Ahmedabad": {
        placement: { averagePackage: 3445000, highestPackage: 10800000, placedPercentage: 100, academicYear: "2023-24" },
        fee: { tuition: 1200000, currency: "INR", period: "yearly" },
        ranking: { source: "NIRF", rank: 1, category: "Management", year: 2024 }
    },
    "Indian Institute of Management Bangalore": {
        placement: { averagePackage: 3592000, highestPackage: 13000000, placedPercentage: 100, academicYear: "2023-24" },
        fee: { tuition: 1250000, currency: "INR", period: "yearly" },
        ranking: { source: "NIRF", rank: 2, category: "Management", year: 2024 }
    },
    "National Institute of Technology Tiruchirappalli": {
        placement: { averagePackage: 1560000, highestPackage: 5289000, placedPercentage: 85, academicYear: "2023-24" },
        fee: { tuition: 1250000, currency: "INR", period: "yearly" },
        ranking: { source: "NIRF", rank: 9, category: "Engineering", year: 2024 }
    },
    "Indian Institute of Information Technology Hyderabad": {
        placement: { averagePackage: 3396000, highestPackage: 10200000, placedPercentage: 85, academicYear: "2024-25" },
        fee: { tuition: 400000, currency: "INR", period: "yearly" },
        ranking: { source: "NIRF", rank: 15, category: "Engineering", year: 2024 }
    },
    "International Institute of Information Technology Bangalore": {
        placement: { averagePackage: 3701000, highestPackage: 8000000, placedPercentage: 83, academicYear: "2024-25" },
        fee: { tuition: 450000, currency: "INR", period: "yearly" },
        ranking: { source: "NIRF", rank: 74, category: "Engineering", year: 2024 }
    },
    "Indian Institute of Information Technology Allahabad": {
        placement: { averagePackage: 3300000, highestPackage: 10000000, placedPercentage: 82, academicYear: "2024-25" },
        fee: { tuition: 180000, currency: "INR", period: "yearly" },
        ranking: { source: "NIRF", rank: 89, category: "Engineering", year: 2024 }
    },
    "All India Institute of Medical Sciences New Delhi": {
        placement: { averagePackage: 1800000, highestPackage: 6000000, placedPercentage: 95, academicYear: "2023-24" },
        fee: { tuition: 1600, currency: "INR", period: "yearly" },
        ranking: { source: "NIRF", rank: 1, category: "Medical", year: 2024 }
    },
    "BITS Pilani": {
        placement: { averagePackage: 1950000, highestPackage: 11000000, placedPercentage: 94, academicYear: "2023-24" },
        fee: { tuition: 550000, currency: "INR", period: "yearly" },
        ranking: { source: "NIRF", rank: 24, category: "Engineering", year: 2024 }
    },
    "Vellore Institute of Technology": {
        placement: { averagePackage: 950000, highestPackage: 5500000, placedPercentage: 72, academicYear: "2023-24" },
        fee: { tuition: 198000, currency: "INR", period: "yearly" },
        ranking: { source: "NIRF", rank: 11, category: "Engineering", year: 2024 }
    }
};

function updateFile(filePath, type, dataMap) {
    if (!fs.existsSync(filePath)) {
        console.log(`File not found: ${filePath}, creating new.`);
        fs.writeFileSync(filePath, '');
    }

    const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(l => l.trim());
    const existingNames = new Set();
    const newLines = [];

    // Update existing or keep
    for (const line of lines) {
        const obj = JSON.parse(line);
        if (dataMap[obj.name] && dataMap[obj.name][type]) {
            const updated = { ...obj, ...dataMap[obj.name][type] };
            newLines.push(JSON.stringify(updated));
            existingNames.add(obj.name);
        } else {
            newLines.push(line);
        }
    }

    // Add new ones
    for (const [name, data] of Object.entries(dataMap)) {
        if (!existingNames.has(name) && data[type]) {
            newLines.push(JSON.stringify({ name, entityType: type, ...data[type] }));
        }
    }

    fs.writeFileSync(filePath, newLines.join('\n') + '\n');
    console.log(`Updated ${filePath} with ${Object.keys(dataMap).length} potential patches.`);
}

updateFile(PLACEMENTS_FILE, 'placement', patchData);
updateFile(FEES_FILE, 'fee', patchData);
updateFile(RANKINGS_FILE, 'ranking', patchData);
