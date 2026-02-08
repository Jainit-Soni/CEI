const fs = require('fs');
const path = require('path');

const MODELS_DIR = path.join(__dirname, 'backend/models');

const SEED_DATA = [
    {
        file: 'Jharkhand_Colleges.json',
        college: {
            id: "iit-dhanbad",
            name: "Indian Institute of Technology (ISM) Dhanbad",
            shortName: "IIT Dhanbad",
            location: "Dhanbad, Jharkhand",
            rankingTier: "Tier 1",
            type: "Public/Government (INI)",
            overview: "Formerly ISM Dhanbad, now an IIT. A premier institute known for Mining, CSE, and Petroleum Engineering.",
            officialUrl: "https://www.iitism.ac.in",
            acceptedExams: ["jee-advanced", "gate", "cat", "jam"],
            courses: [
                { name: "B.Tech CSE", degree: "B.Tech", duration: "4 years", exams: ["jee-advanced"] },
                { name: "B.Tech MNC", degree: "B.Tech", duration: "4 years", exams: ["jee-advanced"] },
                { name: "B.Tech Petroleum", degree: "B.Tech", duration: "4 years", exams: ["jee-advanced"] }
            ],
            pastCutoffs: [
                { examId: "jee-advanced", year: "2024", cutoff: "CSE: ~3594 | AI: ~304-439 | Elec: ~6000", source: "JoSAA 2024" }
            ],
            meta: { ownership: "Public" }
        }
    },
    {
        file: 'Karnataka_Colleges.json',
        college: {
            id: "nit-surathkal",
            name: "National Institute of Technology Karnataka (NITK), Surathkal",
            shortName: "NIT Surathkal",
            location: "Surathkal, Mangalore, Karnataka",
            rankingTier: "Tier 1",
            type: "Public/Government (INI)",
            overview: "One of the top NITs in India, located on the NH66 with a private beach. Known for placement records.",
            officialUrl: "https://www.nitk.ac.in",
            acceptedExams: ["jee-main", "gate", "nimcet", "jam"],
            courses: [
                { name: "B.Tech CSE", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] },
                { name: "B.Tech IT", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] },
                { name: "B.Tech ECE", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] }
            ],
            pastCutoffs: [
                { examId: "jee-main", year: "2024", cutoff: "CSE: ~1920 (AI) | IT: ~3000 | ECE: ~6000", source: "JoSAA 2024" }
            ],
            meta: { ownership: "Public" }
        }
    },
    {
        file: 'Delhi_Colleges.json',
        college: {
            id: "nit-delhi",
            name: "National Institute of Technology Delhi",
            shortName: "NIT Delhi",
            location: "Narela, New Delhi, Delhi",
            rankingTier: "Tier 2",
            type: "Public/Government (INI)",
            overview: "A rapidly growing NIT with a new campus in Narela. Rising in popularity due to location.",
            officialUrl: "https://nitdelhi.ac.in",
            acceptedExams: ["jee-main", "gate"],
            courses: [
                { name: "B.Tech CSE", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] },
                { name: "B.Tech ECE", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] }
            ],
            pastCutoffs: [
                { examId: "jee-main", year: "2024", cutoff: "CSE: ~10165 (AI) | ECE: ~16000", source: "JoSAA 2024" }
            ],
            meta: { ownership: "Public" }
        }
    },
    {
        file: 'Telangana_Colleges.json',
        college: {
            id: "nit-warangal",
            name: "National Institute of Technology Warangal",
            shortName: "NIT Warangal",
            location: "Warangal, Telangana",
            rankingTier: "Tier 1",
            type: "Public/Government (INI)",
            overview: "The first REC establishes in 1959, now a premier NIT known for strong research and unparalleled placements.",
            officialUrl: "https://www.nitw.ac.in",
            acceptedExams: ["jee-main", "gate", "nimcet"],
            courses: [
                { name: "B.Tech CSE", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] },
                { name: "B.Tech ECE", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] }
            ],
            pastCutoffs: [
                { examId: "jee-main", year: "2024", cutoff: "CSE: ~2360 (AI) | ECE: ~6000", source: "JoSAA 2024" }
            ],
            meta: { ownership: "Public" }
        }
    },
    {
        file: 'Odisha_Colleges.json',
        college: {
            id: "nit-rourkela",
            name: "National Institute of Technology Rourkela",
            shortName: "NIT Rourkela",
            location: "Rourkela, Odisha",
            rankingTier: "Tier 1",
            type: "Public/Government (INI)",
            overview: "A massive campus known for its research output and distinct multi-disciplinary engineering programs.",
            officialUrl: "https://www.nitrkl.ac.in",
            acceptedExams: ["jee-main", "gate"],
            courses: [
                { name: "B.Tech CSE", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] },
                { name: "B.Tech Mechanical", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] }
            ],
            pastCutoffs: [
                { examId: "jee-main", year: "2024", cutoff: "CSE: ~2940 (AI)", source: "JoSAA 2024" }
            ],
            meta: { ownership: "Public" }
        }
    },
    {
        file: 'West_Bengal_Colleges.json',
        college: {
            id: "iiest-shibpur",
            name: "Indian Institute of Engineering Science and Technology, Shibpur",
            shortName: "IIEST Shibpur",
            location: "Howrah, West Bengal",
            rankingTier: "Tier 1.5",
            type: "Public/Government (INI)",
            overview: "The second oldest engineering college in India, upgraded to an INI. Known for legacy and core engineering.",
            officialUrl: "https://www.iiests.ac.in",
            acceptedExams: ["jee-main", "gate"],
            courses: [
                { name: "B.Tech CST", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] },
                { name: "B.Tech Aerospace", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] }
            ],
            pastCutoffs: [
                { examId: "jee-main", year: "2024", cutoff: "CST: ~9725 (AI)", source: "JoSAA 2024" }
            ],
            meta: { ownership: "Public" }
        }
    }
];

function seed() {
    console.log("🌱 Seeding Missing National Institutes...");
    let addedCount = 0;

    SEED_DATA.forEach(item => {
        const filePath = path.join(MODELS_DIR, item.file);

        let colleges = [];
        let content = "[]";

        if (fs.existsSync(filePath)) {
            content = fs.readFileSync(filePath, 'utf8');
            // Remove BOM if present
            content = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
            try {
                colleges = JSON.parse(content);
            } catch (e) {
                console.log(`Error parsing ${item.file}, starting empty.`);
            }
        }

        // Check duplicates
        const exists = colleges.find(c => c.id === item.college.id);
        if (exists) {
            console.log(`[=] ${item.college.name} already in ${item.file}.`);
            // Optional: enrich existing?
        } else {
            console.log(`[+] Adding ${item.college.name} to ${item.file}`);
            colleges.push(item.college);
            fs.writeFileSync(filePath, JSON.stringify(colleges, null, 2));
            addedCount++;
        }
    });

    console.log(`\n✅ Seeded ${addedCount} new National Institutes.`);
}

seed();
