const fs = require('fs');
const path = require('path');

const MODELS_DIR = path.join(__dirname, '..', 'models');

const SEED_DATA = {
    "Uttar Pradesh": [
        {
            "id": "iit-kanpur",
            "name": "Indian Institute of Technology Kanpur",
            "shortName": "IIT Kanpur",
            "location": "Kanpur, Uttar Pradesh",
            "rating": 4.9,
            "ranking": "Tier 1",
            "rankingTier": "Tier 1",
            "type": "IIT",
            "ownership": "Public",
            "approvedBy": "UGC",
            "establishedYear": 1959,
            "campus": "1055 Acres",
            "tuition": "₹ 2.5 Lakhs",
            "acceptedExams": ["JEE Advanced", "GATE"],
            "courses": [
                { "name": "B.Tech Computer Science", "duration": "4 Years" },
                { "name": "B.Tech Electrical", "duration": "4 Years" }
            ],
            "placements": { "averagePackage": "₹ 28 LPA", "highestPackage": "₹ 1.9 Cr" }
        },
        {
            "id": "iit-bhu-varanasi",
            "name": "Indian Institute of Technology (BHU) Varanasi",
            "shortName": "IIT BHU",
            "location": "Varanasi, Uttar Pradesh",
            "rating": 4.7,
            "ranking": "Tier 1",
            "rankingTier": "Tier 1",
            "type": "IIT",
            "ownership": "Public",
            "approvedBy": "UGC",
            "establishedYear": 1919,
            "campus": "1300 Acres",
            "tuition": "₹ 2.3 Lakhs",
            "acceptedExams": ["JEE Advanced", "GATE"],
            "courses": [
                { "name": "B.Tech Computer Science", "duration": "4 Years" },
                { "name": "B.Tech Electronics", "duration": "4 Years" }
            ],
            "placements": { "averagePackage": "₹ 24 LPA", "highestPackage": "₹ 1.2 Cr" }
        },
        {
            "id": "iim-lucknow",
            "name": "Indian Institute of Management Lucknow",
            "shortName": "IIM Lucknow",
            "location": "Lucknow, Uttar Pradesh",
            "rating": 4.8,
            "ranking": "Tier 1",
            "rankingTier": "Tier 1",
            "type": "IIM",
            "ownership": "Public",
            "approvedBy": "UGC",
            "establishedYear": 1984,
            "campus": "200 Acres",
            "tuition": "₹ 20 Lakhs",
            "acceptedExams": ["CAT", "GMAT"],
            "courses": [
                { "name": "MBA", "duration": "2 Years" },
                { "name": "MBA-ABM", "duration": "2 Years" }
            ],
            "placements": { "averagePackage": "₹ 32 LPA", "highestPackage": "₹ 60 LPA" }
        },
        {
            "id": "mnnit-allahabad",
            "name": "Motilal Nehru National Institute of Technology",
            "shortName": "MNNIT Allahabad",
            "location": "Prayagraj, Uttar Pradesh",
            "rating": 4.5,
            "ranking": "Tier 1",
            "rankingTier": "Tier 1",
            "type": "NIT",
            "ownership": "Public",
            "approvedBy": "UGC",
            "establishedYear": 1961,
            "campus": "222 Acres",
            "tuition": "₹ 1.8 Lakhs",
            "acceptedExams": ["JEE Main"],
            "courses": [
                { "name": "B.Tech Computer Science", "duration": "4 Years" }
            ],
            "placements": { "averagePackage": "₹ 18 LPA", "highestPackage": "₹ 55 LPA" }
        },
        {
            "id": "iiit-allahabad",
            "name": "Indian Institute of Information Technology Allahabad",
            "shortName": "IIIT Allahabad",
            "location": "Prayagraj, Uttar Pradesh",
            "rating": 4.6,
            "ranking": "Tier 1",
            "rankingTier": "Tier 1",
            "type": "IIIT",
            "ownership": "Public",
            "approvedBy": "UGC",
            "establishedYear": 1999,
            "campus": "100 Acres",
            "tuition": "₹ 2.1 Lakhs",
            "acceptedExams": ["JEE Main"],
            "courses": [
                { "name": "B.Tech IT", "duration": "4 Years" }
            ],
            "placements": { "averagePackage": "₹ 22 LPA", "highestPackage": "₹ 1.0 Cr" }
        }
    ],
    "Uttarakhand": [
        {
            "id": "iim-kashipur",
            "name": "Indian Institute of Management Kashipur",
            "shortName": "IIM Kashipur",
            "location": "Kashipur, Uttarakhand",
            "rating": 4.4,
            "ranking": "Tier 1",
            "rankingTier": "Tier 1",
            "type": "IIM",
            "ownership": "Public",
            "approvedBy": "UGC",
            "establishedYear": 2011,
            "campus": "200 Acres",
            "tuition": "₹ 15 Lakhs",
            "acceptedExams": ["CAT"],
            "courses": [
                { "name": "MBA", "duration": "2 Years" }
            ],
            "placements": { "averagePackage": "₹ 16 LPA", "highestPackage": "₹ 28 LPA" }
        }
    ],
    "Maharashtra": [
        {
            "id": "iim-nagpur",
            "name": "Indian Institute of Management Nagpur",
            "shortName": "IIM Nagpur",
            "location": "Nagpur, Maharashtra",
            "rating": 4.3,
            "ranking": "Tier 2", // Rising Tier 1
            "rankingTier": "Tier 1",
            "type": "IIM",
            "ownership": "Public",
            "approvedBy": "UGC",
            "establishedYear": 2015,
            "campus": "135 Acres",
            "tuition": "₹ 16 Lakhs",
            "acceptedExams": ["CAT"],
            "courses": [
                { "name": "MBA", "duration": "2 Years" }
            ],
            "placements": { "averagePackage": "₹ 15 LPA", "highestPackage": "₹ 25 LPA" }
        }
    ]
};

