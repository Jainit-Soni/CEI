const mongoose = require('mongoose');
require('dotenv').config({ path: 'backend/.env.local' });
const fs = require('fs');
const path = require('path');

async function generateMapping() {
    try {
        await mongoose.connect(process.env.MONGODB_URI, { dbName: 'cei_v2' });
        const db = mongoose.connection.db;

        // 1. Fetch all CORE institutions
        const coreInstitutions = await db.collection('institutions').find({ isCore: true }).toArray();

        const engineering_map = {};
        const mcc_map = {
            "200502": "CORE-AIIMS-DELHI",
            "200505": "CORE-AIIMS-JODHPUR",
            "200506": "CORE-AIIMS-RAIPUR",
            "200508": "CORE-AIIMS-PATNA",
            "200512": "CORE-AIIMS-DEOGARH",
            "200513": "CORE-AIIMS-GORAKHPUR",
            "200514": "CORE-AIIMS-KALYANI",
            "200518": "CORE-AIIMS-VIJAYPUR",
            "200519": "CORE-AIIMS-BIBINAGAR", // Heuristic
            "200520": "CORE-AIIMS-BHUBANESWAR", // Heuristic
            "200580": "CORE-AIIMS-MADURAI"
        };

        const city_aliases = {
            "Mumbai": "Bombay",
            "Chennai": "Madras",
            "PRAYAGRAJ": "ALLAHABAD",
            "New Delhi": "Delhi",
            "Tiruchirappalli": "Tiruchirapalli", // Common typo in JoSAA
            "Gwalior": "ABV-IIITM Gwalior", // Special case
            "Dhanbad": "ISM Dhanbad" // Special case
        };

        coreInstitutions.forEach(inst => {
            const id = inst.id;
            let name = inst.name;
            if (id && name) {
                // 1. Direct Canonical Name
                engineering_map[name] = id;

                // 2. Comma-free version
                const commaFree = name.replace(/,/g, '').replace(/\s+/g, ' ').trim();
                engineering_map[commaFree] = id;

                // 3. City Alias variants (e.g. "IIT Mumbai" -> "IIT Bombay")
                Object.entries(city_aliases).forEach(([modern, legacy]) => {
                    if (name.includes(modern)) {
                        const legacyName = name.replace(modern, legacy);
                        engineering_map[legacyName] = id;
                        engineering_map[legacyName.replace(/,/g, '').replace(/\s+/g, ' ').trim()] = id;
                        
                        // Also try the "IIT Legacy" short version
                        if (name.includes('Indian Institute of Technology')) {
                            const shortLegacy = legacyName.replace('Indian Institute of Technology', 'IIT').trim();
                            engineering_map[shortLegacy] = id;
                            engineering_map[shortLegacy.replace(/,/g, '')] = id;
                        }
                    }
                });

                // 4. Default Acronym variation
                if (name.includes('Indian Institute of Technology')) {
                    const alt = name.replace('Indian Institute of Technology', 'IIT').trim();
                    engineering_map[alt] = id;
                    engineering_map[alt.replace(/,/g, '')] = id;
                }
                if (name.includes('National Institute of Technology')) {
                    const alt = name.replace('National Institute of Technology', 'NIT').trim();
                    engineering_map[alt] = id;
                    engineering_map[alt.replace(/,/g, '')] = id;
                }
                if (name.includes('Indian Institute of Information Technology')) {
                    const alt = name.replace('Indian Institute of Information Technology', 'IIIT').trim();
                    engineering_map[alt] = id;
                    engineering_map[alt.replace(/,/g, '')] = id;
                }
            }
        });

        const mapping = {
            version: "1.0.0",
            updatedAt: new Date().toISOString(),
            engineering_map,
            mcc_map
        };

        const targetPath = path.join(__dirname, '..', 'data', 'truth', 'core_id_mapping_batch1.json');
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.writeFileSync(targetPath, JSON.stringify(mapping, null, 2));

        console.log(`Successfully generated mapping for ${Object.keys(engineering_map).length} engineering institutions and ${Object.keys(mcc_map).length} medical institutions.`);
        console.log(`Saved to: ${targetPath}`);

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

generateMapping();
