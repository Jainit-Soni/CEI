const fs = require('fs');
const path = require('path');

const TRUTH_DIR = path.join(__dirname, 'backend', 'data', 'truth');

function countFile(filename) {
    const fp = path.join(TRUTH_DIR, filename);
    if (!fs.existsSync(fp)) return 0;
    const content = fs.readFileSync(fp, 'utf8');
    return content.split('\n').filter(Boolean).length;
}

const stats = {
    totalColleges: countFile('../colleges.ndjson'),
    cutoffs: countFile('cutoffs_truth.ndjson'),
    seats: countFile('seats_truth.ndjson'),
    fees: countFile('fees_truth.ndjson'),
    placements: countFile('placements_truth.ndjson'),
    rankings: countFile('rankings_truth.ndjson'),
    courses: countFile('courses_truth.ndjson'),
    metadata: countFile('core_metadata_v2.ndjson'),
    nirf2024: countFile('core_rankings_nirf_v2.ndjson'),
    aicteIceberg: countFile('aicte_iceberg_truth.ndjson'),
    gujaratAcpc: countFile('gujarat_acpc_2025.ndjson'),
    websites: countFile('websites_truth.ndjson')
};

console.log('--- METADATA ANALYTICS ---');
console.log(JSON.stringify(stats, null, 2));
