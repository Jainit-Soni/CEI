const fs = require('fs');
const path = require('path');
const readline = require('readline');

const COLLEGES_FILE = path.join(__dirname, '..', 'data', 'colleges.ndjson');
const TRUTH_FILES = [
    { path: path.join(__dirname, '..', 'data', 'truth', 'tamil_nadu_tnea_2024_bulk.ndjson'), state: 'Tamil Nadu' },
    { path: path.join(__dirname, '..', 'data', 'truth', 'karnataka_kea_2024_bulk.ndjson'), state: 'Karnataka' },
    { path: path.join(__dirname, '..', 'data', 'truth', 'gujarat_acpc_2025.ndjson'), state: 'Gujarat' }
];

function norm(n) { return n ? n.toLowerCase().replace(/[^a-z0-9]/g, '') : ''; }

async function fuzzyCategoryIngest() {
    console.log("🌊 Starting FUZZY CATEGORY SEAT MATRIX Deep-Sync...");

    // 1. Build Index of main datastore for fuzzy lookups
    const collegesLines = fs.readFileSync(COLLEGES_FILE, 'utf8').split('\n').filter(l => l.trim());
    const datastore = collegesLines.map(l => JSON.parse(l));
    const datastoreIndex = new Map(); // state -> [{nameKey, college}]

    for (const c of datastore) {
        const sKey = norm(c.state);
        if (!datastoreIndex.has(sKey)) datastoreIndex.set(sKey, []);
        datastoreIndex.get(sKey).push({ nameKey: norm(c.name), college: c });
    }

    // 2. Load Truth and Match
    let matchCount = 0;
    for (const f of TRUTH_FILES) {
        if (!fs.existsSync(f.path)) continue;
        console.log(`📡 Processing ${f.state} truth source...`);
        const sKey = norm(f.state);
        const candidates = datastoreIndex.get(sKey) || [];

        const rl = readline.createInterface({ input: fs.createReadStream(f.path), crlfDelay: Infinity });
        for await (const line of rl) {
            try {
                const obj = JSON.parse(line);
                const nameKey = norm(obj.collegeName || obj.name);
                if (!nameKey) continue;

                // Find the college
                const match = candidates.find(c => c.nameKey === nameKey || c.nameKey.includes(nameKey) || nameKey.includes(c.nameKey));
                if (match) {
                    const college = match.college;
                    const matrix = {
                        open: parseInt(obj.oc || obj.gm || obj.open || 0),
                        sc: parseInt(obj.sc || 0),
                        st: parseInt(obj.st || 0),
                        obc: parseInt(obj.bc || obj.mbc || obj.bcm || obj.sebc || obj.c1 || 0),
                        ews: parseInt(obj.ews || 0),
                        source: f.state + " Counseling Matrix 2024"
                    };
                    if (matrix.sc + matrix.st + matrix.obc > 0) {
                        const courseKey = norm(obj.branchName || obj.courseName || obj.programName);
                        college.courses = college.courses || [];
                        const existing = college.courses.find(c => norm(c.name) === courseKey);
                        if (existing) {
                            existing.seatMatrix = matrix;
                        } else {
                            college.courses.push({
                                name: (obj.branchName || obj.courseName || "General").toUpperCase(),
                                intake: matrix.open + matrix.sc + matrix.st + matrix.obc + matrix.ews,
                                seatMatrix: matrix
                            });
                        }
                        matchCount++;
                    }
                }
            } catch(e) {}
        }
    }

    // 3. Write back
    fs.writeFileSync(COLLEGES_FILE, datastore.map(c => JSON.stringify(c)).join('\n') + '\n');
    console.log(`🎉 Fuzzy Category Wave Finished! Hydrated ${matchCount} course seat matrices.`);
}

fuzzyCategoryIngest().catch(console.error);
