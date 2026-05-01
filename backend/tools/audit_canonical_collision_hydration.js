const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const College = require('../models/CollegeSchema');
const identityResolver = require('../lib/collegeIdentityResolver');
const normalizeCollege = require('../lib/collegeNormalizer');

const REPORT_DIR = path.join(__dirname, '../reports/public_cohort_definition');
const REPORT_MD = path.join(REPORT_DIR, 'canonical_collision_audit.md');
const REPORT_CSV = path.join(REPORT_DIR, 'canonical_collision_matrix.csv');

async function runAudit() {
    if (!fs.existsSync(REPORT_DIR)) {
        fs.mkdirSync(REPORT_DIR, { recursive: true });
    }

    console.log('🚀 Starting Canonical Collision Hydration Audit...');
    
    if (mongoose.connection.readyState !== 1) {
        await mongoose.connect('mongodb://localhost:27017/cei_v2');
    }

    const colleges = await College.find({}).lean();
    console.log(`Loaded ${colleges.length} raw records from MongoDB.`);

    const canonicalMap = new Map();

    // Group by canonical ID
    colleges.forEach(c => {
        const norm = normalizeCollege(c);
        const cid = identityResolver.resolveCanonicalId(norm.id || norm.name);
        
        if (!canonicalMap.has(cid)) {
            canonicalMap.set(cid, []);
        }
        canonicalMap.get(cid).push(norm);
    });

    const collisions = [];
    let certifiedOverwriteRiskCount = 0;

    canonicalMap.forEach((records, cid) => {
        if (records.length > 1) {
            let hasCertified = records.some(r => r.surface_tier === 'CERTIFIED_PUBLIC');
            
            // Score records to find the winner (same logic as dataStore.js)
            const scoredRecords = records.map(r => {
                const score = (r.surface_tier === 'CERTIFIED_PUBLIC' ? 100 : 0) + 
                              (r.certified_badge_allowed ? 50 : 0) + 
                              (r.id === cid ? 25 : 0) + 
                              (r.isCore ? 10 : 0) + 
                              ((r.seats && r.seats.length) || 0) + 
                              ((r.cutoffs && r.cutoffs.length) || 0);
                return { record: r, score };
            }).sort((a, b) => b.score - a.score);

            const winner = scoredRecords[0].record;
            const losers = scoredRecords.slice(1).map(x => x.record);

            const lostCertified = losers.some(l => l.surface_tier === 'CERTIFIED_PUBLIC') && winner.surface_tier !== 'CERTIFIED_PUBLIC';
            if (lostCertified) certifiedOverwriteRiskCount++;

            collisions.push({
                canonical_id: cid,
                source_record_count: records.length,
                source_ids: records.map(r => r.id).join(' | '),
                source_names: records.map(r => r.name).join(' | '),
                winning_record_id: winner.id,
                winning_surface_tier: winner.surface_tier || 'NONE',
                losing_record_ids: losers.map(l => l.id).join(' | '),
                lost_surface_tier_risk: lostCertified,
                certified_overwrite_risk: lostCertified,
                recommended_fix: lostCertified ? 'Manual Canonical Target Required' : 'Auto-Merged Safely'
            });
        }
    });

    console.log(`Found ${collisions.length} canonical collisions.`);

    // Write CSV
    let csvContent = 'canonical_id,source_record_count,source_ids,source_names,winning_record_id,winning_surface_tier,losing_record_ids,lost_surface_tier_risk,certified_overwrite_risk,recommended_fix\n';
    collisions.forEach(c => {
        csvContent += `"${c.canonical_id}",${c.source_record_count},"${c.source_ids}","${c.source_names}","${c.winning_record_id}","${c.winning_surface_tier}","${c.losing_record_ids}",${c.lost_surface_tier_risk},${c.certified_overwrite_risk},"${c.recommended_fix}"\n`;
    });
    fs.writeFileSync(REPORT_CSV, csvContent);

    // Write MD
    let mdContent = `# Canonical Collision Hydration Audit\n\n`;
    mdContent += `- Total Raw Records: ${colleges.length}\n`;
    mdContent += `- Total Unique Canonical IDs: ${canonicalMap.size}\n`;
    mdContent += `- Total Collisions (Raw Records resolving to same ID): ${collisions.length}\n`;
    mdContent += `- Certified Overwrite Risks: ${certifiedOverwriteRiskCount}\n\n`;
    mdContent += `## Collision Details\n\n`;
    
    collisions.forEach(c => {
        mdContent += `### ${c.canonical_id}\n`;
        mdContent += `- **Records**: ${c.source_record_count}\n`;
        mdContent += `- **Source IDs**: ${c.source_ids}\n`;
        mdContent += `- **Source Names**: ${c.source_names}\n`;
        mdContent += `- **Winner**: ${c.winning_record_id} (Tier: ${c.winning_surface_tier})\n`;
        mdContent += `- **Losers**: ${c.losing_record_ids}\n`;
        mdContent += `- **Risk**: ${c.certified_overwrite_risk ? '⚠️ CERTIFIED OVERWRITE RISK' : 'Safe'}\n\n`;
    });

    fs.writeFileSync(REPORT_MD, mdContent);
    
    console.log('✅ Audit reports generated.');
    process.exit(0);
}

runAudit().catch(console.error);
