const fs = require('fs');
const path = require('path');

const COLLEGES_FILE = path.join(__dirname, '..', 'data', 'colleges.ndjson');

async function nirfPDFScavenge() {
    console.log("🌊 Starting NIRF HIGH-FIDELITY PDF SCAVENGE (Phase 10.1)...");

    const lines = fs.readFileSync(COLLEGES_FILE, 'utf8').split('\n').filter(l => l.trim());
    const candidates = [];

    for (const line of lines) {
        const college = JSON.parse(line);
        if (!college.isCore) continue;
        
        const aid = college.aisheCode;
        if (!aid) continue;

        // Pattern Mapping: IR-[Type]-[Sub]-[ID]
        // U-XXXX -> IR-O-U-XXXX
        // C-XXXX -> IR-O-C-XXXX
        // S-XXXX -> IR-O-S-XXXX
        let type = aid.split('-')[0];
        let code = aid.split('-')[1];
        
        // NIRF uses IR-O (Overall) for most reports
        const nirfId = `IR-O-${type}-${code}`;
        const pdfUrl = `https://www.nirfindia.org/2024/Declaration/Agreement/DownloadPDF?CollegeCode=${nirfId}`;
        
        candidates.push({ name: college.name, aid, nirfId, pdfUrl });
    }

    console.log(`📡 Identified ${candidates.length} candidate reports for automated verification.`);
    
    // Save to a work file for the scavenger
    fs.writeFileSync('nirf_scavenge_worklist.json', JSON.stringify(candidates, null, 2));
    console.log("✅ Worklist generated: nirf_scavenge_worklist.json");
    
    // Test the top 5
    console.log("\n📋 Sample URLs for Validation:");
    candidates.slice(0, 5).forEach(c => console.log(`- ${c.name}: ${c.pdfUrl}`));
}

nirfPDFScavenge().catch(console.error);
