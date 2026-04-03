const fs = require('fs');
const path = require('path');
const readline = require('readline');

const COLLEGES_FILE = path.join(__dirname, '..', 'data', 'colleges.ndjson');
const COURSES_TRUTH = path.join(__dirname, '..', 'data', 'truth', 'courses_truth.ndjson');

async function courseDensityIngest() {
    console.log("🌊 Starting COURSE DENSITY DEEP-HARVEST (22,975+ Programs)...");

    const courseMap = new Map();
    const rl = readline.createInterface({ input: fs.createReadStream(COURSES_TRUTH), crlfDelay: Infinity });

    let linesProcessed = 0;
    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            const obj = JSON.parse(line);
            const aid = obj.collegeId || obj.aisheCode;
            if (!aid) continue;

            if (!courseMap.has(aid)) courseMap.set(aid, []);
            courseMap.get(aid).push({
                name: obj.programName || obj.courseName,
                degree: obj.degree,
                intake: parseInt(obj.intake) || 0,
                duration: obj.duration,
                shift: obj.shift,
                source: "Official Truth Database"
            });
            linesProcessed++;
        } catch(e) {}
    }
    console.log(`📡 Loaded ${linesProcessed} program records from truth source.`);

    // 2. Update Datastore
    const collegesLines = fs.readFileSync(COLLEGES_FILE, 'utf8').split('\n').filter(l => l.trim());
    let matchCount = 0;
    let courseCount = 0;
    const output = [];

    for (const line of collegesLines) {
        let college = JSON.parse(line);
        const aid = college.aisheCode;

        if (aid && courseMap.has(aid)) {
            matchCount++;
            const newPrograms = courseMap.get(aid);
            
            // Deep merge to avoid duplicates
            const currentCourseNames = new Set((college.courses || []).map(c => (c.name || '').toLowerCase()));
            const deduplicated = newPrograms.filter(p => !currentCourseNames.has(p.name.toLowerCase()));
            
            college.courses = [...(college.courses || []), ...deduplicated];
            
            // Recalculate intake
            college.meta = college.meta || {};
            college.meta.totalIntake = (college.meta.totalIntake || 0) + deduplicated.reduce((acc, p) => acc + p.intake, 0);
            
            college.dataConfidenceScore = Math.min((college.dataConfidenceScore || 20) + 10, 95);
            courseCount += deduplicated.length;
        }
        output.push(JSON.stringify(college));
    }

    fs.writeFileSync(COLLEGES_FILE, output.join('\n') + '\n');
    console.log(`🎉 Course Density Wave Finished! Hydrated ${courseCount} new programs across ${matchCount} colleges.`);
}

courseDensityIngest().catch(console.error);
