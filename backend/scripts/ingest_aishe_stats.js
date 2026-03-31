const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

// Paths
const EXCEL_PATH = path.join(__dirname, '../../Final/AISHE/AISHE Final Report 2021-22 (1).xlsx');
const OUTPUT_PATH = path.join(__dirname, '../data/truth/stats_truth.ndjson');

console.log('🚀 Phase 21: AISHE Compliance Surge (Multi-Row Logic)...');
console.log('📖 Reading Excel:', EXCEL_PATH);

try {
    const workbook = xlsx.readFile(EXCEL_PATH);
    
    // Helper to extract data from a Sheet following the State -> Year-Row pattern
    const extractStateData = (sheetName, targetYear, valueIndex) => {
        const sheet = workbook.Sheets[sheetName];
        const json = xlsx.utils.sheet_to_json(sheet, { header: 1 });
        const map = {};
        let currentState = null;

        json.forEach(row => {
            // A new state row starts with a number in Col 0 and State Name in Col 1
            if (row && typeof row[0] === 'number' && typeof row[1] === 'string' && row[1].trim()) {
                currentState = row[1].trim().toLowerCase();
            }
            // A data row has the Year in Col 1
            if (row && currentState && row[1] === targetYear && !isNaN(row[valueIndex])) {
                map[currentState] = parseFloat(row[valueIndex]);
            }
        });
        return map;
    };

    // Sheet 60 (49PTR 25) - Pupil Teacher Ratio
    // PTR Total is usually index 2 based on audit: [null, "2021-22", 25, 16...]
    const ptrMap = extractStateData('49PTR 25', '2021-22', 2);
    console.log(`✅ Extracted PTR for ${Object.keys(ptrMap).length} States/UTs`);

    // Sheet 54 (43ENRLT 6) - Total Enrollment
    // Enrollment Total is likely also index 2
    const enrlMap = extractStateData('43ENRLT 6', '2021-22', 2);
    console.log(`✅ Extracted Enrollment for ${Object.keys(enrlMap).length} States/UTs`);

    // Merge into NDJSON format by State
    const writeStream = fs.createWriteStream(OUTPUT_PATH);
    Object.keys(ptrMap).forEach(state => {
        const obj = {
            entityType: 'state_benchmark',
            state: state,
            ptr: ptrMap[state],
            enrollment: enrlMap[state] || 0,
            academicYear: '2021-22',
            source: 'AISHE Final Report 2021-22'
        };
        writeStream.write(JSON.stringify(obj) + '\n');
    });
    writeStream.end();

    console.log(`🏆 Ingestion Complete! Saved to ${OUTPUT_PATH}`);

} catch (error) {
    console.error('❌ Error reading AISHE Excel:', error.message);
}
