const fs = require('fs');
const path = require('path');

const DELHI_FILE = path.join(__dirname, 'backend/models/Delhi_Colleges.json');

const TARGETS = [
    { name: "Delhi Technological University", keywords: ["dtu", "delhi technological", "delhi college of engineering"] },
    { name: "Netaji Subhas University of Technology", keywords: ["nsut", "nsit", "netaji subhas"] },
    { name: "Indraprastha Institute of Information Technology", keywords: ["iiit-delhi", "iiitd", "indraprastha institute"] },
    { name: "Indira Gandhi Delhi Technical University for Women", keywords: ["igdtuw", "indira gandhi"] },
    { name: "Jamia Millia Islamia", keywords: ["jamia millia", "jmi"] },
    { name: "Maharaja Agrasen Institute of Technology", keywords: ["mait", "maharaja agrasen"] },
    { name: "Maharaja Surajmal Institute of Technology", keywords: ["msit", "maharaja surajmal"] },
    { name: "University School of Information, Communication and Technology", keywords: ["usict", "ggsipu", "guru gobind singh"] },
    { name: "Bharati Vidyapeeth's College of Engineering", keywords: ["bharati vidyapeeth", "bvcoe"] },
    { name: "Bhagwan Parshuram Institute of Technology", keywords: ["bpit", "bhagwan parshuram"] }
];

function audit() {
    console.log("🕵️  Auditing Delhi Top Colleges...");

    if (!fs.existsSync(DELHI_FILE)) {
        console.log("❌ Delhi file not found!");
        return;
    }

    const content = fs.readFileSync(DELHI_FILE, 'utf8');
    const colleges = JSON.parse(content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content);

    console.log(`Loaded ${colleges.length} colleges from Delhi.`);

    const missing = [];

    TARGETS.forEach(t => {
        const found = colleges.find(c => {
            const name = c.name.toLowerCase();
            const id = c.id.toLowerCase();
            return t.keywords.some(k => name.includes(k) || id.includes(k));
        });

        if (found) {
            console.log(`✅ FOUND: ${t.name} (${found.id})`);
        } else {
            console.log(`❌ MISSING: ${t.name}`);
            missing.push(t.name);
        }
    });

    console.log(`\nResults: ${missing.length} missing out of ${TARGETS.length} checked.`);
}

audit();
