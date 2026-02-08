const fs = require('fs');
const path = require('path');

const MODELS_DIR = path.join(__dirname, 'backend/models');

const STATE_TARGEST = {
    "West_Bengal": [
        { name: "Jadavpur University", keywords: ["jadavpur"] },
        { name: "Calcutta University", keywords: ["calcutta university", "university of calcutta"] },
        { name: "Institute of Engineering and Management (IEM)", keywords: ["iem", "institute of engineering and management"] },
        { name: "Heritage Institute of Technology", keywords: ["heritage"] },
        { name: "Techno India University", keywords: ["techno india"] }
    ],
    "Telangana": [
        { name: "Osmania University (UCE)", keywords: ["osmania", "uceou"] },
        { name: "JNTU Hyderabad", keywords: ["jntuh", "jawaharlal nehru technological"] },
        { name: "Chaitanya Bharathi Institute of Technology (CBIT)", keywords: ["cbit", "chaitanya bharathi"] },
        { name: "VNR Vignana Jyothi Institute of Engineering and Technology", keywords: ["vnr", "vignana jyothi"] },
        { name: "Vasavi College of Engineering", keywords: ["vasavi"] }
    ],
    "Karnataka": [
        { name: "RV College of Engineering", keywords: ["rvce", "r.v. college"] },
        { name: "BMS College of Engineering", keywords: ["bmsce", "b.m.s."] },
        { name: "MS Ramaiah Institute of Technology", keywords: ["msrit", "ramaiah"] },
        { name: "PES University", keywords: ["pes university", "pes institute"] }
    ],
    "Madhya_Pradesh": [
        { name: "SGSITS Indore", keywords: ["sgsits", "shri g. s. institute"] },
        { name: "IET DAVV Indore", keywords: ["iet davv", "devi ahilya"] },
        { name: "Jabalpur Engineering College", keywords: ["jabalpur engineering", "jec"] },
        { name: "MITS Gwalior", keywords: ["mits", "madhav institute"] },
        { name: "LNCT Bhopal", keywords: ["lnct", "lakshmi narain"] }
    ],
    "Rajasthan": [
        { name: "MBM Engineering College", keywords: ["mbm"] },
        { name: "College of Technology and Engineering (CTAE)", keywords: ["ctae", "udaipur"] },
        { name: "SKIT Jaipur", keywords: ["skit", "swami keshvanand"] },
        { name: "JECRC University", keywords: ["jecrc"] }
    ],
    "Kerala": [
        { name: "College of Engineering Trivandrum (CET)", keywords: ["college of engineering trivandrum", "cet"] },
        { name: "Govt Model Engineering College (MEC)", keywords: ["model engineering", "mec"] },
        { name: "GEC Thrissur", keywords: ["government engineering college thrissur", "gec thrissur"] }
    ],
    "Punjab": [
        { name: "Punjab Engineering College (PEC)", keywords: ["pec", "punjab engineering college"] },
        { name: "Thapar Institute (TIET)", keywords: ["thapar", "tiet"] },
        { name: "Chitkara University", keywords: ["chitkara"] }
    ],
    "Haryana": [
        { name: "J.C. Bose University (YMCA)", keywords: ["ymca", "j.c. bose"] },
        { name: "DCRUST Murthal", keywords: ["dcrust", "deen bandhu"] }
    ],
    "Odisha": [
        { name: "Odisha University of Technology and Research (OUTR/CET)", keywords: ["outr", "cet bhubaneswar"] },
        { name: "VSSUT Burla", keywords: ["vssut", "veer surendra sai"] },
        { name: "KIIT Bhubaneswar", keywords: ["kiit", "kalinga institute"] },
        { name: "SOA University", keywords: ["soa", "siksha 'o' anusandhan"] }
    ],
    "Jharkhand": [
        { name: "BIT Mesra", keywords: ["bit mesra", "birla institute of technology"] },
        { name: "BIT Sindri", keywords: ["bit sindri"] }
    ]
};

function audit() {
    console.log("🕵️  National Gap Analysis in Progress...");
    console.log("-----------------------------------------");

    let totalMissing = 0;

    for (const [state, targets] of Object.entries(STATE_TARGEST)) {
        const filename = `${state}_Colleges.json`;
        const filePath = path.join(MODELS_DIR, filename);

        if (!fs.existsSync(filePath)) {
            console.log(`❌ [${state}] File Missing! Cannot audit.`);
            continue;
        }

        const content = fs.readFileSync(filePath, 'utf8');
        const colleges = JSON.parse(content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content);

        const missing = [];

        targets.forEach(t => {
            const found = colleges.find(c => {
                const name = c.name ? c.name.toLowerCase() : "";
                const id = c.id ? c.id.toLowerCase() : "";
                return t.keywords.some(k => name.includes(k) || id.includes(k));
            });

            if (!found) {
                missing.push(t.name);
            }
        });

        if (missing.length > 0) {
            console.log(`📍 ${state.replace('_', ' ')}: Missing ${missing.length}/${targets.length}`);
            missing.forEach(m => console.log(`   - ❌ ${m}`));
            totalMissing += missing.length;
        } else {
            console.log(`✅ ${state.replace('_', ' ')}: All Key Targets Found!`);
        }
    }

    console.log("-----------------------------------------");
    console.log(`🚨 TOTAL MISSING KEY COLLEGES: ${totalMissing}`);
}

audit();
