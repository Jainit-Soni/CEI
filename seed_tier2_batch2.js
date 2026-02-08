const fs = require('fs');
const path = require('path');

const MODELS_DIR = path.join(__dirname, 'backend/models');

const SEED_DATA = [
    {
        file: 'Maharashtra_Colleges.json',
        colleges: [
            {
                id: "ycce-nagpur",
                name: "Yeshwantrao Chavan College of Engineering",
                shortName: "YCCE",
                location: "Hingna Road, Nagpur, Maharashtra",
                rankingTier: "Tier 2",
                type: "Private (Autonomous)",
                overview: "Nagpur's first private autonomous engineering college, known for its massive alumni base and campus.",
                officialUrl: "https://www.ycce.edu",
                acceptedExams: ["mht-cet", "jee-main"],
                courses: [
                    { name: "B.E. CSE", degree: "B.E.", duration: "4 years", exams: ["mht-cet", "jee-main"] },
                    { name: "B.E. IT", degree: "B.E.", duration: "4 years", exams: ["mht-cet", "jee-main"] },
                    { name: "B.E. CTech", degree: "B.E.", duration: "4 years", exams: ["mht-cet", "jee-main"] }
                ],
                pastCutoffs: [
                    { examId: "mht-cet", year: "2024", cutoff: "CSE: ~95.03%ile | IT: ~92.66%ile", source: "MHT CET 2024" },
                    { examId: "jee-main", year: "2024", cutoff: "CSE: ~7000 (AI Rank)", source: "JoSAA 2024" }
                ],
                meta: { ownership: "Private" }
            },
            {
                id: "kkwagh-nashik",
                name: "K. K. Wagh Institute of Engineering Education and Research",
                shortName: "KK Wagh",
                location: "Panchavati, Nashik, Maharashtra",
                rankingTier: "Tier 2.5",
                type: "Private (Autonomous)",
                overview: "The top engineering institute in Nashik, offering excellent ROI and consistent TCS/Infosys placements.",
                officialUrl: "https://engg.kkwagh.edu.in",
                acceptedExams: ["mht-cet", "jee-main"],
                courses: [
                    { name: "B.E. Computer Engineering", degree: "B.E.", duration: "4 years", exams: ["mht-cet", "jee-main"] },
                    { name: "B.E. IT", degree: "B.E.", duration: "4 years", exams: ["mht-cet", "jee-main"] }
                ],
                pastCutoffs: [
                    { examId: "mht-cet", year: "2024", cutoff: "CE: ~92.46%ile - 96%ile", source: "MHT CET 2024" },
                    { examId: "jee-main", year: "2024", cutoff: "CE: ~15,000 (AI Rank)", source: "JoSAA 2024" }
                ],
                meta: { ownership: "Private" }
            }
        ]
    },
    {
        file: 'Karnataka_Colleges.json',
        colleges: [
            {
                id: "sir-mvit-bangalore",
                name: "Sir M. Visvesvaraya Institute of Technology",
                shortName: "Sir MVIT",
                location: "Yelahanka, Bangalore",
                rankingTier: "Tier 2",
                type: "Private",
                overview: "Named after the legendary Sir MV, this college is known for its lush green campus and strict academic discipline.",
                officialUrl: "https://www.sirmvit.edu",
                acceptedExams: ["kcet", "comedk-uget"],
                courses: [
                    { name: "B.E. CSE", degree: "B.E.", duration: "4 years", exams: ["kcet", "comedk-uget"] },
                    { name: "B.E. ISE", degree: "B.E.", duration: "4 years", exams: ["kcet", "comedk-uget"] }
                ],
                pastCutoffs: [
                    { examId: "kcet", year: "2024", cutoff: "CSE: ~11,277 - 13,464", source: "KCET 2024" },
                    { examId: "comedk-uget", year: "2024", cutoff: "CSE: ~15,000", source: "COMEDK 2024" }
                ],
                meta: { ownership: "Private" }
            }
        ]
    },
    {
        file: 'Uttar_Pradesh_Colleges.json',
        colleges: [
            {
                id: "kiet-ghaziabad",
                name: "KIET Group of Institutions",
                shortName: "KIET",
                location: "Muradnagar, Ghaziabad, UP",
                rankingTier: "Tier 2.5",
                type: "Private (AKTU Affiliated)",
                overview: "A top-tier AKTU college known for its project-based learning and steady placements in NCR.",
                officialUrl: "https://www.kiet.edu",
                acceptedExams: ["jee-main", "uptac"],
                courses: [
                    { name: "B.Tech CSE", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] },
                    { name: "B.Tech CSE-AI", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] }
                ],
                pastCutoffs: [
                    { examId: "jee-main", year: "2024", cutoff: "CSE: ~90,459 (Round 1) - 1,45,000 (Last)", source: "UPTAC 2024" }
                ],
                meta: { ownership: "Private" }
            }
        ]
    }
];

function seed() {
    console.log("🌱 Bulk Seeding Tier-2 Batch 2...");

    SEED_DATA.forEach(section => {
        const filePath = path.join(MODELS_DIR, section.file);
        let colleges = [];

        if (fs.existsSync(filePath)) {
            const content = fs.readFileSync(filePath, 'utf8');
            colleges = JSON.parse(content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content);
        }

        let addedCount = 0;
        section.colleges.forEach(newC => {
            if (!colleges.find(c => c.id === newC.id)) {
                console.log(`[+] Adding ${newC.shortName} to ${section.file}`);
                colleges.push(newC);
                addedCount++;
            } else {
                console.log(`[=] ${newC.shortName} already exists in ${section.file}`);
            }
        });

        if (addedCount > 0) {
            fs.writeFileSync(filePath, JSON.stringify(colleges, null, 2));
            console.log(`   ✅ Sucedded: ${addedCount} colleges added.`);
        }
    });
}

seed();
