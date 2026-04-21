const fs = require('fs');
const path = require('path');

const VERIFIED_FIELDS_PATH = path.join(__dirname, '..', 'data', 'verified', 'verified_fields.ndjson');

const flagshipVerifications = [
    {
        collegeId: 'CORE-IIT-BOMBAY',
        fieldName: 'institutional_status',
        fieldValue: 'vetted',
        confidenceScore: 98,
        verificationStatus: 'verified',
        sourceCount: 12,
        lastVerifiedAt: new Date().toISOString()
    },
    {
        collegeId: 'CORE-ALL-INDIA-INSTITUTE-OF-MEDICAL-SCIENCES-NEW-DELHI',
        fieldName: 'institutional_status',
        fieldValue: 'vetted',
        confidenceScore: 99,
        verificationStatus: 'verified',
        sourceCount: 15,
        lastVerifiedAt: new Date().toISOString()
    }
];

function seed() {
    console.log('--- CEI Flagship Verification Seeder ---');
    
    if (!fs.existsSync(VERIFIED_FIELDS_PATH)) {
        console.log('Creating new verified_fields.ndjson...');
        fs.mkdirSync(path.dirname(VERIFIED_FIELDS_PATH), { recursive: true });
        fs.writeFileSync(VERIFIED_FIELDS_PATH, '');
    }

    const currentContent = fs.readFileSync(VERIFIED_FIELDS_PATH, 'utf8');
    
    let added = 0;
    for (const v of flagshipVerifications) {
        if (!currentContent.includes(v.collegeId)) {
            fs.appendFileSync(VERIFIED_FIELDS_PATH, JSON.stringify(v) + '\n');
            console.log(`+ Added: ${v.collegeId}`);
            added++;
        } else {
            console.log(`- Exists: ${v.collegeId}`);
        }
    }

    console.log(`Total Added: ${added}`);
}

seed();
