const fs = require('fs');
const path = require('path');
const readline = require('readline');

const COLLEGES_FILE = path.join(__dirname, '..', 'data', 'colleges.ndjson');
const SEATS_TRUTH = path.join(__dirname, '..', 'data', 'truth', 'seats_truth.ndjson');

async function ultimateCategorySync() {
    console.log("🌊 Starting ULTIMATE CATEGORY SEAT MATRIX Sync (Official Master)...");

    const matrixMap = new Map(); // aisheCode -> [{course, category, intake}]

    const rl = readline.createInterface({ input: fs.createReadStream(SEATS_TRUTH), crlfDelay: Infinity });

    for await (const line of rl) {
        if (!line.trim()) continue;
        try {
            const obj = JSON.parse(line);
            const aid = obj.id || obj.aisheCode;
            if (!aid) continue;

            const entry = {
                course: obj.course || obj.programName || "General",
                category: (obj.category || "Open").toLowerCase(),
                intake: parseInt(obj.intake || 0)
            };

            if (!matrixMap.has(aid)) matrixMap.set(aid, []);
            matrixMap.get(aid).push(entry);
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
            const seatRows = matrixMap.get(aid);
            
            college.courses = college.courses || [];
            
            // Group by course
            const coursesObj = {};
            for (const row of seatRows) {
                coursesObj[row.course] = coursesObj[row.course] || { open: 0, sc: 0, st: 0, obc: 0, ews: 0 };
                const cat = row.category.toLowerCase();
                if (cat.includes('sc')) coursesObj[row.course].sc += row.intake;
                else if (cat.includes('st')) coursesObj[row.course].st += row.intake;
                else if (cat.includes('obc') || cat.includes('bc') || cat.includes('mbc')) coursesObj[row.course].obc += row.intake;
                else if (cat.includes('ews')) coursesObj[row.course].ews += row.intake;
                else coursesObj[row.course].open += row.intake;
            }

            for (const [name, matrix] of Object.entries(coursesObj)) {
                const existing = college.courses.find(c => c.name.toLowerCase() === name.toLowerCase());
                if (existing) {
                    existing.seatMatrix = matrix;
                } else {
                    college.courses.push({
                        name: name.toUpperCase(),
                        intake: matrix.open + matrix.sc + matrix.st + matrix.obc + matrix.ews,
                        seatMatrix: matrix,
                        source: "Official Seats Truth Registry"
                    });
                }
            }
            
            college.dataConfidenceScore = Math.min((college.dataConfidenceScore || 20) + 20, 100);
        }
        output.push(JSON.stringify(college));
    }

    fs.writeFileSync(COLLEGES_FILE, output.join('\n') + '\n');
    console.log(`🎉 Ultimate Category Sync Finished! Hydrated ${matchCount} institutions.`);
}

ultimateCategorySync().catch(console.error);
