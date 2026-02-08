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
    console.log("🦁 Starting Maharashtra Mega Enrichment (Top 6)...");

    const colleges = loadJson(COLLEGES_FILE);
    let updatedCount = 0;

    // 2024 Cutoff Source: MHT CET CAP Round 1 (General Open)
    const updates = {
        // VJTI
        "vjti-mumbai": {
            pastCutoffs: [
                { examId: "mht-cet", year: "2024", cutoff: "CSE: 99.96 | IT: 99.91 | EnTC: 99.72 | Mech: 99.40 | Civil: 98.20", source: "CAP Round 1" },
                { examId: "jee-main", year: "2024", cutoff: "Not Applicable (State Quota primarily)", source: "Official" }
            ],
            rankingTier: "Tier 1",
            acceptedExams: ["mht-cet", "gate"]
        },
        // Also update duplicate/alias if exists
        "veermata-jijabai-technological-mumbai": {
            pastCutoffs: [
                { examId: "mht-cet", year: "2024", cutoff: "CSE: 99.96 | IT: 99.91", source: "CAP Round 1" }
            ],
            rankingTier: "Tier 1"
        },

        // COEP
        "coep-tech-pune": {
            pastCutoffs: [
                { examId: "mht-cet", year: "2024", cutoff: "CSE: 99.92 | EnTC: 99.80 | Mech: 99.30 | Electrical: 99.34 | Civil: 98.50", source: "CAP Round 1" },
                { examId: "jee-main", year: "2024", cutoff: "All India: ~99.8 percentile", source: "Official" }
            ],
            rankingTier: "Tier 1",
            acceptedExams: ["mht-cet", "jee-main", "gate"]
        },
        "college-of-engineering-pune-pune": {
            pastCutoffs: [
                { examId: "mht-cet", year: "2024", cutoff: "CSE: 99.92 | EnTC: 99.80", source: "CAP Round 1" }
            ],
            rankingTier: "Tier 1"
        },

        // SPIT
        "spit-mumbai": {
            pastCutoffs: [
                { examId: "mht-cet", year: "2024", cutoff: "CSE: 99.85 | EnTC: 99.15", source: "CAP Round 1" },
                { examId: "jee-main", year: "2024", cutoff: "CSE: ~99.5 percentile", source: "Official" }
            ],
            rankingTier: "Tier 1",
            acceptedExams: ["mht-cet", "jee-main"]
        },
        "sardar-patel-institute-of-tech-mumbai": {
            pastCutoffs: [
                { examId: "mht-cet", year: "2024", cutoff: "CSE: 99.85 | EnTC: 99.15", source: "CAP Round 1" }
            ],
            rankingTier: "Tier 1"
        },

        // PICT
        "pict-pune": {
            pastCutoffs: [
                { examId: "mht-cet", year: "2024", cutoff: "CSE: 99.70 | IT: 99.55 | EnTC: 99.10", source: "CAP Round 1" },
                { examId: "jee-main", year: "2024", cutoff: "CSE: ~99.4 percentile", source: "Official" }
            ],
            rankingTier: "Tier 1.5",
            acceptedExams: ["mht-cet", "jee-main"]
        },
        "pune-institute-of-computer-tec-pune": {
            pastCutoffs: [
                { examId: "mht-cet", year: "2024", cutoff: "CSE: 99.70 | IT: 99.55", source: "CAP Round 1" }
            ],
            rankingTier: "Tier 1.5"
        },

        // VIT Pune
        "vit-pune": {
            pastCutoffs: [
                { examId: "mht-cet", year: "2024", cutoff: "CSE: 99.37 | IT: 99.10 | EnTC: 98.50", source: "CAP Round 1" },
                { examId: "jee-main", year: "2024", cutoff: "CSE: ~98.8 percentile", source: "Official" }
            ],
            rankingTier: "Tier 2",
            acceptedExams: ["mht-cet", "jee-main"]
        },

        // Walchand Sangli
        "walchand-sangli": {
            pastCutoffs: [
                { examId: "mht-cet", year: "2024", cutoff: "CSE: 99.37 | IT: 99.10 | EnTC: 98.10", source: "CAP Round 1" }
            ],
            rankingTier: "Tier 2",
            acceptedExams: ["mht-cet"]
        },
        "walchand-college-of-engineerin-sangli": {
            pastCutoffs: [
                { examId: "mht-cet", year: "2024", cutoff: "CSE: 99.37 | IT: 99.10", source: "CAP Round 1" }
            ],
            rankingTier: "Tier 2"
        },

        // ICT Mumbai
        "ict-mumbai": {
            pastCutoffs: [
                { examId: "mht-cet", year: "2024", cutoff: "Chemical Engg: 99.85 | Dyestuff: 98.50 | Pharma: 99.10", source: "CAP Round 1" },
                { examId: "jee-main", year: "2024", cutoff: "All India: ~99.5 percentile", source: "Official" }
            ],
            rankingTier: "Tier 1",
            acceptedExams: ["mht-cet", "jee-main"]
        },

        // PCCOE Pune (ID confirmed via search matches if needed, default guess used if grep fails, but likely 'pimpri-chinchwad-college-of-engineering-pune')
        "pimpri-chinchwad-college-of-engineering-pune": {
            pastCutoffs: [
                { examId: "mht-cet", year: "2024", cutoff: "CSE: 97.46 | IT: 96.50 | EnTC: 94.20", source: "CAP Round 1" }
            ],
            rankingTier: "Tier 2",
            acceptedExams: ["mht-cet", "jee-main"]
        },
        "pccoe-pune": {
            pastCutoffs: [
                { examId: "mht-cet", year: "2024", cutoff: "CSE: 97.46 | IT: 96.50", source: "CAP Round 1" }
            ],
            rankingTier: "Tier 2"
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
        console.log(`\n✅ Successfully enriched ${updatedCount} colleges with 2024 MHT CET data.`);
    } else {
        console.log("\n⚠️ No colleges updated. Check IDs.");
    }
}

enrich();
