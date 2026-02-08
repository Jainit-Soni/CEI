const fs = require('fs');
const path = require('path');

const MODELS_DIR = path.join(__dirname, 'backend/models');

// Tier-2 Targets (The "Next 10" per state)
const TIER2_TARGETS = {
    "Maharashtra": [
        "Sardar Patel College of Engineering (SPCE)", // Distinct from SPIT
        "Ramdeobaba College of Engineering and Management (RCOEM)",
        "Yeshwantrao Chavan College of Engineering (YCCE)",
        "Thadomal Shahani Engineering College", // Check if strictly present
        "Vivekanand Education Society's Institute of Technology (VESIT)",
        "Dwarkadas J. Sanghvi College of Engineering (DJSCE)",
        "Walchand Institute of Technology, Solapur", // Different from Walchand Sangli
        "K. K. Wagh Institute of Engineering Education and Research"
    ],
    "Karnataka": [
        "Bangalore Institute of Technology (BIT)",
        "Nitte Meenakshi Institute of Technology (NMIT)",
        "BMS Institute of Technology and Management (BMSIT)",
        "Dayananda Sagar College of Engineering (DSCE)",
        "Sir M. Visvesvaraya Institute of Technology (Sir MVIT)",
        "Kle Technological University",
        "Siddaganga Institute of Technology (SIT)"
    ],
    "Uttar_Pradesh": [
        "JSS Academy of Technical Education, Noida",
        "Ajay Kumar Garg Engineering College (AKGEC)",
        "KIET Group of Institutions (KIET)",
        "Galgotias College of Engineering and Technology (GCET)",
        "ABES Engineering College",
        "GL Bajaj Institute of Technology and Management"
    ],
    "Delhi": [
        "Maharaja Agrasen Institute of Technology (MAIT)", // Re-verify
        "Maharaja Surajmal Institute of Technology (MSIT)", // Re-verify
        "Bhagwan Parshuram Institute of Technology (BPIT)", // Re-verify
        "Dr. Akhilesh Das Gupta Institute of Technology & Management (ADGITM)",
        "Vivekananda Institute of Professional Studies (VIPS)"
    ]
};

function checkGaps() {
    console.log("🕵️  Audit: Identifying Tier-2 Gaps...");

    Object.keys(TIER2_TARGETS).forEach(state => {
        console.log(`\n📍 Checking ${state}...`);
        const file = path.join(MODELS_DIR, `${state}_Colleges.json`);

        let existingNames = [];
        if (fs.existsSync(file)) {
            const content = fs.readFileSync(file, 'utf8');
            const data = JSON.parse(content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content);
            existingNames = data.map(c => c.name.toLowerCase());
        }

        const missing = [];
        TIER2_TARGETS[state].forEach(target => {
            // Fuzzy check
            const isFound = existingNames.some(name => {
                const tWords = target.toLowerCase().split(' ').slice(0, 2).join(' '); // Match first 2 words roughly
                return name.includes(tWords);
            });

            if (!isFound) {
                missing.push(target);
            }
        });

        if (missing.length > 0) {
            console.log(`   ❌ Missing ${missing.length}:`);
            missing.forEach(m => console.log(`      - ${m}`));
        } else {
            console.log("   ✅ All Tier-2 Targets Found!");
        }
    });
}

checkGaps();
