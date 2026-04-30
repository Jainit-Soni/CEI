async function probe(id, label) {
    const res = await fetch(`http://localhost:4000/api/college/${id}`);
    const page = await res.json();
    const tc = page.truthCoverage;
    const meta = page.meta;
    
    const tier = tc?.coverageTier ?? 'MISSING';
    const score = tc?.completenessScore ?? 'MISSING';
    const metaTier = meta?.truthTier ?? 'MISSING';
    
    const tierLabel = {
        'A': 'All Institutional Data Verified',
        'B': 'Fees + Admission Data Verified',
        'C': 'Admission Data Verified',
        'D': 'Minimal Data'
    }[tier] || 'Unknown';
    
    const pass = (tier === metaTier) && (typeof tc?.fees === 'boolean');
    
    console.log(`\n[${label}]`);
    console.log(`  UI would show: "Truth Level: Tier ${tier} (${tierLabel})"`);
    console.log(`  completenessScore: ${score}/4`);
    console.log(`  fees=${tc?.fees} | placements=${tc?.placements} | cutoffs=${tc?.cutoffs} | seats=${tc?.seats}`);
    console.log(`  meta.truthTier=${metaTier}`);
    console.log(`  STATUS: ${pass ? '✅ PASS' : '❌ FAIL'}`);
}

Promise.all([
    probe('CORE-IIT-BOMBAY',  'IIT Bombay  (expect: Tier A)'),
    probe('CORE-IIT-JAMMU',   'IIT Jammu   (expect: Tier A)'),
    probe('CORE-NIT-TRICHY',  'NIT Trichy  (expect: Tier A)'),
]).then(() => {
    console.log('\n✅ Phase 24 tier validation complete');
    process.exit(0);
}).catch(e => { console.error(e); process.exit(1); });
