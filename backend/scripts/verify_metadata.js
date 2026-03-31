const fs = require('fs');
const readline = require('readline');
const path = require('path');

async function auditData() {
  const dataPath = path.join(__dirname, '..', 'data', 'colleges.ndjson');
  if (!fs.existsSync(dataPath)) {
    console.error('Data file not found!');
    return;
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(dataPath),
    crlfDelay: Infinity
  });

  let total = 0;
  let withCourses = 0;
  let withCutoffs = 0;
  let withPlacements = 0;
  let withTuition = 0;
  let withSeats = 0;

  for await (const line of rl) {
    if (!line.trim()) continue;
    total++;
    const college = JSON.parse(line);

    if (college.courses && college.courses.length > 0) {
      withCourses++;
      // Check if any course in this college has seat/intake data
      const hasSeats = college.courses.some(c => c.seats || c.intake);
      if (hasSeats || college.seats || college.totalIntake) {
        withSeats++;
      }
    }
    if (college.pastCutoffs && college.pastCutoffs.length > 0) {
      withCutoffs++;
    }
    if (college.placements && Object.keys(college.placements).length > 0) {
      withPlacements++;
    }
    if (college.tuition) {
      withTuition++;
    }
  }

  console.log('\n======================================================');
  console.log('                 CEI DATA AUDIT REPORT                 ');
  console.log('======================================================');
  console.log(`Total Verified Colleges Ingested : ${total}`);
  console.log(`Colleges with 'courses' data     : ${withCourses} (${((withCourses/total)*100).toFixed(1)}%)`);
  console.log(`Colleges with 'pastCutoffs' data : ${withCutoffs} (${((withCutoffs/total)*100).toFixed(1)}%)`);
  console.log(`Colleges with 'placements' data  : ${withPlacements} (${((withPlacements/total)*100).toFixed(1)}%)`);
  console.log(`Colleges with 'tuition' info     : ${withTuition} (${((withTuition/total)*100).toFixed(1)}%)`);
  console.log(`Colleges with 'seats/intake' info: ${withSeats} (${((withSeats/total)*100).toFixed(1)}%)`);
  console.log('======================================================\n');
}

auditData();
