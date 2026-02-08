const fs = require('fs');
const path = require('path');

const MODELS_DIR = path.join(__dirname, 'backend/models');

const SEED_DATA = [
    {
        file: 'Maharashtra_Colleges.json',
        colleges: [
            {
                id: "rcoem-nagpur",
                name: "Ramdeobaba College of Engineering and Management (RCOEM)",
                shortName: "RCOEM",
                location: "Katol Road, Nagpur, Maharashtra",
                rankingTier: "Tier 2",
                type: "Private (Autonomous)",
                overview: "Nagpur's most sought-after private engineering college, known for excellent placements and academic rigor.",
                officialUrl: "http://www.rknec.edu",
                acceptedExams: ["mht-cet", "jee-main"],
                courses: [
                    { name: "B.E. CSE", degree: "B.E.", duration: "4 years", exams: ["mht-cet", "jee-main"] },
                    { name: "B.E. AI & ML", degree: "B.E.", duration: "4 years", exams: ["mht-cet", "jee-main"] }
                ],
                pastCutoffs: [
                    { examId: "mht-cet", year: "2023", cutoff: "CSE: ~98.07%ile (4769 Rank) | AI: ~97.5%ile", source: "MHT CET 2023" },
                    { examId: "jee-main", year: "2023", cutoff: "CSE: ~3500 (AI Rank)", source: "JoSAA 2023" }
                ],
                meta: { ownership: "Private" }
            },
            {
                id: "djsce-mumbai",
                name: "Dwarkadas J. Sanghvi College of Engineering",
                shortName: "DJSCE",
                location: "Vile Parle West, Mumbai, Maharashtra",
                rankingTier: "Tier 2",
                type: "Private (Autonomous)",
                overview: "A premier engineering institute in Mumbai, favored by top rankers for its strong industry connections.",
                officialUrl: "https://www.djsce.ac.in",
                acceptedExams: ["mht-cet", "jee-main"],
                courses: [
                    { name: "B.E. Computer Engineering", degree: "B.E.", duration: "4 years", exams: ["mht-cet", "jee-main"] },
                    { name: "B.E. IT", degree: "B.E.", duration: "4 years", exams: ["mht-cet", "jee-main"] }
                ],
                pastCutoffs: [
                    { examId: "mht-cet", year: "2024", cutoff: "CE: ~98.74%ile | IT: ~98.2%ile", source: "MHT CET 2024" },
                    { examId: "jee-main", year: "2024", cutoff: "CE: ~1357 (AI Rank)", source: "JoSAA 2024" }
                ],
                meta: { ownership: "Private" }
            }
        ]
    },
    {
        file: 'Karnataka_Colleges.json',
        colleges: [
            {
                id: "bit-bangalore",
                name: "Bangalore Institute of Technology",
                shortName: "BIT Bangalore",
                location: "KR Road, VV Puram, Bangalore",
                rankingTier: "Tier 2",
                type: "Private",
                overview: "Located in the heart of Bangalore, BIT is known for its consistent performance and central location.",
                officialUrl: "https://bit-bangalore.edu.in",
                acceptedExams: ["kcet", "comedk-uget"],
                courses: [
                    { name: "B.E. CSE", degree: "B.E.", duration: "4 years", exams: ["kcet", "comedk-uget"] },
                    { name: "B.E. ISE", degree: "B.E.", duration: "4 years", exams: ["kcet", "comedk-uget"] }
                ],
                pastCutoffs: [
                    { examId: "kcet", year: "2024", cutoff: "CSE: ~5540-7749 | ISE: ~10000", source: "KCET 2024" }
                ],
                meta: { ownership: "Private" }
            },
            {
                id: "nmit-bangalore",
                name: "Nitte Meenakshi Institute of Technology",
                shortName: "NMIT",
                location: "Yelahanka, Bangalore",
                rankingTier: "Tier 2.5",
                type: "Private (Autonomous)",
                overview: "A rapidly growing autonomous institute with modern infrastructure and decent placement records.",
                officialUrl: "https://www.nmit.ac.in",
                acceptedExams: ["kcet", "comedk-uget"],
                courses: [
                    { name: "B.E. CSE", degree: "B.E.", duration: "4 years", exams: ["kcet", "comedk-uget"] }
                ],
                pastCutoffs: [
                    { examId: "kcet", year: "2024", cutoff: "CSE: ~9800-12200", source: "KCET 2024" }
                ],
                meta: { ownership: "Private" }
            }
        ]
    },
    {
        file: 'Delhi_Colleges.json',
        colleges: [
            {
                id: "vips-delhi",
                name: "Vivekananda Institute of Professional Studies - TC",
                shortName: "VIPS",
                location: "Pitampura, New Delhi",
                rankingTier: "Tier 2.5",
                type: "Private (IPU Affiliated)",
                overview: "Known for its Law and Journalism, VIPS has recently emerged as a strong contender in Engineering under IPU.",
                officialUrl: "https://vips.edu",
                acceptedExams: ["jee-main", "ipu-cet"],
                courses: [
                    { name: "B.Tech CSE", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] }
                ],
                pastCutoffs: [
                    { examId: "jee-main", year: "2024", cutoff: "CSE: ~78,737 - 1,00,066", source: "IPU 2024" }
                ],
                meta: { ownership: "Private" }
            },
            {
                id: "adgitm-delhi",
                name: "Dr. Akhilesh Das Gupta Institute of Technology & Management",
                shortName: "ADGITM",
                location: "Shastri Park, New Delhi",
                rankingTier: "Tier 3",
                type: "Private (IPU Affiliated)",
                overview: "Formerly NIEC, located in East Delhi, offering decent opportunities for IPU aspirants.",
                officialUrl: "https://adgitmdelhi.ac.in",
                acceptedExams: ["jee-main", "ipu-cet"],
                courses: [
                    { name: "B.Tech CSE", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] }
                ],
                pastCutoffs: [
                    { examId: "jee-main", year: "2023", cutoff: "CSE: ~90,000 - 1,10,000", source: "IPU 2023" }
                ],
                meta: { ownership: "Private" }
            }
        ]
    },
    {
        file: 'Uttar_Pradesh_Colleges.json',
        colleges: [
            {
                id: "gl-bajaj-noida",
                name: "GL Bajaj Institute of Technology and Management",
                shortName: "GL Bajaj",
                location: "Greater Noida, Uttar Pradesh",
                rankingTier: "Tier 2.5",
                type: "Private (AKTU Affiliated)",
                overview: "One of the top AKTU colleges in Greater Noida, known for systematic academics and mass recruitment.",
                officialUrl: "https://www.glbitm.org",
                acceptedExams: ["jee-main", "uptac"],
                courses: [
                    { name: "B.Tech CSE", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] }
                ],
                pastCutoffs: [
                    { examId: "jee-main", year: "2024", cutoff: "CSE: ~1,23,000 (AI)", source: "UPTAC 2024" }
                ],
                meta: { ownership: "Private" }
            }
        ]
    }
];

function seed() {
    console.log("🌱 Bulk Seeding Tier-2 Colleges...");

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
