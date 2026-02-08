const { getColleges } = require('./services/dataStore');

async function checkPayload() {
    const colleges = await getColleges();
    const json = JSON.stringify(colleges);
    const sizeMB = (json.length / 1024 / 1024).toFixed(2);
    console.log(`Total Colleges: ${colleges.length}`);
    console.log(`Payload Size: ${sizeMB} MB`);
    process.exit(0);
}

checkPayload();
