const fs = require('fs');
const path = require('path');
const readline = require('readline');

const COLLEGES_FILE = path.join(__dirname, '..', 'data', 'colleges.ndjson');
const ICEBERG_FILE = path.join(__dirname, '..', 'data', 'truth', 'aicte_iceberg_truth.ndjson');

async function aicteIcebergIngest() {
    console.log("🚢 Starting AICTE ICEBERG Deep-Harvest (10,000+ Colleges)...");

    // 1. Group Iceberg Data by AISHE ID
    const icebergMap = new Map();
    const rl = readline.createInterface({ input: fs.createReadStream(ICEBERG_FILE), crlfDelay: Infinity });
    
    let lineCount = 0;
    for await (const line of rl) {
        if (!line.trim()) continue;
        lineCount++;
        try {
            const obj = JSON.parse(line);
            const aid = obj.collegeId || obj.aisheCode;
            if (!aid) continue;

            if (!icebergMap.has(aid)) icebergMap.set(aid, { courses: [], totalIntake: 0 });
            const entry = icebergMap.get(aid);
            
            if (obj.programName) {
                entry.courses.push({
                    name: obj.programName,
                    degree: obj.degree,
                    intake: parseInt(obj.intake) || 0,
                    duration: obj.duration,
                    level: obj.level
                });
                entry.totalIntake += (parseInt(obj.intake) || 0);
            }
        } catch(e) {}
    }
    console.log(`🧊 Grouped ${lineCount} program records into ${icebergMap.size} colleges.`);

    // 2. Update Datastore
    const collegesLines = fs.readFileSync(COLLEGES_FILE, 'utf8').split('\n').filter(l => l.trim());
    let matchCount = 0;
    const output = [];

    for (const line of collegesLines) {
        let college = JSON.parse(line);
        const aid = college.aisheCode;

        if (aid && icebergMap.has(aid)) {
            matchCount++;
            const truth = icebergMap.get(aid);
            
            // Merge courses
            const existingCourses = new Set((college.courses || []).map(c => (c.name || '').toLowerCase()));
            const newCourses = truth.courses.filter(c => !existingCourses.has(c.name.toLowerCase()));
            
            college.courses = [...(college.courses || []), ...newCourses];
            college.isTechnical = true;
            college.managementType = college.managementType || truth.managementType;
            
            if (!college.meta) college.meta = {};
            college.meta.totalIntake = truth.totalIntake;
            college.meta.aicteVerified = true;

            // Bump confidence
            college.dataConfidenceScore = Math.min((college.dataConfidenceScore || 20) + 15, 100);
        }
        output.push(JSON.stringify(college));
    }

    fs.writeFileSync(COLLEGES_FILE, output.join('\n') + '\n');
    console.log(`🎉 Iceberg Harvest Finished! Deep-hydrated ${matchCount} Technical Colleges.`);
}

aicteIcebergIngest().catch(console.error);
