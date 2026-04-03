const fs = require('fs');
const path = require('path');
const readline = require('readline');

const COLLEGES_FILE = path.join(__dirname, '..', 'data', 'colleges.ndjson');
const COURSES_TRUTH = path.join(__dirname, '..', 'data', 'truth', 'courses_truth.ndjson');

async function finalCategorySync() {
    console.log("🌊 Starting FINAL GLOBAL CATEGORY SEAT MATRIX Sync (5.6MB Master)...");

    const matrixMap = new Map(); // collegeId -> [{program, matrix}]

    const rl = readline.createInterface({ input: fs.createReadStream(COURSES_TRUTH), crlfDelay: Infinity });

    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            const obj = JSON.parse(line);
            const aid = obj.collegeId || obj.aisheCode;
            if (!aid) continue;

            const matrix = {
                open: parseInt(obj.intakeGeneral || obj.intakeOpen || 0),
                sc: parseInt(obj.intakeSC || 0),
                st: parseInt(obj.intakeST || 0),
                obc: parseInt(obj.intakeOBC || obj.intakeSEBC || 0),
                ews: parseInt(obj.intakeEWS || 0)
            };

            if (matrix.sc + matrix.st + matrix.obc === 0 && !obj.program) continue;

            const program = (obj.program || obj.programName || "General").toUpperCase();
            if (!matrixMap.has(aid)) matrixMap.set(aid, []);
            matrixMap.get(aid).push({ program, matrix });
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
                const normName = item.program.toLowerCase().replace(/[^a-z0-9]/g, '');
                const existing = college.courses.find(c => c.name && c.name.toLowerCase().replace(/[^a-z0-9]/g, '') === normName);
                
                if (existing) {
                    existing.seatMatrix = item.matrix;
                } else {
                    college.courses.push({
                        name: item.program,
                        intake: item.matrix.open + item.matrix.sc + item.matrix.st + item.matrix.obc + item.matrix.ews,
                        seatMatrix: item.matrix,
                        source: "Official Category Ingestion Phase 16"
                    });
                }
            }
            
            college.dataConfidenceScore = Math.min((college.dataConfidenceScore || 20) + 20, 100);
        }
        output.push(JSON.stringify(college));
    }

    fs.writeFileSync(COLLEGES_FILE, output.join('\n') + '\n');
    console.log(`🎉 Final Category Sync Finished! Hydrated ${matchCount} institutions.`);
}

finalCategorySync().catch(console.error);
