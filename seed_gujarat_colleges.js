const fs = require('fs');
const path = require('path');

const COLLEGES_FILE = path.join(__dirname, 'backend/models/Gujarat_Colleges.json');
const MASTER_LIST_FILE = path.join(__dirname, 'backend/data_sources/gujarat_master_list.json');

function loadJson(file) {
    if (!fs.existsSync(file)) return [];
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function saveJson(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function seed() {
    console.log("🌱 Starting Gujarat Database Seeding...");

    const existingColleges = loadJson(COLLEGES_FILE);
    const masterList = loadJson(MASTER_LIST_FILE);

    console.log(`Current Database Size: ${existingColleges.length} colleges`);
    console.log(`Master List Size: ${masterList.length} colleges to process`);

    let addedCount = 0;

    for (const newCollege of masterList) {
        const exists = existingColleges.some(c => c.id === newCollege.id);

        if (!exists) {
            // Create Skeleton Entry
            const skeleton = {
                id: newCollege.id,
                name: newCollege.name,
                shortName: newCollege.name.replace("Government Engineering College", "GEC").replace("Institute of Technology", "IOT"), // Simple shortener
                location: newCollege.location,
                type: newCollege.type,
                rankingTier: newCollege.type === "Government" ? "Tier 2" : "Tier 3", // Rough heuristic
                acceptedExams: ["gujcet", "jee-main"],
                courses: [
                    { name: "B.Tech Computer Engineering", degree: "B.Tech", duration: "4 years", exams: ["gujcet", "jee-main"] },
                    { name: "B.Tech Mechanical Engineering", degree: "B.Tech", duration: "4 years", exams: ["gujcet", "jee-main"] },
                    { name: "B.Tech Civil Engineering", degree: "B.Tech", duration: "4 years", exams: ["gujcet", "jee-main"] },
                    { name: "B.Tech Electrical Engineering", degree: "B.Tech", duration: "4 years", exams: ["gujcet", "jee-main"] }
                ],
                pastCutoffs: [],
                meta: {
                    seeded: true,
                    dateAdded: new Date().toISOString()
                }
            };

            existingColleges.push(skeleton);
            addedCount++;
            console.log(`[+] Added: ${newCollege.name} (${newCollege.id})`);
        } else {
            console.log(`[=] Skipped (Exists): ${newCollege.id}`);
        }
    }

    if (addedCount > 0) {
        saveJson(COLLEGES_FILE, existingColleges);
        console.log(`\n✅ Successfully seeded ${addedCount} new colleges into Gujarat_Colleges.json`);
    } else {
        console.log("\n✨ No new colleges to add. Database is up to date with Master List.");
    }
}

seed();
