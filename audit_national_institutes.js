const fs = require('fs');
const path = require('path');

const MODELS_DIR = path.join(__dirname, 'backend/models');

// Master List of National Institutes (Simplified for Audit)
const NATIONAL_INSTITUTES = [
    // IITs (23)
    { id: "iit-bombay", name: "IIT Bombay", type: "IIT" },
    { id: "iit-delhi", name: "IIT Delhi", type: "IIT" },
    { id: "iit-madras", name: "IIT Madras", type: "IIT" },
    { id: "iit-kanpur", name: "IIT Kanpur", type: "IIT" },
    { id: "iit-kharagpur", name: "IIT Kharagpur", type: "IIT" },
    { id: "iit-roorkee", name: "IIT Roorkee", type: "IIT" },
    { id: "iit-guwahati", name: "IIT Guwahati", type: "IIT" },
    { id: "iit-hyderabad", name: "IIT Hyderabad", type: "IIT" },
    { id: "iit-indore", name: "IIT Indore", type: "IIT" },
    { id: "iit-bhu", name: "IIT BHU Varanasi", type: "IIT" },
    { id: "iit-dhanbad", name: "IIT ISM Dhanbad", type: "IIT" },
    { id: "iit-bhubaneswar", name: "IIT Bhubaneswar", type: "IIT" },
    { id: "iit-gandhinagar", name: "IIT Gandhinagar", type: "IIT" },
    { id: "iit-ropar", name: "IIT Ropar", type: "IIT" },
    { id: "iit-patna", name: "IIT Patna", type: "IIT" },
    { id: "iit-mandi", name: "IIT Mandi", type: "IIT" },
    { id: "iit-jodhpur", name: "IIT Jodhpur", type: "IIT" },
    { id: "iit-tirupati", name: "IIT Tirupati", type: "IIT" },
    { id: "iit-bhilai", name: "IIT Bhilai", type: "IIT" },
    { id: "iit-goa", name: "IIT Goa", type: "IIT" },
    { id: "iit-jammu", name: "IIT Jammu", type: "IIT" },
    { id: "iit-dharwad", name: "IIT Dharwad", type: "IIT" },
    { id: "iit-palakkad", name: "IIT Palakkad", type: "IIT" },

    // NITs (Examples of Top NITs, list 31 is long, checking key ones)
    { id: "nit-trichy", name: "NIT Trichy", type: "NIT" },
    { id: "nit-warangal", name: "NIT Warangal", type: "NIT" },
    { id: "nit-surathkal", name: "NIT Surathkal", type: "NIT" },
    { id: "nit-calicut", name: "NIT Calicut", type: "NIT" },
    { id: "mnit-jaipur", name: "MNIT Jaipur", type: "NIT" },
    { id: "mnnit-allahabad", name: "MNNIT Allahabad", type: "NIT" },
    { id: "vnit-nagpur", name: "VNIT Nagpur", type: "NIT" },
    { id: "nit-rourkela", name: "NIT Rourkela", type: "NIT" },
    { id: "nit-kurukshetra", name: "NIT Kurukshetra", type: "NIT" },
    { id: "svnit-surat", name: "SVNIT Surat", type: "NIT" },
    { id: "nit-durgapur", name: "NIT Durgapur", type: "NIT" },
    { id: "nit-silchar", name: "NIT Silchar", type: "NIT" },
    { id: "nit-hamirpur", name: "NIT Hamirpur", type: "NIT" },
    { id: "nit-jalandhar", name: "NIT Jalandhar", type: "NIT" },
    { id: "manit-bhopal", name: "MANIT Bhopal", type: "NIT" },
    { id: "nit-delhi", name: "NIT Delhi", type: "NIT" },

    // IIMs (Top ones)
    { id: "iim-ahmedabad", name: "IIM Ahmedabad", type: "IIM" },
    { id: "iim-bangalore", name: "IIM Bangalore", type: "IIM" },
    { id: "iim-calcutta", name: "IIM Calcutta", type: "IIM" },
    { id: "iim-lucknow", name: "IIM Lucknow", type: "IIM" },
    { id: "iim-kozhikode", name: "IIM Kozhikode", type: "IIM" },
    { id: "iim-indore", name: "IIM Indore", type: "IIM" },
    { id: "iim-mumbai", name: "IIM Mumbai", type: "IIM" }, // Old NITIE
    { id: "iim-shillong", name: "IIM Shillong", type: "IIM" }
];

function getCount(file) {
    if (!fs.existsSync(file)) return [];
    try {
        const content = fs.readFileSync(file, 'utf8');
        const cleanContent = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
        const json = JSON.parse(cleanContent);
        return Array.isArray(json) ? json : [];
    } catch (e) {
        return [];
    }
}

function audit() {
    console.log("🕵️  Auditing National Institutes Coverage...");

    // 1. Load ALL colleges into one look-up map
    const files = fs.readdirSync(MODELS_DIR).filter(f => f.endsWith('_Colleges.json'));
    const allColleges = [];
    files.forEach(f => {
        const colleges = getCount(path.join(MODELS_DIR, f));
        allColleges.push(...colleges);
    });

    console.log(`Scanning universe of ${allColleges.length} colleges...`);

    const missing = [];
    const found = [];

    NATIONAL_INSTITUTES.forEach(inst => {
        // loose match on ID or Name
        const match = allColleges.find(c =>
            c.id === inst.id ||
            c.id.includes(inst.id) ||
            c.name.toLowerCase().includes(inst.name.toLowerCase()) ||
            (c.shortName && c.shortName.toLowerCase().includes(inst.name.toLowerCase()))
        );

        if (match) {
            found.push(inst);
        } else {
            missing.push(inst);
        }
    });

    console.log(`\n✅ FOUND: ${found.length}`);
    console.log(`❌ MISSING: ${missing.length}`);

    if (missing.length > 0) {
        console.log("\n--- Missing Institutes ---");
        missing.forEach(m => console.log(`[${m.type}] ${m.name}`));
    }
}

audit();
