const fs = require('fs');
const path = require('path');

const modelsDir = path.join(__dirname, '../../../backend/models');
const verifiedPath = path.join(__dirname, '../../../backend/data/verified/verified_fields.ndjson');

async function runAudit() {
    console.log(`[AUDIT] Targeting JSON state files in ${modelsDir}...`);
    
    const files = fs.readdirSync(modelsDir).filter(f => f.endsWith('_Colleges.json'));
    let allColleges = [];
    
    for (const file of files) {
        try {
            const raw = fs.readFileSync(path.join(modelsDir, file), 'utf8').replace(/^\uFEFF/, "");
            if (!raw.trim()) continue;
            
            const data = JSON.parse(raw);
            let list = [];
            if (Array.isArray(data)) list = data;
            else if (data.institutions && Array.isArray(data.institutions)) list = data.institutions;
            else if (data.colleges && Array.isArray(data.colleges)) list = data.colleges;
            else if (typeof data === 'object') {
                const key = Object.keys(data).find(k => Array.isArray(data[k]));
                if (key) list = data[key];
            }
            
            allColleges.push(...list.filter(c => c && (c.id || c.name || c.stableKey)));
        } catch (e) {
            console.error(`Failed to parse ${file}: ${e.message}`);
        }
    }

    // Deduplicate as per services/dataStore.js
    const uniqueMap = new Map();
    allColleges.forEach(c => {
        const cid = String(c.id || c._id || c.stableKey || '');
        if (!cid) return;
        const existing = uniqueMap.get(cid);
        // Keep most complete entry (by courses count or just first)
        if (!existing || (c.courses?.length || 0) > (existing.courses?.length || 0)) {
            uniqueMap.set(cid, c);
        }
    });

    const colleges = Array.from(uniqueMap.values());
    const total = colleges.length;
    console.log(`[AUDIT] Total Unique Colleges Found in JSON fallback: ${total}`);

    // Load Verified Fields (Global state)
    const vfMap = new Map();
    if (fs.existsSync(verifiedPath)) {
        const lines = fs.readFileSync(verifiedPath, 'utf8').split('\n');
        lines.forEach(line => {
            if (line.trim()) {
                try {
                    const vf = JSON.parse(line);
                    if (!vfMap.has(vf.collegeId)) vfMap.set(vf.collegeId, new Set());
                    vfMap.get(vf.collegeId).add(vf.fieldName);
                } catch (e) {}
            }
        });
    }

    const stats = {
        totalColleges: total,
        traversedCount: 0,
        hasAddressText: 0,
        hasAddressLink: 0,
        hasOfficialWebsite: 0,
        hasCutoffs: 0,
        hasFees: 0,
        hasPlacements: 0,
        hasSeats: 0,
        hasCourses: 0,
        hasNIRF: 0,
        hasCore: 0
    };

    colleges.forEach(college => {
        const id = String(college.id || college._id || college.stableKey);
        stats.traversedCount++;

        // 1. Address Text (!!)
        if (college.location || college.address) {
            stats.hasAddressText++;
            // 2. Address Link (Maps)
            stats.hasAddressLink++;
        }

        // 3. Official Website
        if (college.website || college.officialUrl) {
            stats.hasOfficialWebsite++;
        }

        // 4. Core Status
        if (college.isCore || (college.meta && college.meta.ownership?.includes('INI'))) {
            stats.hasCore++;
        }

        // 5. NIRF Ranking
        const hasVisibleNIRF = Array.isArray(college.rankings) && college.rankings.some(r => {
            const isNirfSource = String(r.source || '').toUpperCase().includes('NIRF');
            const hasRank = r.rank !== undefined && r.rank !== null && r.rank !== '';
            return isNirfSource && hasRank;
        });
        if (hasVisibleNIRF) {
            stats.hasNIRF++;
        }

        // 6. TRUTH SECTIONS
        const vfs = vfMap.get(id) || new Set();

        // PLACEMENTS
        const hasPlacements = (college.placements && (college.placements.averagePackage || college.placements.source)) || 
                              vfs.has('avg_package') || 
                              vfs.has('placement_rate');
        if (hasPlacements) stats.hasPlacements++;

        // FEES
        const hasFees = (college.fees && (college.fees.total || college.fees.isVerified)) || 
                        college.tuition || 
                        vfs.has('tuition_fees');
        if (hasFees) stats.hasFees++;

        // SEATS
        if (vfs.has('student_intake')) stats.hasSeats++;

        // COURSES
        if (Array.isArray(college.courses) && college.courses.length > 0) stats.hasCourses++;

        // CUTOFFS
        if ((college.pastCutoffs && college.pastCutoffs.length > 0) || vfs.has('closingRank')) {
            stats.hasCutoffs++;
        }
    });

    const report = {
        denominator: total,
        stats,
        percentages: {}
    };

    Object.keys(stats).forEach(key => {
        if (key !== 'totalColleges' && key !== 'traversedCount') {
            report.percentages[key] = ((stats[key] / total) * 100).toFixed(2) + '%';
        }
    });

    fs.writeFileSync(path.join(__dirname, 'audit_results_final.json'), JSON.stringify(report, null, 2));
    console.log(`[AUDIT] Report generated for ${total} items.`);
}

runAudit();
