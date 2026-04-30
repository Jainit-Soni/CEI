const fs = require('fs');
const path = require('path');
const readline = require('readline');
const identityResolver = require('../lib/identityResolver');

const DATA_DIR = path.join(__dirname, '..', 'data');
const TRUTH_DIR = path.join(DATA_DIR, 'truth');
const COLLEGES_FILE = path.join(DATA_DIR, 'colleges_new.ndjson');
const OUTPUT_FILE = path.join(DATA_DIR, 'colleges_new.ndjson');

const LINKED_DIR = path.join(TRUTH_DIR, 'linked');

const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

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
                    let matchKey = obj.stableKey || obj.collegeId || obj.id; 
                    let nameKey = norm(obj.name);
                    
                    const keysToSet = [];
                    if (matchKey) keysToSet.push(matchKey);
                    if (nameKey) keysToSet.push(nameKey);
                    
                    for (const key of keysToSet) {
                        if (!truthMap.has(key)) truthMap.set(key, {});
                        const collegeData = truthMap.get(key);
                        const type = obj.entityType;
                        
                        if (type === 'placement') collegeData.placements = obj;
                        else if (type === 'fees' || type === 'fee') collegeData.fees = obj;
                        else if (type === 'metadata') { Object.assign(collegeData, { metadata: obj }); }
                        else if (type === 'ranking') {
                            if (!collegeData.rankings) collegeData.rankings = [];
                            collegeData.rankings.push(obj);
                        }
                        else if (type === 'course' || type === 'program' || file.includes('courses')) {
                            if (!collegeData.courses) collegeData.courses = [];
                            collegeData.courses.push(obj);
                        }
                        else if (type === 'website') collegeData.website = obj;
                        else if (type === 'location' || type === 'coordinates') collegeData.location = obj;
                        else if (type === 'latent_contact') {
                            if (!collegeData.latentContacts) collegeData.latentContacts = [];
                            collegeData.latentContacts.push(obj);
                        }
                        else {
                            collegeData[type] = obj;
                        }
                    }
                } catch (e) {
                    console.error(`Error parsing line in ${file}: ${e.message}`);
                }
            }
        }
    }
    return truthMap;
}

// Helper to extract number from "X Lakh" or "Y Crore"
function parsePackage(val) {
    if (!val) return 0;
    if (typeof val === 'number') return val;
    val = val.toString().toLowerCase();
    const num = parseFloat(val.replace(/[^0-9.]/g, ''));
    if (isNaN(num)) return 0;
    if (val.includes('crore')) return Math.round(num * 10000000);
    if (val.includes('lakh')) return Math.round(num * 100000);
    return num;
}

