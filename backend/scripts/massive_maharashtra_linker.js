const fs = require('fs');
const path = require('path');
const Fuse = require('fuse.js');

const MASTER_FILE = 'e:/CMAT-PROBLEM/backend/data/colleges.ndjson';
const RAW_FRA_FILE = 'C:/Users/Jainit Soni/.gemini/antigravity/brain/9fd727a5-7a0f-4a2d-ad93-7f5cd5a84563/.system_generated/steps/666/content.md';
const OUTPUT_FILE = 'e:/CMAT-PROBLEM/backend/data/truth/maharashtra_fra_2024_bulk.ndjson';

function cleanName(name) {
    if (!name) return "";
    return name.toLowerCase()
        .replace(/engineering/g, '')
        .replace(/technology/g, '')
        .replace(/technical/g, '')
        .replace(/institute/g, '')
        .replace(/college/g, '')
        .replace(/polytechnic/g, '')
        .replace(/shikshan/g, '')
        .replace(/mandal/g, '')
        .replace(/sanstha/g, '')
        .replace(/charitable/g, '')
        .replace(/trust/g, '')
        .replace(/society/g, '')
        .replace(/education/g, '')
        .replace(/research/g, '')
        .replace(/management/g, '')
        .replace(/established/g, '')
        .replace(/autonomous/g, '')
        .replace(/approved/g, '')
        .replace(/,/g, ' ')
        .replace(/\./g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

async function linkMaharashtra() {
    console.log("🚀 Loading Master Data...");
    const masterColleges = fs.readFileSync(MASTER_FILE, 'utf8')
        .split('\n')
        .filter(l => l.trim())
        .map(JSON.parse)
        .filter(c => c.state === 'Maharashtra');

    console.log(`📡 Found ${masterColleges.length} Maharashtra colleges in master.`);

    console.log("🚀 Loading FRA Raw Data...");
    const rawContent = fs.readFileSync(RAW_FRA_FILE, 'utf8');
    const jsonStart = rawContent.indexOf('[');
    const jsonEnd = rawContent.lastIndexOf(']') + 1;
    const fraData = JSON.parse(rawContent.substring(jsonStart, jsonEnd));
    console.log(`📡 Loaded ${fraData.length} FRA fee records.`);

    // Index master for fuzzy search
    const fuse = new Fuse(masterColleges, {
        keys: ['name'],
        threshold: 0.35,
        includeScore: true
    });

    const results = [];
    let matched = 0;

    for (const fraItem of fraData) {
        const query = fraItem.name;
        const searchResults = fuse.search(query);
        
        if (searchResults.length > 0) {
            const best = searchResults[0].item;
            const score = searchResults[0].score;

            if (score < 0.35) {
                matched++;
                results.push({
                    stableKey: best.stableKey,
                    name: best.name,
                    entityType: 'fee',
                    tuitionFee: parseInt(fraItem.tution_fees_fra || 0),
                    developmentFee: parseInt(fra_dev_fees_fra = fraItem.dev_fees_fra || 0),
                    totalFee: parseInt(fraItem.app_fees_fra || 0),
                    session: '2024-25',
                    source: 'MahaFRA Official Online Portal',
                    category: fraItem.status
                });
            }
        }
    }

    console.log(`✅ Matched ${matched}/${fraData.length} Maharashtra institutes.`);
    fs.writeFileSync(OUTPUT_FILE, results.map(r => JSON.stringify(r)).join('\n'));
    console.log(`💎 Bulk records saved to ${OUTPUT_FILE}`);
}

linkMaharashtra();
