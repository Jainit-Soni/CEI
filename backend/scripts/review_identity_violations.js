/**
 * backend/scripts/review_identity_violations.js
 * ==============================================
 * Reviews the identity_violations collection to identify missing CORE institutions.
 * Provides suggestions for registry addition based on frequency and status.
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

async function reviewViolations() {
    try {
        console.log('Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;
        const violations = db.collection('identity_violations');

        console.log('\n--- IDENTITY QUARANTINE REVIEW ---');
        
        const report = await violations.find({}).sort({ frequency: -1 }).toArray();
        
        if (report.length === 0) {
            console.log('✅ No identity violations in quarantine. System clean.');
            process.exit(0);
        }

        console.log(`Found ${report.length} unique institutions in quarantine.\n`);
        console.log('Rank | Score | Freq | Raw Name | State | Suggested ID');
        console.log('-----|-------|------|----------|-------|--------------');

        report.forEach((v, index) => {
            const suggestedId = `CORE-${v.normalized_name.toUpperCase()}`;
            const scoreStr = v.approval_score >= 80 ? `🔥 ${v.approval_score}` : v.approval_score;
            
            console.log(`${(index + 1).toString().padEnd(4)} | ${scoreStr.toString().padEnd(5)} | ${v.frequency.toString().padEnd(4)} | ${v.raw_input.toString().padEnd(30).substring(0, 30)} | ${v.state || 'N/A'} | ${suggestedId}`);
        });

        console.log('\n--- RECOMMENDATIONS ---');
        const autoAddList = report.filter(v => v.approval_score >= 80);
        if (autoAddList.length > 0) {
            console.log(`ACTION REQUIRED: ${autoAddList.length} institutions meet auto-approval threshold.`);
            console.log('Please run the registry sync script to ingest these into identity_registry.json.');
        } else {
            console.log('STASIS: No institutions meet the auto-approval threshold yet.');
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

reviewViolations();
