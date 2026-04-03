const fs = require('fs');
const path = require('path');
const csv = require('fs').readFileSync(path.join(__dirname, '..', 'data', 'aishe_university.csv'), 'utf8');

const COLLEGES_FILE = path.join(__dirname, '..', 'data', 'colleges.ndjson');

async function universityStatisticalSync() {
    console.log("🏫 Starting UNIVERSITY STATISTICAL SYNC (AISHE Master)...");

    const univMap = new Map();
    const rows = csv.split('\n');
    const headers = rows[0].split(',');
    
    // Header indices (Approximate based on AISHE typical CSV)
    const idIdx = headers.findIndex(h => h.includes('ID') || h.includes('Code'));
    const enrollIdx = headers.findIndex(h => h.includes('Enrolment') || h.includes('Student'));
    const facultyIdx = headers.findIndex(h => h.includes('Faculty') || h.includes('Teacher'));

    for (let i = 1; i < rows.length; i++) {
        const cols = rows[i].split(',');
        if (cols.length < 5) continue;
        
        const aid = cols[idIdx];
        if (!aid) continue;

        univMap.set(aid, {
            enrolment: parseInt(cols[enrollIdx]) || 0,
            faculty: parseInt(cols[facultyIdx]) || 0
        });
    }
    console.log(`📡 Loaded ${univMap.size} universities for statistical hydration.`);

    // 2. Update Datastore
    const collegesLines = fs.readFileSync(COLLEGES_FILE, 'utf8').split('\n').filter(l => l.trim());
    let matchCount = 0;
    const output = [];

    for (const line of collegesLines) {
        let college = JSON.parse(line);
        const aid = college.aisheCode;

        if (aid && univMap.has(aid)) {
            matchCount++;
            const stats = univMap.get(aid);
            
            college.meta = college.meta || {};
            if (stats.enrolment > 0) college.meta.totalStudentEnrolment = stats.enrolment;
            if (stats.faculty > 0) college.meta.totalFacultyCount = stats.faculty;
            
            if (stats.enrolment > 0 && stats.faculty > 0) {
                college.meta.studentTeacherRatio = (stats.enrolment / stats.faculty).toFixed(1);
            }

            college.dataConfidenceScore = Math.min((college.dataConfidenceScore || 20) + 10, 95);
        }
        output.push(JSON.stringify(college));
    }

    fs.writeFileSync(COLLEGES_FILE, output.join('\n') + '\n');
    console.log(`🎉 University Statistical Wave Finished! Hydrated ${matchCount} core universities.`);
}

universityStatisticalSync().catch(console.error);
