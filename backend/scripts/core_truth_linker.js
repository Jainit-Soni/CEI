const fs = require('fs');
const path = require('path');

const COLLEGES_FILE = path.join(__dirname, '..', 'data', 'colleges.ndjson');
const TRUTH_DIR = path.join(__dirname, '..', 'data', 'truth');

// --- Fuzzy Name Normalizer ---
function normalize(name) {
    return (name || '')
        .toLowerCase()
        .replace(/\binstitute\b/g, 'inst')
        .replace(/\btechnology\b/g, 'tech')
        .replace(/\buniversity\b/g, 'uni')
        .replace(/\bindian\b/g, 'ind')
        .replace(/[^a-z0-9 ]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function fuzzyMatch(a, b) {
    const na = normalize(a), nb = normalize(b);
    if (na === nb) return 1.0;
    if (na.includes(nb) || nb.includes(na)) return 0.9;
    // Token overlap
    const ta = new Set(na.split(' ')), tb = new Set(nb.split(' '));
    const intersection = [...ta].filter(x => tb.has(x)).length;
    const union = new Set([...ta, ...tb]).size;
    return intersection / union;
}

// --- Load all truth sources ---
function loadTruth(filename) {
    const fp = path.join(TRUTH_DIR, filename);
    if (!fs.existsSync(fp)) return [];
    return fs.readFileSync(fp, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l); } catch(e) { return null; } }).filter(Boolean);
}

async function coreTruthLinker() {
    console.log('🌊 Starting CORE TRUTH MULTI-LINKER...\n');

    // Load all truth payloads
    const rankings    = loadTruth('core_rankings_nirf_v2.ndjson');
    const placements  = loadTruth('core_placements_v2.ndjson');
    const nirfExpand  = loadTruth('nirf_expanded_2024_v1.ndjson');
    const fees        = loadTruth('core_fees_v2.ndjson');
    const metadata    = loadTruth('core_metadata_v2.ndjson');

    console.log(`📦 Loaded truth payloads:`);
    console.log(`   Rankings: ${rankings.length} | Placements: ${placements.length} | NIRF Expanded: ${nirfExpand.length}`);
    console.log(`   Fees: ${fees.length} | Metadata: ${metadata.length}\n`);

    const lines = fs.readFileSync(COLLEGES_FILE, 'utf8').split('\n').filter(Boolean);
    const output = [];
    const stats = { rankings: 0, placements: 0, fees: 0, metadata: 0, medianSalary: 0 };
    const THRESHOLD = 0.65;

    for (const line of lines) {
        let college;
        try { college = JSON.parse(line); } catch(e) { output.push(line); continue; }

        const cName = college.name || '';

        // --- 1. RANKINGS (NIRF 2024) ---
        const matchedRankings = rankings.filter(r => fuzzyMatch(cName, r.name) >= THRESHOLD);
        if (matchedRankings.length > 0) {
            college.rankings = matchedRankings.map(r => ({
                rank: r.rank,
                category: r.category,
                year: r.year,
                score: r.score,
                source: r.source || 'NIRF 2024'
            }));
            college.dataConfidenceScore = Math.min((college.dataConfidenceScore || 20) + 10, 100);
            stats.rankings++;
        }

        // --- 2. PLACEMENTS (Official Annual Reports) ---
        const placMatch = placements.find(p => fuzzyMatch(cName, p.name) >= THRESHOLD);
        if (placMatch) {
            college.placements = {
                averagePackage: `${placMatch.averagePackage} LPA`,
                averagePackageNumeric: placMatch.averagePackage * 100000,
                highestPackage: `${placMatch.highestPackage} LPA`,
                highestPackageNumeric: placMatch.highestPackage * 100000,
                placedPercentage: placMatch.placedPercentage,
                academicYear: placMatch.academicYear,
                source: placMatch.source
            };
            college.dataConfidenceScore = Math.min((college.dataConfidenceScore || 20) + 10, 100);
            stats.placements++;
        }

        // --- 3. MEDIAN SALARY (NIRF Expanded — ₹ absolute) ---
        const nirfMatch = nirfExpand.find(n => n.stableKey === college.stableKey || fuzzyMatch(cName, n.name) >= THRESHOLD);
        if (nirfMatch && nirfMatch.medianSalary) {
            if (!college.placements) college.placements = {};
            college.placements.medianSalaryLPA = +(nirfMatch.medianSalary / 100000).toFixed(2);
            college.placements.medianSalarySource = nirfMatch.source || 'NIRF 2024';
            if (nirfMatch.lat && !college.coordinates) {
                college.coordinates = { lat: nirfMatch.lat, lng: nirfMatch.lng };
            }
            stats.medianSalary++;
        }

        // --- 4. FEES (Official Fee Circulars) ---
        const feeMatch = fees.find(f => fuzzyMatch(cName, f.name) >= THRESHOLD);
        if (feeMatch) {
            college.fees = {
                total: `₹${feeMatch.totalFee?.toLocaleString('en-IN')} INR`,
                totalNumeric: feeMatch.totalFee,
                hostel: feeMatch.hostelFees ? `₹${feeMatch.hostelFees?.toLocaleString('en-IN')} INR` : null,
                hostelNumeric: feeMatch.hostelFees,
                session: feeMatch.session || '2024-25',
                source: feeMatch.source,
                isVerified: true,
                isSlabEstimate: false
            };
            college.dataConfidenceScore = Math.min((college.dataConfidenceScore || 20) + 10, 100);
            stats.fees++;
        }

        // --- 5. METADATA (NAAC, Phone, Exams) ---
        const metaMatch = metadata.find(m => fuzzyMatch(cName, m.name) >= THRESHOLD);
        if (metaMatch) {
            if (metaMatch.accreditation) {
                college.accreditation = metaMatch.accreditation;
            }
            if (metaMatch.admissionExams) {
                college.admissionExams = metaMatch.admissionExams;
            }
            if (metaMatch.phone && !college.phone) {
                college.phone = metaMatch.phone;
            }
            if (metaMatch.totalSeats) {
                college.totalSeats = metaMatch.totalSeats;
            }
            college.dataConfidenceScore = Math.min((college.dataConfidenceScore || 20) + 10, 100);
            stats.metadata++;
        }

        output.push(JSON.stringify(college));
    }

    fs.writeFileSync(COLLEGES_FILE, output.join('\n') + '\n');

    console.log('✅ CORE TRUTH LINKER COMPLETE:');
    console.log(`   🏆 Rankings attached   : ${stats.rankings} institutions`);
    console.log(`   💼 Placements attached : ${stats.placements} institutions`);
    console.log(`   📊 Median Salary sync  : ${stats.medianSalary} institutions`);
    console.log(`   💰 Verified Fees       : ${stats.fees} institutions (replacing slab estimates!)`);
    console.log(`   🎓 NAAC/Metadata sync  : ${stats.metadata} institutions`);
}

coreTruthLinker().catch(console.error);
