const fs = require('fs');
const path = require('path');

const MODELS_DIR = path.join(__dirname, 'backend/models');

const SEED_DATA = [
    {
        file: 'Karnataka_Colleges.json',
        college: {
            id: "rvce-bangalore",
            name: "RV College of Engineering (RVCE)",
            shortName: "RVCE",
            location: "Mysore Road, Bangalore, Karnataka",
            rankingTier: "Tier 1",
            type: "Private (Autonomous)",
            overview: "Karnataka's top private engineering college, famous for its rigorous academics and 100% placement record.",
            officialUrl: "https://rvce.edu.in",
            acceptedExams: ["kcet", "comedk-uget", "jee-main"],
            courses: [
                { name: "B.E. CSE", degree: "B.E.", duration: "4 years", exams: ["kcet", "comedk-uget"] },
                { name: "B.E. ISE", degree: "B.E.", duration: "4 years", exams: ["kcet", "comedk-uget"] },
                { name: "B.E. ECE", degree: "B.E.", duration: "4 years", exams: ["kcet", "comedk-uget"] }
            ],
            pastCutoffs: [
                { examId: "kcet", year: "2024", cutoff: "CSE: ~419-501 | ISE: ~1200", source: "KCET 2024" },
                { examId: "comedk-uget", year: "2024", cutoff: "CSE: ~434 | ISE: ~800", source: "COMEDK 2024" }
            ],
            meta: { ownership: "Private" }
        }
    },
    {
        file: 'Jharkhand_Colleges.json',
        college: {
            id: "bit-mesra",
            name: "Birla Institute of Technology, Mesra",
            shortName: "BIT Mesra",
            location: "Mesra, Ranchi, Jharkhand",
            rankingTier: "Tier 1",
            type: "Private (Deemed University)",
            overview: "A premier institute with a rich legacy, known for its sprawling campus and strong alumni network (GFTI).",
            officialUrl: "https://www.bitmesra.ac.in",
            acceptedExams: ["jee-main"],
            courses: [
                { name: "B.Tech CSE", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] },
                { name: "B.Tech AI-ML", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] }
            ],
            pastCutoffs: [
                { examId: "jee-main", year: "2024", cutoff: "CSE: ~22317 (AI) | AI-ML: ~28000", source: "JoSAA 2024" }
            ],
            meta: { ownership: "Private" }
        }
    },
    {
        file: 'Punjab_Colleges.json',
        college: {
            id: "pec-chandigarh",
            name: "Punjab Engineering College (PEC)",
            shortName: "PEC Chandigarh",
            location: "Sector 12, Chandigarh",
            rankingTier: "Tier 1",
            type: "Public/Government (GFTI)",
            overview: "One of the oldest engineering colleges in India (1921), originally established in Lahore. Excellent research output.",
            officialUrl: "https://pec.ac.in",
            acceptedExams: ["jee-main"],
            courses: [
                { name: "B.Tech CSE", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] },
                { name: "B.Tech ECE", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] }
            ],
            pastCutoffs: [
                { examId: "jee-main", year: "2024", cutoff: "CSE: ~13754 (AI) | ~18868 (HS)", source: "JoSAA 2024" }
            ],
            meta: { ownership: "Public" }
        }
    },
    {
        file: 'West_Bengal_Colleges.json',
        college: {
            id: "techno-india-university",
            name: "Techno India University",
            shortName: "Techno India",
            location: "Salt Lake, Kolkata, West Bengal",
            rankingTier: "Tier 2",
            type: "Private",
            overview: "A leading private university in WB, part of the massive Techno India Group. Known for modern infrastructure.",
            officialUrl: "https://www.technoindiauniversity.ac.in",
            acceptedExams: ["wbjee", "jee-main"],
            courses: [
                { name: "B.Tech CSE", degree: "B.Tech", duration: "4 years", exams: ["wbjee"] }
            ],
            pastCutoffs: [
                { examId: "wbjee", year: "2024", cutoff: "CSE: ~39661", source: "WBJEE 2024" }
            ],
            meta: { ownership: "Private" }
        }
    }
];

function seed() {
    console.log("🌱 Seeding Final Gap Fillers...");

    SEED_DATA.forEach(item => {
        const filePath = path.join(MODELS_DIR, item.file);

        let colleges = [];
        let content = "[]";

        if (fs.existsSync(filePath)) {
            content = fs.readFileSync(filePath, 'utf8');
            content = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
            try {
                colleges = JSON.parse(content);
            } catch (e) {
                console.log(`Error parsing ${item.file}, starting empty.`);
            }
        }

        const exists = colleges.find(c => c.id === item.college.id);
        if (exists) {
            console.log(`[=] ${item.college.name} already in ${item.file}.`);
        } else {
            console.log(`[+] Adding ${item.college.name} to ${item.file}`);
            colleges.push(item.college);
            fs.writeFileSync(filePath, JSON.stringify(colleges, null, 2));
        }
    });

    console.log(`\n✅ Sealed all National Coverage gaps.`);
}

seed();
