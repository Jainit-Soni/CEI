const fs = require('fs');
const path = require('path');

const MODELS_DIR = path.join(__dirname, '../models');
const ADMIN_UPDATES_FILE = path.join(MODELS_DIR, 'admin_updates.json');

function scanFiles() {
    console.log("🔍 Starting Data Audit...");
    const files = fs.readdirSync(MODELS_DIR).filter(f => /_Colleges\.json$/.test(f));

    let totalColleges = 0;
    let issues = [];

    files.forEach(file => {
        const filePath = path.join(MODELS_DIR, file);
        try {
            const content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ""); // Remove BOM
            const data = JSON.parse(content);

            // Normalize data structure
            let list = [];
            if (Array.isArray(data)) list = data;
            else if (data.institutions) list = data.institutions;
            else if (data.colleges) list = data.colleges;
            else {
                // Try finding any array property
                const key = Object.keys(data).find(k => Array.isArray(data[k]));
                if (key) list = data[key];
            }

            list.forEach((college, index) => {
                totalColleges++;

                // Check 1: Critical Missing Fields
                if (!college.id || !college.name) {
                    issues.push({
                        file,
                        index,
                        type: "CRITICAL_MISSING_DATA",
                        details: `Missing ID or Name. Name: ${college.name || 'N/A'}`
                    });
                }

                // Check 2: Test Data Patterns
                const name = (college.name || "").toLowerCase();
                const id = (college.id || "").toString().toLowerCase();
                if (name.includes("test college") || name.includes("demo institute") || id.includes("test_")) {
                    issues.push({
                        file,
                        id: college.id,
                        type: "TEST_DATA",
                        details: `Found 'test' or 'demo' in name/id: ${college.name}`
                    });
                }

                // Check 3: Unverified / Placeholder
                if (college.verificationStatus === "unverified") {
                    issues.push({
                        file,
                        id: college.id,
                        type: "UNVERIFIED_STATUS",
                        details: `Explicitly marked as unverified`
                    });
                }
            });

        } catch (e) {
            console.error(`❌ Failed to parse ${file}: ${e.message}`);
        }
    });

    console.log(`\n✅ Scanned ${totalColleges} colleges across ${files.length} files.`);

    // Check Admin Updates
    if (fs.existsSync(ADMIN_UPDATES_FILE)) {
        const updates = JSON.parse(fs.readFileSync(ADMIN_UPDATES_FILE, 'utf8'));
        console.log(`\n📂 Admin Updates: ${updates.added.length} added, ${updates.deleted.length} deleted.`);

        updates.added.forEach(c => {
            if (c.name.toLowerCase().includes("test")) {
                issues.push({ type: "ADMIN_TEST_DATA", id: c.id, details: `Admin added test college: ${c.name}` });
            }
        });
    }

    if (issues.length > 0) {
        console.log(`\n⚠️ Found ${issues.length} issues:`);
        issues.forEach(i => console.log(`   - [${i.type}] ${i.file ? i.file + ': ' : ''}${i.details}`));
    } else {
        console.log("\n✨ No data integrity issues found in JSON files.");
    }
}

scanFiles();
