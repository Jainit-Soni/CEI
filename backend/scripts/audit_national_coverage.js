const fs = require('fs');
const path = require('path');

const MODELS_DIR = path.join(__dirname, '..', 'models');

// Master List of "Crown Jewel" Institutes
const TARGET_INSTITUTES = [
    // IITs (23)
    { shortName: "IIT Madras", name: "Indian Institute of Technology Madras", state: "Tamil Nadu", type: "IIT" },
    { shortName: "IIT Delhi", name: "Indian Institute of Technology Delhi", state: "Delhi", type: "IIT" },
    { shortName: "IIT Bombay", name: "Indian Institute of Technology Bombay", state: "Maharashtra", type: "IIT" },
    { shortName: "IIT Kanpur", name: "Indian Institute of Technology Kanpur", state: "Uttar Pradesh", type: "IIT" },
    { shortName: "IIT Kharagpur", name: "Indian Institute of Technology Kharagpur", state: "West Bengal", type: "IIT" },
    { shortName: "IIT Roorkee", name: "Indian Institute of Technology Roorkee", state: "Uttarakhand", type: "IIT" },
    { shortName: "IIT Guwahati", name: "Indian Institute of Technology Guwahati", state: "Assam", type: "IIT" },
    { shortName: "IIT Hyderabad", name: "Indian Institute of Technology Hyderabad", state: "Telangana", type: "IIT" },
    { shortName: "IIT Indore", name: "Indian Institute of Technology Indore", state: "Madhya Pradesh", type: "IIT" },
    { shortName: "IIT BHU", name: "Indian Institute of Technology (BHU) Varanasi", state: "Uttar Pradesh", type: "IIT" },
    { shortName: "IIT Jodhpur", name: "Indian Institute of Technology Jodhpur", state: "Rajasthan", type: "IIT" },
    { shortName: "IIT Gandhinagar", name: "Indian Institute of Technology Gandhinagar", state: "Gujarat", type: "IIT" },
    { shortName: "IIT Patna", name: "Indian Institute of Technology Patna", state: "Bihar", type: "IIT" },
    { shortName: "IIT Ropar", name: "Indian Institute of Technology Ropar", state: "Punjab", type: "IIT" },
    { shortName: "IIT Bhubaneswar", name: "Indian Institute of Technology Bhubaneswar", state: "Odisha", type: "IIT" },
    { shortName: "IIT Mandi", name: "Indian Institute of Technology Mandi", state: "Himachal Pradesh", type: "IIT" },
    { shortName: "IIT Palakkad", name: "Indian Institute of Technology Palakkad", state: "Kerala", type: "IIT" },
    { shortName: "IIT Tirupati", name: "Indian Institute of Technology Tirupati", state: "Andhra Pradesh", type: "IIT" },
    { shortName: "IIT Jammu", name: "Indian Institute of Technology Jammu", state: "Jammu and Kashmir", type: "IIT" },
    { shortName: "IIT Dharwad", name: "Indian Institute of Technology Dharwad", state: "Karnataka", type: "IIT" },
    { shortName: "IIT Bhilai", name: "Indian Institute of Technology Bhilai", state: "Chhattisgarh", type: "IIT" },
    { shortName: "IIT Goa", name: "Indian Institute of Technology Goa", state: "Goa", type: "IIT" },
    { shortName: "ISM Dhanbad", name: "Indian Institute of Technology (ISM) Dhanbad", state: "Jharkhand", type: "IIT" },

    // IIMs (21) -> Critical for User's "IIM Ahmedabad" request
    { shortName: "IIM Ahmedabad", name: "Indian Institute of Management Ahmedabad", state: "Gujarat", type: "IIM" },
    { shortName: "IIM Bangalore", name: "Indian Institute of Management Bangalore", state: "Karnataka", type: "IIM" },
    { shortName: "IIM Calcutta", name: "Indian Institute of Management Calcutta", state: "West Bengal", type: "IIM" },
    { shortName: "IIM Lucknow", name: "Indian Institute of Management Lucknow", state: "Uttar Pradesh", type: "IIM" },
    { shortName: "IIM Kozhikode", name: "Indian Institute of Management Kozhikode", state: "Kerala", type: "IIM" },
    { shortName: "IIM Indore", name: "Indian Institute of Management Indore", state: "Madhya Pradesh", type: "IIM" },
    { shortName: "IIM Shillong", name: "Indian Institute of Management Shillong", state: "Meghalaya", type: "IIM" },
    { shortName: "IIM Rohtak", name: "Indian Institute of Management Rohtak", state: "Haryana", type: "IIM" },
    { shortName: "IIM Ranchi", name: "Indian Institute of Management Ranchi", state: "Jharkhand", type: "IIM" },
    { shortName: "IIM Raipur", name: "Indian Institute of Management Raipur", state: "Chhattisgarh", type: "IIM" },
    { shortName: "IIM Tiruchirappalli", name: "Indian Institute of Management Tiruchirappalli", state: "Tamil Nadu", type: "IIM" },
    { shortName: "IIM Kashipur", name: "Indian Institute of Management Kashipur", state: "Uttarakhand", type: "IIM" },
    { shortName: "IIM Udaipur", name: "Indian Institute of Management Udaipur", state: "Rajasthan", type: "IIM" },
    { shortName: "IIM Nagpur", name: "Indian Institute of Management Nagpur", state: "Maharashtra", type: "IIM" },
    { shortName: "IIM Visakhapatnam", name: "Indian Institute of Management Visakhapatnam", state: "Andhra Pradesh", type: "IIM" },
    { shortName: "IIM Bodh Gaya", name: "Indian Institute of Management Bodh Gaya", state: "Bihar", type: "IIM" },
    { shortName: "IIM Amritsar", name: "Indian Institute of Management Amritsar", state: "Punjab", type: "IIM" },
    { shortName: "IIM Sambalpur", name: "Indian Institute of Management Sambalpur", state: "Odisha", type: "IIM" },
    { shortName: "IIM Sirmaur", name: "Indian Institute of Management Sirmaur", state: "Himachal Pradesh", type: "IIM" },
    { shortName: "IIM Jammu", name: "Indian Institute of Management Jammu", state: "Jammu and Kashmir", type: "IIM" },
    { shortName: "IIM Mumbai", name: "Indian Institute of Management Mumbai", state: "Maharashtra", type: "IIM" },

    // NITs (Top Picks)
    { shortName: "NIT Trichy", name: "National Institute of Technology Tiruchirappalli", state: "Tamil Nadu", type: "NIT" },
    { shortName: "NIT Warangal", name: "National Institute of Technology Warangal", state: "Telangana", type: "NIT" },
    { shortName: "NIT Surathkal", name: "National Institute of Technology Karnataka", state: "Karnataka", type: "NIT" },
    { shortName: "NIT Calicut", name: "National Institute of Technology Calicut", state: "Kerala", type: "NIT" },
    { shortName: "NIT Rourkela", name: "National Institute of Technology Rourkela", state: "Odisha", type: "NIT" },
    { shortName: "MNIT Jaipur", name: "Malaviya National Institute of Technology", state: "Rajasthan", type: "NIT" },
    { shortName: "VNIT Nagpur", name: "Visvesvaraya National Institute of Technology", state: "Maharashtra", type: "NIT" },
    { shortName: "NIT Kurukshetra", name: "National Institute of Technology Kurukshetra", state: "Haryana", type: "NIT" },
    { shortName: "NIT Durgapur", name: "National Institute of Technology Durgapur", state: "West Bengal", type: "NIT" },
    { shortName: "MNNIT Allahabad", name: "Motilal Nehru National Institute of Technology", state: "Uttar Pradesh", type: "NIT" },

    // IIITs (Top Picks)
    { shortName: "IIIT Hyderabad", name: "International Institute of Information Technology Hyderabad", state: "Telangana", type: "IIIT" },
    { shortName: "IIIT Bangalore", name: "International Institute of Information Technology Bangalore", state: "Karnataka", type: "IIIT" },
    { shortName: "IIIT Delhi", name: "Indraprastha Institute of Information Technology Delhi", state: "Delhi", type: "IIIT" },
    { shortName: "IIIT Allahabad", name: "Indian Institute of Information Technology Allahabad", state: "Uttar Pradesh", type: "IIIT" },
    { shortName: "IIITM Gwalior", name: "Atal Bihari Vajpayee Indian Institute of Information Technology and Management", state: "Madhya Pradesh", type: "IIIT" },
];

