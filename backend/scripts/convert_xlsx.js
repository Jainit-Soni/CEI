const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const filesToConvert = [
    { input: 'College-ALL COLLEGE.xlsx', output: 'data/aishe_colleges.csv' },
    { input: 'Standalone-ALL STANDALONE.xlsx', output: 'data/aishe_standalone.csv' },
    { input: 'University-ALL UNIVERSITIES.xlsx', output: 'data/aishe_university.csv' }
];

console.log('Starting batch Excel to CSV conversion...');

for (const { input, output } of filesToConvert) {
    const excelFilePath = path.join(__dirname, '..', input);
    const csvFilePath = path.join(__dirname, '..', output);

    if (!fs.existsSync(excelFilePath)) {
        console.warn(`⚠️ File not found: ${input}, skipping...`);
        continue;
    }

    console.log(`\nReading ${input}...`);
    const workbook = xlsx.readFile(excelFilePath);

    console.log(`Converting ${input} to CSV...`);
    const sheetName = workbook.SheetNames[0];
    const csvData = xlsx.utils.sheet_to_csv(workbook.Sheets[sheetName]);

    if (!fs.existsSync(path.dirname(csvFilePath))) {
        fs.mkdirSync(path.dirname(csvFilePath), { recursive: true });
    }

    fs.writeFileSync(csvFilePath, csvData, 'utf-8');
    console.log(`✅ Saved to ${output}`);

    // Peek at the first 2 lines (header + 1 data row) to verify structure
    const lines = csvData.split('\n').slice(0, 2);
    console.log(`--- Header Peek for ${input} ---`);
    console.log(lines[0]);
    console.log(lines[1]);
}

console.log('\n🎉 Entire batch conversion complete!');
