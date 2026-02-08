const fs = require('fs');
const path = require('path');

const COLLEGES_FILE = path.join(__dirname, 'backend/models/Maharashtra_Colleges.json');

function loadJson(file) {
    if (!fs.existsSync(file)) return [];
    const content = fs.readFileSync(file, 'utf8');
    const cleanContent = content.charCodeAt(0) === 0xFEFF ? content.slice(1) : content;
    return JSON.parse(cleanContent);
}

function find() {
    console.log("🔍 Searching 'Next 20' Maharashtra Colleges...");
    const colleges = loadJson(COLLEGES_FILE);

    // Keywords for popular colleges
    const keywords = [
        "Somaiya", "K.J.", // K J Somaiya
        "Sanghvi", "Dwarkadas", // DJ Sanghvi
        "Thadomal", "Shahani", // Thadomal Shahani
        "VESIT", "Vivekanand", // VESIT
        "Cummins", // Cummins College (Pune)
        "D.Y. Patil", "Ramrao", // DY Patil (Various)
        "MIT", "Maharashtra Institute of Technology", // MIT Pune/WPU
        "Bhartiya Vidya Bhavan", // Sardar Patel (Checking for un-aided)
        "Fr. Conceicao", "Agnel", // Fr. Agnel
        "Thakur", // Thakur College
        "Rizvi", // Rizvi
        "Atharva", // Atharva
        "Rajiv Gandhi", // Rajiv Gandhi IT
        "SIES", // SIES
        "Datta Meghe", // Datta Meghe
        "Terna", // Terna
        "Pimpri Chinchwad", // PCCoE (Checking repeats)
        "Genba Sopanrao", // Moze
        "JSPM", // JSPM
        "Singhad", "Sinhgad" // Sinhgad Institutes
    ];

    const found = {};

    colleges.forEach(c => {
        keywords.forEach(k => {
            if (
                c.name.toLowerCase().includes(k.toLowerCase()) ||
                (c.shortName && c.shortName.toLowerCase().includes(k.toLowerCase()))
            ) {
                if (!found[k]) found[k] = [];
                found[k].push({ id: c.id, name: c.name, loc: c.location });
            }
        });
    });

    // Filter out empties and print
    Object.keys(found).forEach(k => {
        if (found[k].length > 0) {
            console.log(`\n--- ${k} ---`);
            // Limit to top 3 matches per keyword to avoid noise
            found[k].slice(0, 3).forEach(m => console.log(`  ${m.id}: ${m.name}`));
        }
    });
}

find();
