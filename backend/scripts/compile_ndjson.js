const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Path to the models directory containing the [State]_Colleges.json files
const modelsDir = path.join(__dirname, '..', 'models');
// Output file paths
const outputNdjson = path.join(__dirname, '..', 'data', 'colleges.ndjson');

console.log('Starting NDJSON Compilation Process...');

// Ensure data directory exists
const dataDir = path.dirname(outputNdjson);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

try {
  // Find all State_Colleges.json files in the models directory
  const files = fs.readdirSync(modelsDir);
  const collegeFiles = files.filter(f => f.endsWith('_Colleges.json'));
  
  if (collegeFiles.length === 0) {
    console.error('No _Colleges.json files found in backend/models.');
    process.exit(1);
  }

  // Clear output file if it exists
  if (fs.existsSync(outputNdjson)) {
    fs.unlinkSync(outputNdjson);
  }

  const writeStream = fs.createWriteStream(outputNdjson, { flags: 'a' });
  let totalCollegesProcessed = 0;

  for (const file of collegeFiles) {
    const filePath = path.join(modelsDir, file);
    let fileContent = fs.readFileSync(filePath, 'utf8');
    
    // Strip BOM if present
    if (fileContent.charCodeAt(0) === 0xFEFF) {
      fileContent = fileContent.slice(1);
    }
    
    // Some files might be an array of objects
    try {
      const parsedData = JSON.parse(fileContent);
      
      if (Array.isArray(parsedData)) {
        for (const college of parsedData) {
          // Add default verification status if missing to match frontend expectations
          if (!college.verificationStatus) college.verificationStatus = 'VERIFIED';
          
          writeStream.write(JSON.stringify(college) + '\n');
          totalCollegesProcessed++;
        }
        console.log(`Processed ${file}: ${parsedData.length} colleges`);
      } else {
        console.warn(`File ${file} is not a JSON array, skipping.`);
      }
    } catch (parseErr) {
      console.error(`Error parsing JSON in file ${file}:`, parseErr.message);
    }
  }

  writeStream.end();
  
  writeStream.on('finish', () => {
    console.log('\n✅ NDJSON Compilation Complete!');
    console.log(`Successfully compiled ${totalCollegesProcessed} colleges into ${outputNdjson}`);
  });

} catch (err) {
  console.error('Fatal Error during compilation:', err);
}
