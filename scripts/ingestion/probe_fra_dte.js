// Probe: check FRA truth names vs DTE master list and AICTE catalog
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
require('dotenv').config({ path: 'backend/.env.local' });

function normStr(s) { return (s||'').toLowerCase().replace(/[^a-z0-9]/g, ''); }

function parseCSVLine(line) {
    const result = [];
    let cur = '', inQuotes = false;
    for (const c of line) {
        if (c === '"') inQuotes = !inQuotes;
        else if (c === ',' && !inQuotes) { result.push(cur); cur = ''; }
        else cur += c;
    }
    result.push(cur);
    return result;
}

async function main() {
    // Load FRA truth rows
    const fraRaw = fs.readFileSync('backend/data/truth/maharashtra_fra_2024.ndjson', 'utf8').split('\n').filter(Boolean);
    const fraRows = fraRaw.map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
    console.log(`FRA rows: ${fraRows.length}`);
    console.log('Sample:', JSON.stringify(fraRows[0]));
    
    // Load DTE master
    const dteLines = fs.readFileSync('backend/data/maharashtra_dte_master_list.csv', 'utf8').split('\n').filter(Boolean);
    const dteHeader = parseCSVLine(dteLines[0]);
    console.log('\nDTE Header:', dteHeader);
    
    const dteRows = dteLines.slice(1).map(l => {
        const cols = parseCSVLine(l);
        return { code: cols[0], name: cols[1], city: cols[2], state: cols[3] };
    });
    console.log(`DTE rows: ${dteRows.length}`);
    
    // Check intersection: FRA name → DTE name
    const fraNameSet = new Set(fraRows.map(r => normStr(r.name)));
    const dteMatched = dteRows.filter(d => fraNameSet.has(normStr(d.name)));
    console.log(`\nFRA unique names: ${fraNameSet.size}`);
    console.log(`DTE rows matching FRA names: ${dteMatched.length}`);
    if (dteMatched.length > 0) console.log('Examples:', dteMatched.slice(0,3));

    // Check FRA collegeId → can we find by name in AICTE?
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db('cei_v2');
    const aicteDocs = await db.collection('institutions').find({state_name: 'Maharashtra'}).toArray();
    await client.close();
    
    console.log(`\nAICTE Maharashtra rows: ${aicteDocs.length}`);
    const aicteByNorm = new Map();
    aicteDocs.forEach(c => {
        const n = normStr(c.institution_name);
        if (!aicteByNorm.has(n)) aicteByNorm.set(n, []);
        aicteByNorm.get(n).push({ id: c.institution_id, name: c.institution_name, city: c.district });
    });
    
    let fraMatchedInAICTE = 0;
    fraRows.forEach(r => {
        const n = normStr(r.name);
        if (aicteByNorm.has(n)) fraMatchedInAICTE++;
    });
    console.log(`FRA rows whose name exists in AICTE Maharashtra: ${fraMatchedInAICTE}/${fraRows.length}`);
    
    // Show unmatched samples
    const unmatched = fraRows.filter(r => !aicteByNorm.has(normStr(r.name)));
    console.log('\nFRA unmatched (first 5):');
    unmatched.slice(0,5).forEach(r => console.log(' ', r.collegeId, '|', r.name));
}

main().catch(console.error);
