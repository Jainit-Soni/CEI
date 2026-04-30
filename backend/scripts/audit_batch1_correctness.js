const axios = require('axios');

async function auditInstitution(id, label) {
    console.log(`\n=== Auditing ${label} (${id}) ===`);
    const baseUrl = 'http://localhost:4000/api';
    const auditStatus = {
        identity: 'PASS',
        placements: 'Checking...',
        fees: 'Checking...',
        rankings: 'Checking...',
        courses: 'Checking...',
        verification: 'Checking...',
        compliance: 'Checking...'
    };

    try {
        // 1. Core Profile Audit (includes placements, fees, rankings, courses)
        const response = await axios.get(`${baseUrl}/college/${id}`);
        const c = response.data.college || response.data;
        
        auditStatus.identity = (c.id === id || c._id === id || c.id === response.data.id) ? 'PASS' : `FAIL (${c.id})`;
        auditStatus.placements = (c.placements && (c.placements.averagePackage || c.placements.averagePackageNumeric)) ? 'PASS' : 'MISSING';
        auditStatus.fees = (c.fees && (c.fees.total || c.fees.totalNumeric)) ? 'PASS' : 'MISSING';
        auditStatus.rankings = (c.rankings && c.rankings.length > 0) ? 'PASS' : 'MISSING';
        auditStatus.courses = (c.courses && c.courses.length > 0) ? 'PASS' : 'MISSING';
        auditStatus.verification = (c.isPremium || c.verificationStatus === 'VERIFIED') ? 'PASS' : `WARN (${c.verificationStatus})`;

        // 2. Truth compliance Audit
        const truthResponse = await axios.get(`${baseUrl}/colleges/${id}/truth/compliance`);
        auditStatus.compliance = (truthResponse.data.items && truthResponse.data.items.length > 0) ? 'PASS' : 'MISSING';

        console.table(auditStatus);
        
        if (auditStatus.compliance === 'PASS') {
            console.log('Compliance Items (Verification Basis):');
            truthResponse.data.items.forEach(it => {
                const audit = it.auditMetadata || {};
                console.log(`  - ${it.displayLabel}: ${it.value} [RAW: ${it.rawValue || 'N/A'}] (${audit.matchBasis || 'direct'})`);
            });
        }
        
        return auditStatus;
    } catch (e) {
        console.error(`Audit Failed: ${e.message}`);
        return null;
    }
}

async function runFullAudit() {
    const targets = [
        { id: 'CORE-IIT-BOMBAY', label: 'IIT Bombay (Flagship)' },
        { id: 'CORE-INDIAN-INSTITUTE-OF-MANAGEMENT-INDORE', label: 'IIM Indore (Medium)' },
        { id: 'CORE-INDIAN-INSTITUTE-OF-INFORMATION-TECHNOLOGY-VADODARA', label: 'IIIT Vadodara (Low)' },
        { id: 'CORE-ALL-INDIA-INSTITUTE-OF-MEDICAL-SCIENCES-NEW-DELHI', label: 'AIIMS Delhi (Medical Spot-check)' }
    ];

    const results = [];
    for (const t of targets) {
        const result = await auditInstitution(t.id, t.label);
        results.push({ label: t.label, ...result });
    }

    const allPassed = results.every(res => 
        Object.values(res).every(val => val === 'PASS' || val.startsWith('WARN'))
    );

    console.log('\n================================================================');
    console.log(allPassed ? '✅ ALL PASS TESTS (CEI Batch 1 Truth Indexing)' : '❌ SOME TESTS FAILED');
    console.log('================================================================\n');
}

runFullAudit();
