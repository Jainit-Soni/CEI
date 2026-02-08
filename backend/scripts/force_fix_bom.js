const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'models', 'Uttar_Pradesh_Colleges.json');

try {
    console.log("Reading file...");
    let raw = fs.readFileSync(filePath, 'utf8');

    // Check for BOM
    if (raw.charCodeAt(0) === 0xFEFF) {
        console.log("BOM detected! Removing...");
        raw = raw.slice(1);
    } else {
        console.log("No BOM detected at char 0.");
        // Check manually for the weird char just in case
        if (raw.startsWith("\uFEFF")) {
            console.log("BOM detected via string check! Removing...");
            raw = raw.replace(/^\uFEFF/, "");
        }
    }

    const data = JSON.parse(raw);
    console.log(`Successfully parsed. Contains ${data.length} colleges.`);

    // Write back cleanly
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log("File saved with clean encoding.");

} catch (err) {
    console.error("Error:", err.message);
}
