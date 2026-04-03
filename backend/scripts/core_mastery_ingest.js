const fs = require('fs');
const path = require('path');
const readline = require('readline');

const COLLEGES_FILE = path.join(__dirname, '..', 'data', 'colleges.ndjson');
const REGISTRY_FILE = path.join(__dirname, '..', 'data', 'core', 'master_core_registry.json');
const TRUTH_DIR = path.join(__dirname, '..', 'data', 'truth');

// Normalization function for elite names
function norm(n) {
    if (!n) return '';
    return n.toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .replace(/\bs\s*p\b/g, 'sp')
        .replace(/\bi\s*i\s*t\b/g, 'iit')
        .replace(/indianinstituteoftechnology/g, 'iit');
}

async function coreMasteryIngest() {
    console.log("🏛️  Starting CORE MASTERY INGESTION (Elite 1,479)...");

    // 1. Load Core Hierarchy from Registry
    const coreMap = new Map();
    const coreRegistry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
    coreRegistry.forEach(c => {
        coreMap.set(norm(c.canonicalName), { ...c, found: false });
        if (c.displayName) coreMap.set(norm(c.displayName), { ...c, found: false });
        if (c.aisheCode) coreMap.set(norm(c.aisheCode), { ...c, found: false });
    });
    console.log(`📡 Loaded ${coreMap.size} core lookup keys from 1,479 institutions.`);

    // 2. Load Truth Pool (Prioritizing Core Fields)
    const truthMap = new Map();
    const files = fs.readdirSync(TRUTH_DIR).filter(f => f.endsWith('.ndjson'));
    
    for (const f of files) {
        const rl = readline.createInterface({ input: fs.createReadStream(path.join(TRUTH_DIR, f)), crlfDelay: Infinity });
        for await (const line of rl) {
            if (!line.trim()) continue;
            try {
                const obj = JSON.parse(line);
                const key = norm(obj.name || obj.canonicalName);
                if (coreMap.has(key)) {
                    if (!truthMap.has(key)) truthMap.set(key, {});
                    const existing = truthMap.get(key);
                    // Merge fields
                    if (obj.entityType === 'placement') existing.placements = obj;
                    if (obj.entityType === 'fees') existing.fees = obj;
                    if (obj.entityType === 'ranking') (existing.rankings = existing.rankings || []).push(obj);
                    if (obj.entityType === 'metadata') Object.assign(existing, obj);
                    if (obj.lat && obj.lng) existing.coordinates = { lat: obj.lat, lng: obj.lng };
                }
            } catch(e) {}
        }
    }
    console.log(`✅ Truth Pool Hydrated: ${truthMap.size} core institutions have extra data.`);

    // 3. Update main datastore
    const outputLines = [];
    const collegesLines = fs.readFileSync(COLLEGES_FILE, 'utf8').split('\n').filter(l => l.trim());
    let coreMatchCount = 0;

    for (const line of collegesLines) {
        let college = JSON.parse(line);
        const nameKey = norm(college.name);
        const codeKey = norm(college.aisheCode || college.stableKey);

        const eliteTruth = truthMap.get(nameKey) || truthMap.get(codeKey);
        const isCore = coreMap.has(nameKey) || coreMap.has(codeKey);

        if (isCore) {
            coreMatchCount++;
            college.isCore = true;
            college.searchBoost = 2.5; 
            
            if (eliteTruth) {
                // Normalizing Placements (NIRF uses medianSalary)
                if (eliteTruth.placements || eliteTruth.medianSalary) {
                    const p = eliteTruth.placements || eliteTruth;
                    const rawSalary = p.medianSalary || p.averagePackage || p.avgLPA || p.avgSalary || 0;
                    
                    // If salary is < 100, assume it's in LPA
                    let numericSalary = parseFloat(rawSalary);
                    if (numericSalary > 0 && numericSalary < 200) numericSalary *= 100000;

                    college.placements = {
                        averagePackage: p.averagePackage || p.avgLPA || (numericSalary / 100000).toFixed(2) + " LPA",
                        highestPackage: p.highestPackage || p.highLPA,
                        averagePackageNumeric: numericSalary,
                        placedPercentage: p.placedPercentage || p.placed || 0,
                        source: p.source || "NIRF 2024 / Official"
                    };
                }

                // Normalizing Coordinates
                if (eliteTruth.coordinates || eliteTruth.lat || eliteTruth.lng) {
                    college.coordinates = {
                        lat: parseFloat(eliteTruth.coordinates?.lat || eliteTruth.lat),
                        lng: parseFloat(eliteTruth.coordinates?.lng || eliteTruth.lng)
                    };
                }

                // Normalizing Fees
                if (eliteTruth.fees) {
                    const f = eliteTruth.fees;
                    college.fees = {
                        ...college.fees,
                        totalNumeric: f.totalFee || f.total || 0,
                        total: `₹${(f.totalFee || f.total || 0).toLocaleString()} INR`
                    };
                }

                if (eliteTruth.rankings) college.rankings = eliteTruth.rankings;
                if (eliteTruth.website) college.website = eliteTruth.website;
                if (eliteTruth.email) college.email = eliteTruth.email;
                if (eliteTruth.phone) college.phone = eliteTruth.phone;
            }

            // High Precision Confidence for Core
            let score = 60; 
            if (college.placements?.averagePackageNumeric > 0) score += 20;
            if (college.coordinates?.lat) score += 10;
            if (college.website) score += 5;
            if (college.rankings?.length > 0) score += 5;
            college.dataConfidenceScore = Math.min(score, 100);
        }
        outputLines.push(JSON.stringify(college));
    }

    fs.writeFileSync(COLLEGES_FILE, outputLines.join('\n') + '\n');
    console.log(`🔥 Core Mastery Finished! Injected data for ${coreMatchCount} Core Institutions.`);
}

coreMasteryIngest().catch(console.error);
