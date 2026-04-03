const fs = require('fs');
const path = require('path');
const readline = require('readline');

const COLLEGES_FILE = path.join(__dirname, '..', 'data', 'colleges.ndjson');
const COURSES_TRUTH = path.join(__dirname, '..', 'data', 'truth', 'courses_truth.ndjson');

async function globalCategorySync() {
    console.log("🌊 Starting GLOBAL CATEGORY SEAT MATRIX Sync (5.6MB Master)...");

    const matrixMap = new Map(); // aisheCode -> [{programName, categoryIntake}]

    const rl = readline.createInterface({ input: fs.createReadStream(COURSES_TRUTH), crlfDelay: Infinity });

    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            const obj = JSON.parse(line);
            const aid = obj.aisiheCode || obj.aisheCode || obj.collegeId;
            if (!aid || !obj.categoryIntake) continue;

            if (!matrixMap.has(aid)) matrixMap.set(aid, []);
            matrixMap.get(aid).push({
                programName: obj.programName || obj.courseName || "General",
                categoryIntake: {
                    open: parseInt(obj.categoryIntake.General || obj.categoryIntake.Open || 0),
                    sc: parseInt(obj.categoryIntake.SC || 0),
                    st: parseInt(obj.categoryIntake.ST || 0),
                    obc: parseInt(obj.categoryIntake.OBC || obj.categoryIntake.SEBC || obj.categoryIntake.BC || 0),
                    ews: parseInt(obj.categoryIntake.EWS || 0)
                }
            });
        } catch(e) {}
    }
    console.log(`📡 Loaded official seat matrices for ${matrixMap.size} institutions.`);

    // 2. Update Datastore
    const collegesLines = fs.readFileSync(COLLEGES_FILE, 'utf8').split('\n').filter(l => l.trim());
    let matchCount = 0;
    const output = [];

    for (const line of collegesLines) {
        let college = JSON.parse(line);
        const aid = college.aisheCode;

        if (aid && matrixMap.has(aid)) {
            matchCount++;
            const newMatrices = matrixMap.get(aid);
            
            college.courses = college.courses || [];
            for (const item of newMatrices) {
                const normName = item.programName.toLowerCase().replace(/[^a-z0-9]/g, '');
                const existing = college.courses.find(c => c.name && c.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normName);
                
                if (existing) {
                    existing.seatMatrix = item.categoryIntake;
                } else {
                    college.courses.push({
                        name: item.programName.toUpperCase(),
                        intake: item.categoryIntake.open + item.categoryIntake.sc + item.categoryIntake.st + item.categoryIntake.obc + item.categoryIntake.ews,
                        seatMatrix: item.categoryIntake,
                        source: "Official AISHE/AICTE Integrated Matrix"
                    });
                }
            }
            
            college.dataConfidenceScore = Math.min((college.dataConfidenceScore || 20) + 20, 100);
        }
        output.push(JSON.stringify(college));
    }

    fs.writeFileSync(COLLEGES_FILE, output.join('\n') + '\n');
    console.log(`🎉 Global Category Sync Finished! Hydrated ${matchCount} institutions.`);
}

globalCategorySync().catch(console.error);
