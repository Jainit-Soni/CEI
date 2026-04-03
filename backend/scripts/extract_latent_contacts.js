const fs = require('fs');
const path = require('path');

const TRUTH_DIR = path.join(__dirname, '../data/truth');
const OUTPUT_FILE = path.join(TRUTH_DIR, 'latent_contacts_v1.ndjson');

const filesToScan = [
    'pan_india_bulk_2024.ndjson',
    'aicte_iceberg_truth.ndjson',
    'core_metadata_v2.ndjson'
];

const phoneRegex = /(?:PH\.|Phone|Mob\.?|Tel\.?)\s*([\d\-, ]{8,25})/i;
const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i;
const webRegex = /(?:www\.|https?:\/\/)([A-Za-z0-9_\-\.\/]+)/i;

const latentRecords = [];

filesToScan.forEach(file => {
    const filePath = path.join(TRUTH_DIR, file);
    if (!fs.existsSync(filePath)) return;

    console.log(`🔍 Scanning ${file}...`);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());

    lines.forEach(line => {
        try {
            const obj = JSON.parse(line);
            const sourceText = obj.name || obj.description || "";
            
            const phoneMatch = sourceText.match(phoneRegex);
            const emailMatch = sourceText.match(emailRegex);
            const webMatch = sourceText.match(webRegex);

            if (phoneMatch || emailMatch || webMatch) {
                const record = {
                    entityType: "latent_contact",
                    name: obj.name,
                    sourceFile: file,
                    stableKey: obj.stableKey || null
                };

                if (phoneMatch) record.phone = phoneMatch[1].trim().replace(/,$/, '');
                if (emailMatch) record.email = emailMatch[1].trim();
                if (webMatch) record.website = webMatch[1].trim().toLowerCase();

                latentRecords.push(record);
            }
        } catch (e) {}
    });
});

fs.writeFileSync(OUTPUT_FILE, latentRecords.map(r => JSON.stringify(r)).join('\n'));
console.log(`✅ Extracted ${latentRecords.length} latent contact records to ${OUTPUT_FILE}`);
