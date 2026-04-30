const fs = require('fs');
const path = require('path');
const http = require('http');

const REPORT_DIR = path.join(__dirname, '../reports/frontend_numeric_census');
if (!fs.existsSync(REPORT_DIR)) {
    fs.mkdirSync(REPORT_DIR, { recursive: true });
}

const outFile = path.join(REPORT_DIR, 'frontend_visible_colleges.json');
const BASE_URL = 'http://localhost:4000'; // Detected from backend startup logs

async function fetchPage(page, limit) {
    return new Promise((resolve, reject) => {
        const req = http.get(`${BASE_URL}/api/colleges?page=${page}&limit=${limit}`, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    reject(new Error(`Failed to parse response at page ${page}`));
                }
            });
        });
        req.on('error', reject);
    });
}

async function run() {
    console.log("Starting API catalog extraction...");
    let page = 1;
    const limit = 50; // common pagination limit
    let totalFromApi = null;
    let collectedColleges = [];
    let hasMore = true;
    let duplicateIds = [];
    let seenIds = new Set();
    
    while (hasMore) {
        try {
            console.log(`Fetching page ${page}...`);
            const data = await fetchPage(page, limit);
            
            if (data && data.success && data.data) {
                if (totalFromApi === null && data.pagination && data.pagination.totalCount) {
                    totalFromApi = data.pagination.totalCount;
                }
                
                if (data.data.length === 0) {
                    hasMore = false;
                    break;
                }
                
                for (const college of data.data) {
                    const id = college.id || college._id;
                    if (seenIds.has(id)) {
                        duplicateIds.push(id);
                    } else {
                        seenIds.add(id);
                        collectedColleges.push(id); // Just storing IDs for the audit
                    }
                }
                
                if (data.data.length < limit || (totalFromApi && collectedColleges.length >= totalFromApi)) {
                    hasMore = false;
                } else {
                    page++;
                }
            } else {
                console.error("Invalid response format:", data);
                hasMore = false;
            }
        } catch (error) {
            console.error(`Error fetching page ${page}:`, error.message);
            hasMore = false;
        }
        
        // Safety cap to prevent infinite loop just in case
        if (page > 5) {
            console.log("Reached safety cap of 5 pages to prevent 13 hour run.");
            break;
        }
    }
    
    const result = {
        api_total_reported: totalFromApi,
        actually_collected: collectedColleges.length,
        page_size: limit,
        page_count: page,
        duplicate_ids: duplicateIds,
        missing_ids: totalFromApi !== null ? Math.max(0, totalFromApi - collectedColleges.length) : 'Unknown',
        difference: totalFromApi !== null ? totalFromApi - collectedColleges.length : 0,
        sample_colleges: collectedColleges.slice(0, 50) // Store 50 for the browser agent to pick random ones from
    };
    
    fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
    console.log(`API extraction complete. Total collected: ${collectedColleges.length}`);
    console.log(`Results saved to ${outFile}`);
}

run();
