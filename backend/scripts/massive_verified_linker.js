const fs = require('fs');
const path = require('path');
const readline = require('readline');
const Fuse = require('fuse.js');

const COLLEGES_PATH = path.join(__dirname, '../data/colleges.ndjson');
const RAW_TRUTH_DIR = path.join(__dirname, '../data/truth');
const OUTPUT_DIR = path.join(__dirname, '../data/truth/linked');

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

async function loadDataset() {
    console.log("📂 Loading main dataset for indexing...");
    const colleges = [];
    const fileStream = fs.createReadStream(COLLEGES_PATH);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    for await (const line of rl) {
        if (!line.trim()) continue;
        const obj = JSON.parse(line);
        colleges.push({
            stableKey: obj.stableKey,
            name: obj.name,
            district: obj.district || "",
            state: obj.state || ""
        });
    }
    console.log(`✅ Loaded ${colleges.length} colleges.`);
    return colleges;
}

function fuzzyMatch(truthName, district, state, dataset) {
    // 1. Exact State + District Filter
    let candidates = dataset.filter(c => 
        (c.state.toLowerCase() === state.toLowerCase()) &&
        (c.district.toLowerCase() === district.toLowerCase())
    );

    // 2. Fallback: State only if District is different (sometimes portal districts are names differently)
    if (candidates.length === 0) {
        candidates = dataset.filter(c => c.state.toLowerCase() === state.toLowerCase());
    }

    if (candidates.length === 0) return null;

    // 3. Fuse.js Fuzzy Match
    const fuse = new Fuse(candidates, {
        keys: ['name'],
        includeScore: true,
        threshold: 0.5 // Relaxed threshold for abbreviations
    });

    const results = fuse.search(truthName);
    if (results.length > 0 && results[0].score < 0.4) {
        return results[0].item;
    }
    return null;
}

async function linkFile(fileName, dataset, state) {
    console.log(`🔗 Linking ${fileName} for state ${state}...`);
    const rawPath = path.join(RAW_TRUTH_DIR, fileName);
    const outputPath = path.join(OUTPUT_DIR, fileName);
    
    const content = fs.readFileSync(rawPath, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    
    let matched = 0;
    const linkedLines = [];

    for (const line of lines) {
        const obj = JSON.parse(line);
        const match = fuzzyMatch(obj.name, obj.district || "", state, dataset);
        
        if (match) {
            obj.collegeId = match.stableKey; // LINK TO AISHE ID
            matched++;
        }
        linkedLines.push(JSON.stringify(obj));
    }

    fs.writeFileSync(outputPath, linkedLines.join('\n'));
    console.log(`✅ Linked ${matched}/${lines.length} institutions in ${fileName}`);
}

function cleanInstitutionName(name) {
    if (!name) return "";
    return name.toLowerCase()
        .replace(/indian institute of technology/g, "iit")
        .replace(/national institute of technology/g, "nit")
        .replace(/international institute of information technology/g, "iiit")
        .replace(/indian institute of information technology/g, "iiit")
        .replace(/birla institute of technology and science/g, "bits")
        .replace(/college of engineering/g, "")
        .replace(/institute of technology/g, "")
        .replace(/deemed to be university/g, "")
        .replace(/university/g, "")
        .replace(/ - /g, " ")
        .replace(/[.,()]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

async function run() {
    const dataset = await loadDataset();
    // Pre-clean dataset for faster/better global matching
    const cleanDataset = dataset.map(c => ({
        ...c,
        cleanName: cleanInstitutionName(c.name)
    }));
    
    // 1. Link Maharashtra (District-Filtered)
    await linkFile('maharashtra_fra_2024.ndjson', dataset, 'Maharashtra');
    
    // 2. Link NIRF (Nation-wide or Name-based)
    console.log(`🔗 Linking NIRF 2024 Placements (Improved Logic)...`);
    const nirfPath = path.join(RAW_TRUTH_DIR, 'nirf_2024_placements.ndjson');
    const nirfOutputPath = path.join(OUTPUT_DIR, 'nirf_2024_placements.ndjson');
    
    if (fs.existsSync(nirfPath)) {
        const content = fs.readFileSync(nirfPath, 'utf8');
        const lines = content.split('\n').filter(l => l.trim());
        let matched = 0;
        const linkedLines = [];

        // Global Fuse instance for elite names (high threshold)
        const globalFuse = new Fuse(cleanDataset, {
            keys: ['cleanName'],
            includeScore: true,
            threshold: 0.45 // Relaxed for cleaned names
        });

        for (const line of lines) {
            const obj = JSON.parse(line);
            const cleanedTruthName = cleanInstitutionName(obj.name);
            const results = globalFuse.search(cleanedTruthName);
            
            if (results.length > 0 && results[0].score < 0.4) {
                obj.collegeId = results[0].item.stableKey;
                matched++;
            }
            linkedLines.push(JSON.stringify(obj));
        }
        fs.writeFileSync(nirfOutputPath, linkedLines.join('\n'));
        console.log(`✅ Linked ${matched}/${lines.length} NIRF institutions.`);
    }
}

run();
