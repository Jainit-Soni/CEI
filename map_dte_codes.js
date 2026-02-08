const fs = require('fs');
const path = require('path');

const COLLEGES_FILE = path.join(__dirname, 'backend/models/Maharashtra_Colleges.json');
const DTE_MASTER_FILE = path.join(__dirname, 'backend/data_sources/maharashtra_dte_master.json');

function loadJson(file) {
    if (!fs.existsSync(file)) return [];
    const content = fs.readFileSync(file, 'utf8');
    const cleanContent = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
    return JSON.parse(cleanContent);
}

function saveJson(file, data) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function mapCodes() {
    console.log("🗺️  Starting Automated DTE Code Mapping...");

    const colleges = loadJson(COLLEGES_FILE);
    const dteMaster = loadJson(DTE_MASTER_FILE);
    let mappedCount = 0;

    console.log(`Loaded ${colleges.length} colleges and ${dteMaster.length} DTE master records.`);

    dteMaster.forEach(dte => {
        // Try strict ID match first, then fuzzy name match
        let target = colleges.find(c => c.id === dte.id);

        if (!target) {
            // Fuzzy match: Look for college containing the dte name in its name/id
            // or vice versa, but be careful.
            // Simplified: Look for key identifying parts
            const keywords = dte.name.replace(/College of Engineering|Institute of Technology|Mumbai|Pune/gi, "").trim().split(" ");
            target = colleges.find(c => {
                const cName = c.name.toLowerCase();
                const dName = dte.name.toLowerCase();
                // If DTE name is very specific (like "Veermata Jijabai"), check if college name has it
                if (dName.includes("veermata") && cName.includes("veermata")) return true;
                if (dName.includes("coep") && cName.includes("coep")) return true;
                if (dName.includes("pict") && (cName.includes("pict") || c.id.includes("pict"))) return true;
                if (dName.includes("vit") && c.id === "vit-pune") return true;

                // Fallback: check if college ID matches mapped ID in our master list (which is the primary key here actually)
                // wait, the master list has "id" field which I intentionally set to match probable IDs.
                // The loop above `colleges.find(c => c.id === dte.id)` should have caught it if I guessed the ID right.
                return false;
            });
        }

        if (target) {
            if (!target.dteCode) {
                target.dteCode = dte.dteCode;
                // Also add to meta for audit
                target.meta = target.meta || {};
                target.meta.dteMappingSource = "automated_search_match";
                mappedCount++;
                console.log(`[+] Mapped: ${dte.dteCode} -> ${target.name} (${target.id})`);
            } else if (target.dteCode !== dte.dteCode) {
                console.log(`[!] Conflict: ${target.name} has ${target.dteCode}, master says ${dte.dteCode}. Overwriting.`);
                target.dteCode = dte.dteCode;
                mappedCount++;
            }
        } else {
            // Second pass: try to find by fuzzy ID match from Master list keys
            // e.g. Master has "dy-patil-akurdi", DB might have "dr-d-y-patil-..."
            const looseTarget = colleges.find(c => c.id.includes(dte.id.split("-")[0]) && c.location.toLowerCase().includes(dte.name.toLowerCase().split(" ")[0]));
            // This is risky. Let's rely on the manual ID map I built in master file primarily.
            console.log(`[?] Could not find target for DTE ${dte.dteCode} (${dte.name}) using ID ${dte.id}`);
        }
    });

    if (mappedCount > 0) {
        saveJson(COLLEGES_FILE, colleges);
        console.log(`\n✅ Successfully mapped ${mappedCount} colleges to official DTE codes.`);
    } else {
        console.log("\n✨ No new mappings applied.");
    }
}

mapCodes();
