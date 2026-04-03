const fs = require('fs');
const path = require('path');

const COLLEGES_FILE = path.join(__dirname, '..', 'data', 'colleges.ndjson');

const eliteData = [
  { "aisheCode": "U-0456", "name": "IIT Madras", "median": 1663440, "url": "https://www.nirfindia.org/nirfpdfcdn/2024/pdf/Overall/IR-O-U-0456.pdf" },
  { "aisheCode": "U-0220", "name": "IISc Bangalore", "median": 2250000, "url": "https://www.nirfindia.org/nirfpdfcdn/2024/pdf/Overall/IR-O-U-0220.pdf" },
  { "aisheCode": "I-1074", "name": "IIT Delhi", "median": 2000000, "url": "https://www.nirfindia.org/nirfpdfcdn/2024/pdf/Overall/IR-O-I-1074.pdf" },
  { "aisheCode": "U-0306", "name": "IIT Bombay", "median": 1792000, "url": "https://www.nirfindia.org/nirfpdfcdn/2024/pdf/Overall/IR-O-U-0306.pdf" },
  { "aisheCode": "I-1075", "name": "IIT Kanpur", "median": 1940000, "url": "https://www.nirfindia.org/nirfpdfcdn/2024/pdf/Overall/IR-O-I-1075.pdf" }
];

async function elitePlacementIngest() {
    console.log("🏆 Injecting TOP-5 ELITE Placement Benchmarks...");

    const lines = fs.readFileSync(COLLEGES_FILE, 'utf8').split('\n').filter(l => l.trim());
    const output = [];
    let hits = 0;

    for (const line of lines) {
        let college = JSON.parse(line);
        const elite = eliteData.find(e => e.aisheCode === college.aisheCode);

        if (elite) {
            hits++;
            college.placements = {
                averagePackageNumeric: elite.median,
                averagePackage: (elite.median / 100000).toFixed(2) + " LPA",
                source: "Official NIRF 2024 Institutional Report",
                sourceUrl: elite.url
            };
            college.dataConfidenceScore = 100; // Gold Standard
        }
        output.push(JSON.stringify(college));
    }

    fs.writeFileSync(COLLEGES_FILE, output.join('\n') + '\n');
    console.log(`✅ Successfully injected ${hits} elite benchmarks.`);
}

elitePlacementIngest().catch(console.error);
