const fs = require('fs');
const path = require('path');
const readline = require('readline');

const COLLEGES_FILE = path.join(__dirname, '..', 'data', 'colleges.ndjson');
const NIRF_EXPANDED = path.join(__dirname, '..', 'data', 'truth', 'nirf_expanded_2024_v1.ndjson');

function norm(n) { return n ? n.toLowerCase().replace(/[^a-z0-9]/g, '') : ''; }

function similarity(s1, s2) {
    let longer = s1;
    let shorter = s2;
    if (s1.length < s2.length) { longer = s2; shorter = s1; }
    const longerLength = longer.length;
    if (longerLength === 0) return 1.0;
    return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
}

function editDistance(s1, s2) {
    s1 = s1.toLowerCase();
    s2 = s2.toLowerCase();
    const costs = [];
    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i === 0) costs[j] = j;
            else if (j > 0) {
                let newValue = costs[j - 1];
                if (s1.charAt(i - 1) !== s2.charAt(j - 1)) newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                costs[j - 1] = lastValue;
                lastValue = newValue;
            }
        }
        if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
}

async function nirfScavengerIngest() {
    console.log("🦁 Starting NIRF SCAVENGER (Fuzzy Density Wave)...");

    const nirfMap = new Map();
    if (!fs.existsSync(NIRF_EXPANDED)) return;

    const rl = readline.createInterface({ input: fs.createReadStream(NIRF_EXPANDED), crlfDelay: Infinity });
    for await (const line of rl) {
        try {
            const obj = JSON.parse(line);
            const stateKey = norm(obj.state);
            if (!nirfMap.has(stateKey)) nirfMap.set(stateKey, []);
            nirfMap.get(stateKey).push(obj);
        } catch(e) {}
    }
    console.log(`📡 Loaded NIRF Expanded truth for ${nirfMap.size} states.`);

    // 2. Update Datastore
    const collegesLines = fs.readFileSync(COLLEGES_FILE, 'utf8').split('\n').filter(l => l.trim());
    let matchCount = 0;
    const output = [];

    for (const line of collegesLines) {
        let college = JSON.parse(line);
        const stateKey = norm(college.state);
        const nirfPossibles = nirfMap.get(stateKey) || [];

        let bestMatch = null;
        let bestScore = 0;

        for (const candidate of nirfPossibles) {
            const score = similarity(college.name, candidate.name);
            if (score > 0.85 && score > bestScore) {
                bestScore = score;
                bestMatch = candidate;
            }
        }

        if (bestMatch) {
            matchCount++;
            const sal = parseFloat(bestMatch.averagePackageNumeric || bestMatch.medianSalary || bestMatch.avgLPA || 0);
            const numeric = (sal < 100 && sal > 0) ? sal * 100000 : sal;
            
            college.placements = {
                averagePackageNumeric: numeric,
                averagePackage: (numeric / 100000).toFixed(2) + " LPA",
                source: "NIRF 2024 (Tier-2 Match)"
            };
            college.rankings = college.rankings || {};
            college.rankings.nirf = bestMatch.rank;
            college.dataConfidenceScore = Math.min((college.dataConfidenceScore || 20) + 15, 95);
        }
        output.push(JSON.stringify(college));
    }

    fs.writeFileSync(COLLEGES_FILE, output.join('\n') + '\n');
    console.log(`🎉 NIRF Scavenger Finished! Deep-hydrated ${matchCount} institutions with Tier-1.5 stats.`);
}

nirfScavengerIngest().catch(console.error);
