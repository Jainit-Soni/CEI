const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function runSweep() {
    const masterPath = path.join(__dirname, '..', 'data', 'colleges.ndjson');
    const truthPath = path.join(__dirname, '..', 'data', 'truth', 'websites_truth.ndjson');
    const tempPath = `${masterPath}.tmp_websites`;

    console.log('🌐 Starting WEBSITE METADATA SWEEP...');

    // 1. Load Truth Registry into Map
    const websiteMap = new Map();
    const truthRl = readline.createInterface({ input: fs.createReadStream(truthPath), crlfDelay: Infinity });

    for await (const line of truthRl) {
        if (!line.trim()) continue;
        try {
            const entry = JSON.parse(line);
            if (entry.id && entry.website) {
                // Basic normalization: remove trailing slashes
                let url = entry.website.trim().replace(/\/+$/, '');
                // Ensure protocol
                if (!url.startsWith('http')) url = 'http://' + url;
                
                websiteMap.set(entry.id, url);
            }
        } catch (e) {}
    }
    console.log(`✅ Loaded ${websiteMap.size.toLocaleString()} verified URLs from registry.`);

    // 2. Stream Master and Apply Updates
    const writer = fs.createWriteStream(tempPath);
    const masterRl = readline.createInterface({ input: fs.createReadStream(masterPath), crlfDelay: Infinity });

    let updated = 0;
    let filled = 0;
    let totalProcessed = 0;
    let currentCoverage = 0;

    for await (const line of masterRl) {
        if (!line.trim()) { writer.write('\n'); continue; }
        totalProcessed++;
        try {
            const college = JSON.parse(line);
            const id = college.stableKey || college.aisheCode;
            
            if (id && websiteMap.has(id)) {
                const verifiedUrl = websiteMap.get(id);
                
                if (!college.website || college.website === 'N/A' || college.website.trim() === '') {
                    college.website = verifiedUrl;
                    college.sourceMetadata = college.sourceMetadata || {};
                    college.sourceMetadata.websiteVerified = true;
                    college.sourceMetadata.websiteSource = 'AISHE Registry Sync';
                    filled++;
                } else if (college.website !== verifiedUrl) {
                    // Update if we have a verified URL and the current one is different
                    // (Optional: only if current one doesn't have https)
                    if (!college.website.startsWith('https') && verifiedUrl.startsWith('https')) {
                        college.website = verifiedUrl;
                        updated++;
                    }
                }
            }
            
            if (college.website && college.website !== 'N/A' && college.website.trim() !== '') {
                currentCoverage++;
            }

            writer.write(JSON.stringify(college) + '\n');
        } catch (e) { writer.write(line + '\n'); }
    }

    writer.end();
    await new Promise(resolve => writer.on('finish', resolve));
    fs.renameSync(tempPath, masterPath);

    console.log('\n--- SWEEP COMPLETE ---');
    console.log(`Total Institutions Processed : ${totalProcessed.toLocaleString()}`);
    console.log(`New Gaps Filled (Injected)   : ${filled.toLocaleString()}`);
    console.log(`Existing URLs Updated (HTTPS): ${updated.toLocaleString()}`);
    console.log(`Final Website Coverage       : ${((currentCoverage/totalProcessed)*100).toFixed(1)}%`);
    console.log('------------------------\n');
}

runSweep().catch(console.error);
