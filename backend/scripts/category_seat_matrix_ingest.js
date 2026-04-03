const fs = require('fs');
const path = require('path');
const readline = require('readline');

const COLLEGES_FILE = path.join(__dirname, '..', 'data', 'colleges.ndjson');
const TRUTH_FILES = [
    { path: path.join(__dirname, '..', 'data', 'truth', 'gujarat_acpc_2025.ndjson'), state: 'Gujarat' },
    { path: path.join(__dirname, '..', 'data', 'truth', 'tamil_nadu_tnea_2024_bulk.ndjson'), state: 'Tamil Nadu' },
    { path: path.join(__dirname, '..', 'data', 'truth', 'karnataka_kea_2024_bulk.ndjson'), state: 'Karnataka' }
];

function norm(n) { return n ? n.toLowerCase().replace(/[^a-z0-9]/g, '') : ''; }

async function categorySeatMatrixIngest() {
    console.log("🌊 Starting CATEGORY SEAT MATRIX Deep-Sync...");

    const matrixMap = new Map();

    for (const f of TRUTH_FILES) {
        if (!fs.existsSync(f.path)) continue;
        const rl = readline.createInterface({ input: fs.createReadStream(f.path), crlfDelay: Infinity });
        for await (const line of rl) {
            try {
                const obj = JSON.parse(line);
                if (obj.entityType !== 'seat_matrix' && !obj.oc && !obj.gm && !obj.open) continue;

                const aid = obj.aisheCode || obj.collegeId || obj.stableKey || obj.collegeCode;
                if (!aid) continue;

                // Extraction logic
                const matrix = {
                    open: parseInt(obj.open || obj.gm || obj.oc || obj.openSeats || 0),
                    sc: parseInt(obj.sc || obj.scSeats || 0),
                    st: parseInt(obj.st || obj.stSeats || 0),
                    obc: parseInt(obj.obc || obj.sebc || obj.bc || obj.mbc || obj.bcm || obj.c1 || obj.c2 || obj.bcSeats || 0),
                    ews: parseInt(obj.ews || obj.ewsSeats || 0),
                    source: f.state + " Counseling Matrix 2024"
                };

                const courseKey = norm(obj.courseName || obj.branchName || obj.programName);
                if (!matrixMap.has(aid)) matrixMap.set(aid, []);
                matrixMap.get(aid).push({ courseKey, matrix });
            } catch(e) {}
        }
    }
    console.log(`📡 Loaded ${matrixMap.size} college seat matrices.`);

    // 2. Update Datastore
    const collegesLines = fs.readFileSync(COLLEGES_FILE, 'utf8').split('\n').filter(l => l.trim());
    let matchCount = 0;
    const output = [];

    for (const line of collegesLines) {
        let college = JSON.parse(line);
        const aid = college.aisheCode || college.stableKey;

        if (aid && matrixMap.has(aid)) {
            matchCount++;
            const newMatrices = matrixMap.get(aid);
            
            college.courses = college.courses || [];
            for (const item of newMatrices) {
                const existing = college.courses.find(c => norm(c.name) === item.courseKey);
                if (existing) {
                    existing.seatMatrix = item.matrix;
                } else {
                    college.courses.push({
                        name: item.courseKey.toUpperCase(),
                        intake: item.matrix.open + item.matrix.sc + item.matrix.st + item.matrix.obc + item.matrix.ews,
                        seatMatrix: item.matrix,
                        source: item.matrix.source
                    });
                }
            }
            
            college.dataConfidenceScore = Math.min((college.dataConfidenceScore || 20) + 15, 100);
        }
        output.push(JSON.stringify(college));
    }

    fs.writeFileSync(COLLEGES_FILE, output.join('\n') + '\n');
    console.log(`🎉 Category Seat Matrix Wave Finished! Hydrated ${matchCount} institutions.`);
}

categorySeatMatrixIngest().catch(console.error);