async function unifiedIngest() {
    console.log("🚀 Starting Unified Strategic Ingestion (Normalized Matching)...");
    const truthMap = await loadTruthData();
    console.log(`✅ Loaded ${truthMap.size} unique keys in truthMap.`);

    const content = fs.readFileSync(COLLEGES_FILE, 'utf8');
    const lines = content.split('\n').filter(l => l.trim());
    
    let matchedCount = 0;
    const updatedLines = [];

    for (const line of lines) {
        let college;
        try { college = JSON.parse(line); } catch(e) { updatedLines.push(line); continue; }

        const cid = identityResolver.resolveId(college.stableKey) || 
                    identityResolver.resolveId(college.id) || 
                    identityResolver.resolveId(college.name);

        const truthByName = truthMap.get(norm(college.name)) || {};
        const truthByKey = truthMap.get(college.stableKey) || {};
        const truthById = truthMap.get(college.id) || {};
        const truthByAishe = truthMap.get(college.aisheCode) || {};
        const truthByCid = cid ? (truthMap.get(cid) || {}) : {};

        const truth = { ...truthByName, ...truthByKey, ...truthById, ...truthByAishe, ...truthByCid };

        // Precedence Check: If CID match exists, it should be the primary source of truth
        if (cid && truthByCid && Object.keys(truthByCid).length > 0) {
            // Strategic overwrite: Ensure CORE enrichment wins over stale catalog fallbacks
            Object.assign(truth, truthByCid);
        }

        if (truth && Object.keys(truth).length > 0) {
            matchedCount++;
            
            // 1. Placements (With Numeric Normalization)
            if (truth.placements) {
                const avg = truth.placements.averageSalary || truth.placements.averagePackage || college.placements?.averagePackage;
                const high = truth.placements.highestPackage || college.placements?.highestPackage;
                
                college.placements = {
                    averagePackage: typeof avg === 'number' && avg > 1000 ? (avg/100000).toFixed(1) + " Lakh" : avg,
                    averagePackageNumeric: parsePackage(avg),
                    highestPackage: typeof high === 'number' && high > 1000 ? 
                        (high > 10000000 ? (high/10000000).toFixed(2) + " Crore" : (high/100000).toFixed(1) + " Lakh") : high,
                    highestPackageNumeric: parsePackage(high),
                    placedPercentage: truth.placements.placedPercentage || college.placements?.placedPercentage,
                    academicYear: truth.placements.academicYear || truth.placements.session || "2024-25",
                    isVerified: true
                };

                // Ingest GPS from placement reports (NIRF often includes exact location)
                if (truth.placements.lat && truth.placements.lng) {
                    college.coordinates = {
                        lat: parseFloat(truth.placements.lat),
                        lng: parseFloat(truth.placements.lng)
                    };
                }
            }

            // 2. Fees (With Numeric Normalization)
            if (truth.fees) {
                const total = truth.fees.totalFee || truth.fees.total || college.fees?.total;
                college.fees = { 
                    tuition: truth.fees.tuitionFee || truth.fees.tuition || college.fees?.tuition,
                    development: truth.fees.developmentFee || truth.fees.development,
                    total: typeof total === 'number' ? `₹${total.toLocaleString('en-IN')} INR` : total,
                    totalNumeric: typeof total === 'number' ? total : parsePackage(total),
                    hostel: truth.fees.hostel || college.fees?.hostel,
                    isVerified: true,
                    session: truth.fees.session || "2024-25"
                };
            }

            // 3. Rankings
            if (truth.rankings) {
                const existingSources = new Set((college.rankings || []).map(r => r.source));
                const newRankings = truth.rankings.filter(r => !existingSources.has(r.source));
                college.rankings = [...newRankings, ...(college.rankings || [])];
                college.isCore = true;
            }

            // 4. Metadata (Established, Accreditation, Website)
            if (truth.metadata) {
                const meta = truth.metadata;
                if (meta.established) college.established = meta.established;
                if (meta.accreditation) college.accreditation = { ...college.accreditation, ...meta.accreditation };
                if (meta.website && meta.website.length > 5) college.website = meta.website;
                if (meta.phone) college.phone = meta.phone;
                if (meta.email) college.email = meta.email;
                if (meta.totalSeats) college.totalSeats = meta.totalSeats;
                if (meta.admissionExams) college.admissionExams = meta.admissionExams;
                if (meta.coreTier) {
                    college.isCore = true;
                    college.rankingTier = meta.coreTier === 1 ? 'Tier 1' : 'Tier 2';
                }
            }

            // 5. Explicit Website Truth (Overwrite with verified info)
            if (truth.website) {
                let w = truth.website.website || truth.website;
                if (typeof w === 'object') w = w.website;
                if (w && w.length > 5) college.website = w;
            }

            // 6. Coordinates / Location
            if (truth.location) {
                college.coordinates = {
                    lat: parseFloat(truth.location.lat || truth.location.latitude || college.coordinates?.lat),
                    lng: parseFloat(truth.location.lng || truth.location.longitude || college.coordinates?.lng)
                };
            }

            // 6b. Latent Contacts (Phone/Email from bulk orders)
            if (truth.latentContacts && truth.latentContacts.length > 0) {
                const latest = truth.latentContacts[truth.latentContacts.length - 1];
                if (latest.phone && !college.phone) college.phone = latest.phone;
                if (latest.email && !college.email) college.email = latest.email;
                if (latest.website && !college.website) college.website = latest.website;
            }

            // 7. Courses
            if (truth.courses) {
                college.courses = truth.courses;
            }
            
            // Recompute real confidence score
            let score = 0;
            if (college.placements?.averagePackageNumeric > 0) score += 25;
            if (college.fees?.totalNumeric > 0) score += 20;
            if (college.rankings?.length > 0) score += 20;
            if (college.website && college.website.length > 5) score += 10;
            if (college.courses?.length > 0) score += 10;
            if (college.coordinates?.lat && college.coordinates?.lng) score += 5; // GPS weight
            if (college.established) score += 5;
            if (college.accreditation?.naac || college.accreditation?.naacScore) score += 5;
            if (college.phone || college.email) score += 5;
            college.dataConfidenceScore = Math.min(100, score);
        }
        updatedLines.push(JSON.stringify(college));
    }

    console.log(`🔥 Ingestion Finished! Matched ${matchedCount}/${lines.length} institutions.`);
    fs.writeFileSync(COLLEGES_FILE, updatedLines.join('\n') + '\n');
    console.log("💎 COLLEGES.NDJSON UPDATED SUCCESSFULLY.");
}

unifiedIngest().catch(console.error);



