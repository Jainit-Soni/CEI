const fs = require('fs');
const path = require('path');

const COLLEGES_FILE = path.join(__dirname, 'backend/models/Gujarat_Colleges.json');

function loadJson(file) {
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveJson(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function enrich() {
    console.log("💎 Starting Gujarat Pilot Enrichment...");

    const colleges = loadJson(COLLEGES_FILE);
    let updatedCount = 0;

    const updates = {
        "gec-bhuj": {
            pastCutoffs: [
                { examId: "gujcet", year: "2024", cutoff: "Civil: 37067 | Mech: 38617 | Elec: 38781 | Chem: 50012 | Min: 36497", source: "ACPC 2024" },
                { examId: "jee-main", year: "2024", cutoff: "Check official website", source: "Official" }
            ],
            rankingTier: "Tier 2", // Upgrading based on Govt status
            acceptedExams: ["gujcet", "jee-main"]
        },
        "adani-uni-ahmedabad": {
            pastCutoffs: [
                { examId: "gujcet", year: "2024", cutoff: "ICT: 8940 | CSE(AI/ML): 5674", source: "ACPC 2024" },
                { examId: "jee-main", year: "2024", cutoff: "ICT: 8940", source: "Official" }
            ],
            // Correcting courses based on data found
            courses: [
                { name: "B.Tech ICT", degree: "B.Tech", duration: "4 years", exams: ["gujcet", "jee-main"] },
                { name: "B.Tech CSE (AI/ML)", degree: "B.Tech", duration: "4 years", exams: ["gujcet", "jee-main"] }
            ]
        }
    };

    for (const college of colleges) {
        if (updates[college.id]) {
            console.log(`[+] Enriching: ${college.name} (${college.id})`);
            Object.assign(college, updates[college.id]);
            updatedCount++;
        }
    }

    if (updatedCount > 0) {
        saveJson(COLLEGES_FILE, colleges);
        console.log(`\n✅ Successfully enriched ${updatedCount} colleges with 2024 data.`);
    } else {
        console.log("\n⚠️ Colleges not found for enrichment.");
    }
}

enrich();