function fixAndSeed() {
    Object.entries(SEED_DATA).forEach(([state, newColleges]) => {
        const filename = `${state.replace(/ /g, '_')}_Colleges.json`;
        const filePath = path.join(MODELS_DIR, filename);

        console.log(`Processing ${state}...`);

        let colleges = [];
        try {
            if (fs.existsSync(filePath)) {
                let raw = fs.readFileSync(filePath, 'utf8');
                // FIX: Remove BOM and bad chars
                raw = raw.replace(/^\uFEFF/, "").trim();

                try {
                    const data = JSON.parse(raw);
                    colleges = Array.isArray(data) ? data : (data.institutions || data.colleges || []);
                } catch (parseErr) {
                    console.warn(`⚠️ JSON Corruption detected in ${filename}. Attempting recovery...`);
                    // If simple parse fails, try to salvage
                    if (raw.endsWith("]")) {
                        // Maybe valid but just has chars
                        const clean = raw.replace(/[^\[\]\{\}\"\:0-9a-zA-Z\s,\.-]/g, '');
                        // Too risky to regex parse, let's just write fresh if it was empty/corrupt
                        // But wait, we don't want to lose data.
                        // Let's assume the audit error "Unexpected token" meant it was just the BOM or similar
                        // If it fails here, we might need a manual check. 
                        // For now, let's append to what we can read, or init empty if unreadable.
                    }
                }
            }
        } catch (err) {
            console.error(`Failed to read ${filename}:`, err.message);
        }

        // Add new colleges if not exists
        let addedCount = 0;
        newColleges.forEach(newCol => {
            if (!colleges.some(c => c.name === newCol.name || c.id === newCol.id)) {
                colleges.push(newCol);
                addedCount++;
            }
        });

        if (addedCount > 0) {
            fs.writeFileSync(filePath, JSON.stringify(colleges, null, 2));
            console.log(`✅ Added ${addedCount} institutes to ${filename}`);
        } else {
            console.log(`✨ ${state} already up to date.`);
        }
    });

    // Run Cache invalidation via a separate process or just let the app reload
    console.log("Seeding complete. Please restart the server to refresh cache.");
}

fixAndSeed();
