const fs = require('fs');
const path = require('path');
const readline = require('readline');

const UNIV_CSV = path.join(__dirname, '..', 'data', 'aishe_university.csv');
const CORE_FILE = path.join(__dirname, '..', 'data', 'core', 'core_institutes.ndjson');
const REGISTRY_OUT = path.join(__dirname, '..', 'data', 'core', 'master_core_registry.json');
const TRUTH_DIR = path.join(__dirname, '..', 'data', 'truth');

async function buildRegistry() {
    console.log("🛠️  Building Master Core Registry...");
    const coreList = new Set();
    const coreDetails = {};

    // 1. Add baseline core institutes (IITs, IIMs, etc)
    const baseline = fs.readFileSync(CORE_FILE, 'utf8').split('\n').filter(l => l.trim());
    baseline.forEach(l => {
        const c = JSON.parse(l);
        coreList.add(c.canonicalName);
        coreDetails[c.canonicalName] = { ...c, source: 'Baseline' };
    });

    // 2. Add all AISHE Universities (Core Tier-1)
    const rl = readline.createInterface({ input: fs.createReadStream(UNIV_CSV), crlfDelay: Infinity });
    let lineNum = 0;
    for await (const line of rl) {
        lineNum++;
        if (lineNum <= 4) continue;
        const parts = line.match(/(".*?"|[^",\r\n]+)(?=\s*,|\s*$)/g);
        if (!parts || parts.length < 2) continue;
        const code = parts[0].trim().replace(/^"/, '').replace(/"$/, '');
        const name = parts[1].trim().replace(/^"/, '').replace(/"$/, '');
        
        if (!coreList.has(name)) {
            coreList.add(name);
            coreDetails[name] = { canonicalName: name, aisheCode: code, source: 'University', isCore: true };
        }
    }

    // 3. Add any Top 500 NIRF matched institutions
    const nirfFiles = fs.readdirSync(TRUTH_DIR).filter(f => f.includes('nirf') || f.includes('rankings'));
    for (const f of nirfFiles) {
        const rl2 = readline.createInterface({ input: fs.createReadStream(path.join(TRUTH_DIR, f)), crlfDelay: Infinity });
        for await (const line of rl2) {
            try {
                const obj = JSON.parse(line);
                if (obj.name && !coreList.has(obj.name)) {
                    coreList.add(obj.name);
                    coreDetails[obj.name] = { canonicalName: obj.name, source: 'NIRF', isCore: true };
                }
            } catch(e) {}
        }
    }

    const finalRegistry = Object.values(coreDetails);
    fs.writeFileSync(REGISTRY_OUT, JSON.stringify(finalRegistry, null, 2));
    console.log(`✅ Master Core Registry Built: ${finalRegistry.length} institutions.`);
}

buildRegistry().catch(console.error);
