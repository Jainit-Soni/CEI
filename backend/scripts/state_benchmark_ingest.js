const fs = require('fs');
const path = require('path');

const COLLEGES_FILE = path.join(__dirname, '..', 'data', 'colleges.ndjson');
const TRUTH_DIR = path.join(__dirname, '..', 'data', 'truth');

// Load state PTR benchmarks
const stats = fs.readFileSync(path.join(TRUTH_DIR, 'stats_truth.ndjson'), 'utf8')
    .split('\n').filter(Boolean).map(l => JSON.parse(l));

// Build state → PTR lookup
const statePTR = {};
stats.forEach(s => {
    const key = s.state.toLowerCase().trim();
    statePTR[key] = { ptr: s.ptr, enrollment: s.enrollment, year: s.academicYear };
});
console.log(`📡 Loaded ${Object.keys(statePTR).length} state PTR benchmarks`);

// Load latent contacts
const contactsPath = path.join(TRUTH_DIR, 'latent_contacts_v1.ndjson');
const contacts = fs.existsSync(contactsPath)
    ? fs.readFileSync(contactsPath, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l))
    : [];
const contactMap = {};
contacts.forEach(c => { if(c.stableKey) contactMap[c.stableKey] = c; });
console.log(`📡 Loaded ${contacts.length} latent contact records`);

const lines = fs.readFileSync(COLLEGES_FILE, 'utf8').split('\n').filter(Boolean);
const output = [];
let ptrCount = 0, contactCount = 0;

for (const line of lines) {
    let college;
    try { college = JSON.parse(line); } catch(e) { output.push(line); continue; }

    // 1. Attach state-level PTR benchmark
    const stateKey = (college.state || '').toLowerCase().trim();
    if (statePTR[stateKey] && !college.stateBenchmark) {
        college.stateBenchmark = {
            ptr: statePTR[stateKey].ptr,
            enrollment: statePTR[stateKey].enrollment,
            year: statePTR[stateKey].year,
            source: 'AISHE State Statistics 2021-22'
        };
        ptrCount++;
    }

    // 2. Hydrate phone/email from latent contacts
    if (contactMap[college.stableKey]) {
        const c = contactMap[college.stableKey];
        if (c.phone && !college.phone) { college.phone = c.phone; contactCount++; }
        if (c.email && !college.email) college.email = c.email;
        if (c.website && !college.website) college.website = c.website;
    }

    output.push(JSON.stringify(college));
}

fs.writeFileSync(COLLEGES_FILE, output.join('\n') + '\n');
console.log(`✅ PTR benchmarks attached to ${ptrCount} institutions`);
console.log(`✅ Contact details hydrated for ${contactCount} institutions`);
