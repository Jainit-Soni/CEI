const fs = require('fs');
const path = require('path');
const readline = require('readline');

/**
 * Phase 22: AISHE Website Extractor
 * Parses all AISHE CSVs to extract official institutional websites.
 */
async function extractWebsites() {
    const csvFiles = [
        'aishe_colleges.csv',
        'aishe_university.csv',
        'aishe_standalone.csv'
    ];
    const outputPath = path.join(__dirname, '..', 'data', 'truth', 'websites_truth.ndjson');
    const outputStream = fs.createWriteStream(outputPath);
    let totalCount = 0;

    for (const fileName of csvFiles) {
        const csvPath = path.join(__dirname, '..', 'data', fileName);
        if (!fs.existsSync(csvPath)) {
            console.warn(`[Extractor] Warning: ${fileName} not found. Skipping.`);
            continue;
        }

        console.log(`[Extractor] Processing ${fileName}...`);
        const fileStream = fs.createReadStream(csvPath);
        const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

        let lineNum = 0;
        let fileCount = 0;

        for await (const line of rl) {
            lineNum++;
            if (lineNum <= 4) continue; // Skip headers

            // Robust CSV split that respects quotes
            const parts = line.match(/(".*?"|[^",\r\n]+)(?=\s*,|\s*$)/g);
            if (!parts || parts.length < 5) continue;

            const aisheCode = parts[0].trim().replace(/^"/, '').replace(/"$/, '');
            const name = parts[1].trim().replace(/^"/, '').replace(/"$/, '');
            let website = parts[4].trim().replace(/^"/, '').replace(/"$/, '');

            if (aisheCode && website && website !== 'Website' && website !== '-' && website.includes('.')) {
                if (!website.startsWith('http')) {
                    website = 'https://' + website;
                }

                const truthRow = {
                    id: aisheCode,
                    name: name,
                    entityType: 'website',
                    website: website,
                    source: 'AISHE Official Registry 2021-22',
                    verificationStatus: 'VERIFIED_REGISTRY'
                };

                outputStream.write(JSON.stringify(truthRow) + '\n');
                fileCount++;
                totalCount++;
            }
        }
        console.log(`[Extractor] Finished ${fileName}: found ${fileCount} websites.`);
    }

    outputStream.end();
    console.log(`\n✨ Universal Extraction Complete!`);
    console.log(`✅ Ingested ${totalCount} verified institutional websites.`);
}

extractWebsites();