function loadAllColleges() {
    if (!fs.existsSync(MODELS_DIR)) return [];
    const files = fs.readdirSync(MODELS_DIR).filter((file) => /_Colleges\.json$/i.test(file));
    let combined = [];

    files.forEach(file => {
        try {
            const content = fs.readFileSync(path.join(MODELS_DIR, file), 'utf8');
            const data = JSON.parse(content);
            let list = [];
            if (Array.isArray(data)) list = data;
            else if (data.institutions) list = data.institutions;
            else if (data.colleges) list = data.colleges;

            combined.push(...list);
        } catch (e) {
            console.error(`Error reading ${file}:`, e.message);
        }
    });
    return combined;
}

function checkCoverage() {
    console.log("🔍 Auditing National Coverage for CEI...");
    const existingColleges = loadAllColleges();
    console.log(`📚 Current Database Size: ${existingColleges.length} colleges`);

    let missingCount = 0;
    const missing = [];

    TARGET_INSTITUTES.forEach(target => {
        // Normalization for matching
        const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

        const exists = existingColleges.find(c => {
            if (!c.name) return false;
            if (normalize(c.name) === normalize(target.name)) return true;
            if (c.shortName && normalize(c.shortName) === normalize(target.shortName)) return true;
            if (c.name.includes(target.name) || target.name.includes(c.name)) {
                // Weak fuzzy check requires at least significant overlap
                return normalize(c.name).includes(normalize(target.shortName)) || normalize(c.name).includes("indianinstitute");
            }
            return false;
        });

        if (!exists) {
            missingCount++;
            missing.push(target);
            console.log(`❌ MISSING: [${target.type}] ${target.name} (${target.state})`);
        } else {
            // console.log(`✅ FOUND: ${target.shortName}`);
        }
    });

    console.log("\n--- AUDIT RESULTS ---");
    console.log(`Total Targets: ${TARGET_INSTITUTES.length}`);
    console.log(`Found: ${TARGET_INSTITUTES.length - missingCount}`);
    console.log(`Missing: ${missingCount}`);

    // Generate specific seed instructions
    if (missingCount > 0) {
        console.log("\n--- SEEDING INSTRUCTIONS ---");
        const seedMap = {};
        missing.forEach(m => {
            if (!seedMap[m.state]) seedMap[m.state] = [];
            seedMap[m.state].push(m);
        });
        console.log(JSON.stringify(seedMap, null, 2));
    }
}

checkCoverage();
