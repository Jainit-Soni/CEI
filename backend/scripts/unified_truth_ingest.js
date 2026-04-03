const fs = require('fs');
const path = require('path');
const readline = require('readline');

const DATA_DIR = path.join(__dirname, '..', 'data');
const TRUTH_DIR = path.join(DATA_DIR, 'truth');
const COLLEGES_FILE = path.join(DATA_DIR, 'colleges.ndjson');
const OUTPUT_FILE = path.join(DATA_DIR, 'colleges_new.ndjson');

const LINKED_DIR = path.join(TRUTH_DIR, 'linked');

async function loadTruthData() {
    const truthMap = new Map();
    const directories = [TRUTH_DIR, LINKED_DIR];
    
    for (const dir of directories) {
        if (!fs.existsSync(dir)) continue;
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.ndjson'));

        for (const file of files) {
            console.log(`📡 Loading Truth: ${file} (from ${path.basename(dir)})`);
            const content = fs.readFileSync(path.join(dir, file), 'utf8');
            const lines = content.split('\n').filter(l => l.trim());
            
            for (const line of lines) {
                try {
                    const obj = JSON.parse(line);
                    const matchKey = obj.stableKey || obj.name || obj.collegeId; 
                    if (!matchKey) continue;
                    
                    if (!truthMap.has(matchKey)) {
                        truthMap.set(matchKey, {});
                    }
                    
                    const collegeData = truthMap.get(matchKey);
                    const type = obj.entityType;
                    
                    if (type === 'placement') collegeData.placements = obj;
                    else if (type === 'fee') collegeData.fees = obj;
                    else if (type === 'ranking') {
                        if (!collegeData.rankings) collegeData.rankings = [];
                        collegeData.rankings.push(obj);
                    }
                    else if (type === 'course' || type === 'program' || file.includes('courses')) {
                        if (!collegeData.courses) collegeData.courses = [];
                        collegeData.courses.push(obj);
                    }
                    else {
                        collegeData[type] = obj;
                    }
                } catch (e) {
                    console.error(`Error parsing line in ${file}: ${e.message}`);
                }
            }
        }
    }
    return truthMap;
}

async function unifiedIngest() {
    console.log("🚀 Starting Unified Strategic Ingestion (In-Memory)...");
    const truthMap = await loadTruthData();
    console.log(`✅ Loaded ${truthMap.size} truth-verified institutions.`);

    const content = fs.readFileSync(COLLEGES_FILE, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    
    let matchedCount = 0;
    const updatedLines = [];

    for (const line of lines) {
        const college = JSON.parse(line);
        const truthByName = truthMap.get(college.name) || {};
        const truthByKey = truthMap.get(college.stableKey) || {};
        const truth = { ...truthByName, ...truthByKey };

        if (truth && Object.keys(truth).length > 0) {
            matchedCount++;
            // Deep Merge logic
            if (truth.placements) {
                college.placements = { 
                    averagePackage: typeof truth.placements.averageSalary === 'number' 
                        ? (truth.placements.averageSalary / 100000).toFixed(1) + " Lakh" 
                        : (truth.placements.averagePackage || truth.placements.medianSalary || college.placements?.averagePackage),
                    highestPackage: truth.placements.highestPackage > 10000000 
                        ? (truth.placements.highestPackage / 10000000).toFixed(2) + " Crore"
                        : (truth.placements.highestPackage / 100000).toFixed(1) + " Lakh",
                    placedPercentage: truth.placements.placedPercentage || college.placements?.placedPercentage,
                    academicYear: truth.placements.academicYear || truth.placements.session || "2024-25",
                    isVerified: true
                };
                
                // Handle raw numeric medianSalary from NIRF
                if (truth.placements.medianSalary && !college.placements.averagePackage) {
                    const sal = parseInt(truth.placements.medianSalary.toString().replace(/[^0-9]/g, ''));
                    if (!isNaN(sal)) college.placements.averagePackage = (sal / 100000).toFixed(1) + " Lakh";
                }
            }
            if (truth.fees) {
                college.fees = { 
                    tuition: truth.fees.tuitionFee || truth.fees.tuition || college.fees?.tuition,
                    development: truth.fees.developmentFee || truth.fees.development,
                    total: truth.fees.totalFee || truth.fees.total,
                    hostel: truth.fees.hostel || college.fees?.hostel,
                    isVerified: true,
                    session: truth.fees.session || "2024-25"
                };
            }
            if (truth.rankings) {
                const existingSources = new Set((college.rankings || []).map(r => r.source));
                const newRankings = truth.rankings.filter(r => !existingSources.has(r.source));
                college.rankings = [...newRankings, ...(college.rankings || [])];
                college.isCore = true;
            }
            if (truth.courses) {
                college.courses = truth.courses;
            }
            
            college.dataConfidenceScore = 10.0; 
        }
        updatedLines.push(JSON.stringify(college));
    }

    console.log(`🔥 Ingestion Finished! Matched ${matchedCount}/${lines.length} institutions.`);
    fs.writeFileSync(COLLEGES_FILE, updatedLines.join('\n') + '\n');
    console.log("💎 COLLEGES.NDJSON UPDATED SUCCESSFULLY.");
}

unifiedIngest();
