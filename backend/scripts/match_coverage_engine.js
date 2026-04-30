/**
 * match_coverage_engine.js — CEI Match Coverage Engine (Phase 24)
 */

const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const TRUTH_DIR = path.join(__dirname, '../data/truth');

function normalizeName(name) {
    if (!name) return '';
    let n = name.replace(/\([^)]*\)/g, '');
    n = n.replace(/\b\d{6}\b/g, '');
    n = n.split(',')[0].split(' - ')[0];

    return n.toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .replace(/\bcollegeof\b/g, '')
        .replace(/\binstituteof\b/g, '')
        .replace(/\bprivate\b/g, '')
        .replace(/\bautonomous\b/g, '')
        .trim();
}

function extractStateFromSource(source) {
    const map = {
        'APSCHE': 'andhra pradesh',
        'TSCHE': 'telangana',
        'AFRC UP': 'uttar pradesh',
        'AFRC MP': 'madhya pradesh',
    };
    if (!source) return null;
    for (const [key, state] of Object.entries(map)) {
        if (source.includes(key)) return state;
    }
    return null;
}

async function run() {
    await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
    const db = mongoose.connection.db;

    const institutions = await db.collection('institutions').find({}).toArray();
    
    const dbByName = new Map();
    institutions.forEach(inst => {
        const nn = normalizeName(inst.name || inst.institution_name);
        if (!dbByName.has(nn)) dbByName.set(nn, []);
        dbByName.get(nn).push(inst);
    });

    const rawLines = fs.readFileSync(path.join(TRUTH_DIR, 'pan_india_bulk_2024.ndjson'), 'utf8').split('\n').filter(l => l.trim());
    const records = rawLines.map(l => JSON.parse(l));

    const logs = [];
    const unmatched = [];
    let matchedCount = 0;

    records.forEach(record => {
        const rawName = record.name;
        const nn = normalizeName(rawName);
        const recordState = extractStateFromSource(record.source);

        let match = null;
        let strategy = null;
        let reason = 'no match';

        if (dbByName.has(nn)) {
            const matches = dbByName.get(nn);
            if (matches.length === 1) {
                match = matches[0];
                strategy = 'name_unique';
            } else if (recordState) {
                const stateMatch = matches.find(m => m.state && m.state.toLowerCase() === recordState);
                if (stateMatch) {
                    match = stateMatch;
                    strategy = 'name_state_disambiguated';
                } else {
                    reason = `collision (${matches.length} hits), state mismatch (${recordState})`;
                }
            } else {
                reason = `collision (${matches.length} hits), no state info`;
            }
        }

        if (match) {
            matchedCount++;
            logs.push({ raw_name: rawName, status: 'matched', match_id: match.institution_id, strategy: strategy });
        } else {
            logs.push({ raw_name: rawName, status: 'not matched', reason: reason });
            unmatched.push({ name: rawName, reason: reason });
        }
    });

    const report = {
        summary: {
            total_records: records.length,
            matched_count: matchedCount,
            matched_percent: ((matchedCount / records.length) * 100).toFixed(2) + '%'
        },
        logs: logs
    };

    fs.writeFileSync(path.join(TRUTH_DIR, 'match_report.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(TRUTH_DIR, 'unmatched_candidates.json'), JSON.stringify(unmatched.slice(0, 100), null, 2));

    console.log(`Matched: ${matchedCount} (${report.summary.matched_percent})`);
    process.exit(0);
}

run().catch(console.error);
