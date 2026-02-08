const fs = require('fs');
const path = require('path');

const COLLEGES_FILE = path.join(__dirname, 'backend/models/Maharashtra_Colleges.json');

function loadJson(file) {
    if (!fs.existsSync(file)) return [];
    const content = fs.readFileSync(file, 'utf8');
    const cleanContent = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
    return JSON.parse(cleanContent);
}

function saveJson(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function enrich() {
    console.log("🚀 Starting Maharashtra Batch 2 Enrichment (The Next Layer)...");

    const colleges = loadJson(COLLEGES_FILE);
    let updatedCount = 0;

    const updates = {
        // KJ Somaiya (Vidyavihar)
        "k-j-somaiya-college-of-engineering-mumbai": {
            pastCutoffs: [
                { examId: "mht-cet", year: "2024", cutoff: "CSE: 97.50 | IT: 96.80 | EnTC: 95.10", source: "CAP Round 1" },
                { examId: "jee-main", year: "2024", cutoff: "CSE: ~96.20 percentile", source: "Official" }
            ],
            rankingTier: "Tier 1.5",
            acceptedExams: ["mht-cet", "jee-main", "peracet", "cuet"]
        },

        // VIIT Pune
        "vishwakarma-institute-of-infor-pune": {
            pastCutoffs: [
                { examId: "mht-cet", year: "2024", cutoff: "CSE: 95.36 | IT: 94.80 | AI-DS: 93.50", source: "CAP Round 2" }
            ],
            rankingTier: "Tier 2",
            acceptedExams: ["mht-cet", "jee-main"]
        },

        // Thadomal Shahani (Bandra)
        "thadomal-shahani-engineering-c-mumbai": {
            pastCutoffs: [
                { examId: "mht-cet", year: "2024", cutoff: "CSE: 96.24 | IT: 95.50 | AI-DS: 94.80", source: "CAP Round 1" }
            ],
            rankingTier: "Tier 2",
            acceptedExams: ["mht-cet", "jee-main"]
        },

        // Fr. CRCE (Bandra)
        "fr-conceicao-rodrigues-college-mumbai": {
            pastCutoffs: [
                { examId: "mht-cet", year: "2024", cutoff: "CSE: 96.34 | AI-DS: 94.50 | ECS: 91.20", source: "CAP Round 1" },
                { examId: "jee-main", year: "2024", cutoff: "CSE: ~95.32 percentile", source: "Official" }
            ],
            rankingTier: "Tier 2",
            acceptedExams: ["mht-cet", "jee-main"]
        },

        // RAIT (Nerul) -> Now D.Y. Patil Deemed? Often still takes CET scores for some seats or has legacy data
        "ramrao-adik-institute-of-techn-navi-mumbai": {
            pastCutoffs: [
                { examId: "mht-cet", year: "2024", cutoff: "CSE: 95.07 | IT: 93.50", source: "CAP Round 1" }
            ],
            rankingTier: "Tier 2",
            acceptedExams: ["mht-cet", "jee-main"]
        },

        // Cummins Pune (Women) - Need to find exact ID, trying loose match logic below if exact key fails
        "cummins-college-of-engineering-for-women-pune": { // Guesstimated ID
            pastCutoffs: [
                { examId: "mht-cet", year: "2024", cutoff: "CSE: 96.37 | IT: 95.80 | EnTC: 92.50", source: "CAP Round 1" }
            ],
            rankingTier: "Tier 2",
            type: "Private (Women)",
            acceptedExams: ["mht-cet", "jee-main"]
        }
    };

    // Helper to find ID if not exact
    const findId = (namePart) => colleges.find(c => c.name.toLowerCase().includes(namePart.toLowerCase()) || (c.shortName && c.shortName.toLowerCase().includes(namePart.toLowerCase())));

    // Pre-resolve ambiguous IDs
    const cummins = findId("Cummins");
    if (cummins) {
        if (!updates[cummins.id]) {
            updates[cummins.id] = updates["cummins-college-of-engineering-for-women-pune"];
        }
    }

    for (const college of colleges) {
        if (updates[college.id]) {
            console.log(`[+] Enriching: ${college.name} (${college.id})`);
            Object.assign(college, updates[college.id]);
            updatedCount++;
        }
    }

    if (updatedCount > 0) {
        saveJson(COLLEGES_FILE, colleges);
        console.log(`\n✅ Successfully enriched ${updatedCount} colleges in Batch 2.`);
    } else {
        console.log("\n⚠️ No colleges updated. IDs might need fuzzy matching.");
    }
}

enrich();
