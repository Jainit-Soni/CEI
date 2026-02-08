const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'backend', 'models', 'Gujarat_Colleges.json');
const content = fs.readFileSync(filePath, 'utf8');
const colleges = JSON.parse(content);

const pairs = [
    { short: 'iit-gandhinagar', long: 'indian-institute-of-technology-gandhinagar' },
    { short: 'pdeu-gandhinagar', long: 'pandit-deendayal-energy-univer-gandhinagar' },
    { short: 'svnit-surat', long: 'sardar-vallabhbhai-national-in-surat' },
    { short: 'svnit-surat', long: 'national-institute-of-technolo-surat' },
    { short: 'da-iict', long: 'dhirubhai-ambani-institute-of--gandhinagar' }
];

pairs.forEach(pair => {
    const s = colleges.find(c => c.id === pair.short);
    const l = colleges.find(c => c.id === pair.long);

    console.log(`Checking pair: ${pair.short} vs ${pair.long}`);
    if (s && l) {
        console.log(`  BOTH EXIST.`);
        console.log(`  Short Name: ${s.name}, Cutoff 2025: ${s.pastCutoffs.some(p => p.year === '2025')}`);
        console.log(`  Long Name: ${l.name}, Cutoff 2025: ${l.pastCutoffs.some(p => p.year === '2025')}`);
    } else {
        console.log(`  One or both missing.`);
        if (s) console.log(`  Short exists.`);
        if (l) console.log(`  Long exists.`);
    }
});
