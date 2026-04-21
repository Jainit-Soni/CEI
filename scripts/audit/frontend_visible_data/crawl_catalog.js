const axios = require('axios');
const fs = require('fs');
const path = require('path');

const API_BASE = "http://localhost:4000";

async function crawlCatalog() {
    console.log("[CRAWL] Resuming Catalog Crawl with VERY safe throttling (2.5s/req)...");
    let catalogIds = new Set();
    const idsPath = path.join(__dirname, 'catalog_ids.json');
    if (fs.existsSync(idsPath)) {
        catalogIds = new Set(JSON.parse(fs.readFileSync(idsPath, 'utf8')));
    }

    let page = Math.floor(catalogIds.size / 100) + 1;
    console.log(`[CRAWL] Resuming from page ${page}...`);
    
    let hasMore = true;

    while (hasMore) {
        try {
            const resp = await axios.get(`${API_BASE}/api/colleges`, {
                params: { page, limit: 100, sortBy: 'ceiScore' }
            });
            const data = resp.data.data || [];
            if (data.length === 0) {
                hasMore = false;
                break;
            }

            data.forEach(c => catalogIds.add(c.id || c._id));
            console.log(`[CRAWL] Page ${page}: Found ${data.length} items. Total unique: ${catalogIds.size}`);
            
            fs.writeFileSync(idsPath, JSON.stringify(Array.from(catalogIds), null, 2));

            if (data.length < 100) {
                hasMore = false;
            } else {
                page++;
                await new Promise(r => setTimeout(r, 2500));
            }
            if (page > 300) break;
        } catch (err) {
            console.error(`[CRAWL] Failed at page ${page}: ${err.message}`);
            if (err.response?.status === 429) {
                console.log("[CRAWL] Rate limited. Sleeping for 20s...");
                await new Promise(r => setTimeout(r, 20000));
            } else {
                hasMore = false;
            }
        }
    }

    console.log(`[CRAWL] Finished. Final count: ${catalogIds.size} catalog-visible IDs.`);
}

crawlCatalog();
