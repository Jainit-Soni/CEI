
const path = require('path');
const fs = require('fs');

const TRUTH_DIR = path.join(__dirname, '..', 'data', 'truth');
const coreMapping = JSON.parse(fs.readFileSync(path.join(TRUTH_DIR, 'core_id_mapping_batch1.json'), 'utf8'));
const engineeringMap = coreMapping.engineering_map || {};

const targetColleges = [
    { id: 'CORE-IIT-BOMBAY', name: 'Indian Institute of Technology Bombay' },
    { id: 'CORE-AIIMS-DELHI', name: 'All India Institute of Medical Sciences Delhi' },
    { id: 'S-14324', name: 'Aditya College of Engineering' },
    { id: 'S-2295', name: 'Central Institute of Petrochemicals Engineering & Technology' }
];

function dumpData() {
    const truthFiles = fs.readdirSync(TRUTH_DIR).filter(f => f.endsWith('.ndjson'));
    const results = {};

    targetColleges.forEach(col => {
        results[col.id] = {
            name: col.name,
            placements: [],
            fees: [],
            courses: [],
            seats: [],
            cutoffs: [],
            rankings: []
        };

        const ids = new Set([col.id]);
        for (const [key, val] of Object.entries(engineeringMap)) {
            if (val === col.id || key === col.id || (col.name && key.toLowerCase() === col.name.toLowerCase())) {
                ids.add(key);
                ids.add(val);
            }
        }

        truthFiles.forEach(file => {
            const content = fs.readFileSync(path.join(TRUTH_DIR, file), 'utf8');
            content.split('\n').filter(Boolean).forEach(line => {
                try {
                    const d = JSON.parse(line);
                    const match = ids.has(d.collegeId) || ids.has(d.institutionId) || (d.name && col.name && d.name.toLowerCase().includes(col.name.toLowerCase()));
                    if (match) {
                        if (d.entityType === 'placement') results[col.id].placements.push(d);
                        else if (d.entityType === 'fees' || d.entityType === 'fee') results[col.id].fees.push(d);
                        else if (d.entityType === 'ranking') results[col.id].rankings.push(d);
                        else if (d.entityType === 'program' || d.entityType === 'course') results[col.id].courses.push(d);
                        else if (d.entityType === 'counsellingCutoff') results[col.id].cutoffs.push(d);
                        else if (d.entityType === 'counsellingSeatMatrix') results[col.id].seats.push(d);
                    }
                } catch {}
            });
        });
    });

    fs.writeFileSync('college_data_dump.json', JSON.stringify(results, null, 2));
    console.log("Data dump completed to college_data_dump.json");
}

dumpData();
