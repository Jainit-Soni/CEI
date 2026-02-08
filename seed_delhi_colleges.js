const fs = require('fs');
const path = require('path');

const DELHI_FILE = path.join(__dirname, 'backend/models/Delhi_Colleges.json');

const SEED_DATA = [
    {
        id: "dtu-delhi",
        name: "Delhi Technological University (DTU)",
        shortName: "DTU",
        location: "Shahbad Daulatpur, Bawana Road, Delhi",
        rankingTier: "Tier 1",
        type: "Public/Government",
        overview: "Formerly DCE, DTU is one of India's oldest and most prestigious engineering colleges, renowned for its placements and alumni network.",
        officialUrl: "http://dtu.ac.in",
        acceptedExams: ["jee-main"],
        courses: [
            { name: "B.Tech CSE", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] },
            { name: "B.Tech Software Engineering", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] },
            { name: "B.Tech IT", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] },
            { name: "B.Tech ECE", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] }
        ],
        pastCutoffs: [
            { examId: "jee-main", year: "2024", cutoff: "CSE: ~4876 (AI) | ~13567 (Delhi) | SE: ~7000 (AI)", source: "JAC Delhi 2024" }
        ],
        meta: { ownership: "Public" }
    },
    {
        id: "nsut-delhi",
        name: "Netaji Subhas University of Technology",
        shortName: "NSUT",
        location: "Dwarka Sector 3, New Delhi",
        rankingTier: "Tier 1",
        type: "Public/Government",
        overview: "Formerly NSIT, famous for its tech culture and proximity to Gurgaon's corporate hub. A top choice for CSE/IT aspirants.",
        officialUrl: "http://nsut.ac.in",
        acceptedExams: ["jee-main"],
        courses: [
            { name: "B.Tech CSE", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] },
            { name: "B.Tech CSE-AI", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] },
            { name: "B.Tech IT", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] }
        ],
        pastCutoffs: [
            { examId: "jee-main", year: "2024", cutoff: "CSE: ~9869 (AI) | AI-DS: ~3534", source: "JAC Delhi 2024" }
        ],
        meta: { ownership: "Public" }
    },
    {
        id: "iiit-delhi",
        name: "Indraprastha Institute of Information Technology Delhi",
        shortName: "IIIT-Delhi",
        location: "Okhla Industrial Estate, New Delhi",
        rankingTier: "Tier 1",
        type: "Public/Government (State)",
        overview: "A research-focused institute known for its cutting-edge curriculum in CS and AI. Highly competitive.",
        officialUrl: "https://www.iiitd.ac.in",
        acceptedExams: ["jee-main"],
        courses: [
            { name: "B.Tech CSE", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] },
            { name: "B.Tech CSAI", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] },
            { name: "B.Tech ECE", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] }
        ],
        pastCutoffs: [
            { examId: "jee-main", year: "2024", cutoff: "CSE: ~6695 (AI) | ~21112 (Delhi) | CSAI: ~2473", source: "JAC Delhi 2024" }
        ],
        meta: { ownership: "Public" }
    },
    {
        id: "mait-delhi",
        name: "Maharaja Agrasen Institute of Technology",
        shortName: "MAIT",
        location: "Rohini Sector-22, New Delhi",
        rankingTier: "Tier 2",
        type: "Private (IPU Affiliated)",
        overview: "One of the top colleges under GGSIPU, known for its rigorous academic environment and consistent placements.",
        officialUrl: "https://mait.ac.in",
        acceptedExams: ["jee-main", "ipu-cet"],
        courses: [
            { name: "B.Tech CSE", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] },
            { name: "B.Tech IT", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] }
        ],
        pastCutoffs: [
            { examId: "jee-main", year: "2024", cutoff: "CSE: ~14095-47478 | IT: ~38582-58152", source: "IPU Counselling 2024" }
        ],
        meta: { ownership: "Private" }
    },
    {
        id: "msit-delhi",
        name: "Maharaja Surajmal Institute of Technology",
        shortName: "MSIT",
        location: "Janakpuri, New Delhi",
        rankingTier: "Tier 2",
        type: "Private (IPU Affiliated)",
        overview: "A premier IPU college located in Janakpuri, focusing on engineering and technology excellence.",
        officialUrl: "http://msit.in",
        acceptedExams: ["jee-main", "ipu-cet"],
        courses: [
            { name: "B.Tech CSE", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] },
            { name: "B.Tech IT", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] }
        ],
        pastCutoffs: [
            { examId: "jee-main", year: "2024", cutoff: "CSE: ~54501-62496 (AI) | ~21434 (Delhi)", source: "IPU Counselling 2024" }
        ],
        meta: { ownership: "Private" }
    },
    {
        id: "bpit-delhi",
        name: "Bhagwan Parshuram Institute of Technology",
        shortName: "BPIT",
        location: "Rohini Sector 17, New Delhi",
        rankingTier: "Tier 2.5",
        type: "Private (IPU Affiliated)",
        overview: "A solid engineering college under IPU in North Delhi, offering good value for rank.",
        officialUrl: "http://bpitindia.com",
        acceptedExams: ["jee-main", "ipu-cet"],
        courses: [
            { name: "B.Tech CSE", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] }
        ],
        pastCutoffs: [
            { examId: "jee-main", year: "2024", cutoff: "CSE: ~119838 (Round 1)", source: "IPU Counselling 2024" }
        ],
        meta: { ownership: "Private" }
    },
    {
        id: "bvcoe-delhi",
        name: "Bharati Vidyapeeth's College of Engineering",
        shortName: "BVCOE",
        location: "Paschim Vihar, New Delhi",
        rankingTier: "Tier 2",
        type: "Private (IPU Affiliated)",
        overview: "Part of the prestigious Bharati Vidyapeeth group, offering quality engineering education in West Delhi.",
        officialUrl: "http://bvcoend.ac.in",
        acceptedExams: ["jee-main", "ipu-cet"],
        courses: [
            { name: "B.Tech CSE", degree: "B.Tech", duration: "4 years", exams: ["jee-main"] }
        ],
        pastCutoffs: [
            { examId: "jee-main", year: "2024", cutoff: "CSE: ~36573-48945 (AI)", source: "IPU Counselling 2024" }
        ],
        meta: { ownership: "Private" }
    }
];

function seed() {
    console.log("🌱 Seeding Delhi Top Colleges...");

    let colleges = [];
    if (fs.existsSync(DELHI_FILE)) {
        const content = fs.readFileSync(DELHI_FILE, 'utf8');
        const cleanContent = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
        colleges = JSON.parse(cleanContent);
    }

    let added = 0;
    SEED_DATA.forEach(newC => {
        const exists = colleges.some(c => c.id === newC.id);
        if (!exists) {
            console.log(`[+] Adding: ${newC.name}`);
            colleges.push(newC);
            added++;
        } else {
            console.log(`[=] Exists: ${newC.name}`);
        }
    });

    if (added > 0) {
        fs.writeFileSync(DELHI_FILE, JSON.stringify(colleges, null, 2));
        console.log(`\n✅ Successfully added ${added} colleges to Delhi.`);
    } else {
        console.log("\n✨ No new colleges added.");
    }
}

seed();
