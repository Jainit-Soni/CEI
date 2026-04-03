const fs = require('fs');
const path = require('path');
const readline = require('readline');

const COLLEGES_FILE = path.join(__dirname, '..', 'data', 'colleges.ndjson');
const SEATS_TRUTH = path.join(__dirname, '..', 'data', 'truth', 'seats_truth.ndjson');

async function verifiedCategorySync() {
    console.log("🌊 Starting VERIFIED CATEGORY SEAT MATRIX Sync (Official Matrix)...");

    const matrixMap = new Map(); // collegeId -> [{courseName, matrix}]

    const rl = readline.createInterface({ input: fs.createReadStream(SEATS_TRUTH), crlfDelay: Infinity });

    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            const obj = JSON.parse(line);
            if (obj.entityType !== 'counsellingSeatMatrix') continue;
            
            const aid = obj.collegeId;
            if (!aid) continue;

            const matrix = {
                open: parseInt(obj.open || obj.gm || obj.oc || 0),
                sc: parseInt(obj.sc || 0),
                st: parseInt(obj.st || 0),
                obc: parseInt(obj.obc || obj.sebc || obj.bc || obj.mbc || 0),
                ews: parseInt(obj.ews || 0),
                total: parseInt(obj.totalIntake || 0)
            };

            const courseName = (obj.courseName || obj.branchName || "General").toUpperCase();
            if (!matrixMap.has(aid)) matrixMap.set(aid, []);
            matrixMap.get(aid).push({ courseName, matrix });
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
                const existing = college.courses.find(c => c.name.toUpperCase() === item.courseName);
                if (existing) {
                    existing.seatMatrix = item.matrix;
                } else {
                    college.courses.push({
                        name: item.courseName,
                        intake: item.matrix.total || (item.matrix.open + item.matrix.sc + item.matrix.st + item.matrix.obc + item.matrix.ews),
                        seatMatrix: item.matrix,
                        source: "Official Counselling Seat Matrix 2024-25"
                    });
                }
            }
            
            college.dataConfidenceScore = Math.min((college.dataConfidenceScore || 20) + 20, 100);
        }
        output.push(JSON.stringify(college));
    }

    fs.writeFileSync(COLLEGES_FILE, output.join('\n') + '\n');
    console.log(`🎉 Verified Category Sync Finished! Hydrated ${matchCount} institutions.`);
}

verifiedCategorySync().catch(console.error);
