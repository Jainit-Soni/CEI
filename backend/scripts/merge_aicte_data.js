const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function runMerge() {
  const masterPath = path.join(__dirname, '..', 'data', 'colleges.ndjson');
  const backupPath = `${masterPath}.bak`;
  const aictePath = path.join(__dirname, '..', 'data', 'truth', 'aicte_iceberg_truth.ndjson');
  const tempPath = `${masterPath}.tmp`;

  console.log('--- AICTE-ICEBERG MERGE STARTED ---');

  // 1. Backup master file
  if (fs.existsSync(masterPath)) {
    fs.copyFileSync(masterPath, backupPath);
    console.log('Backup created at:', backupPath);
  }

  // 2. Build AICTE Map
  const aicteMap = new Map();
  const aicteRl = readline.createInterface({ input: fs.createReadStream(aictePath), crlfDelay: Infinity });

  for await (const line of aicteRl) {
    if (!line.trim()) continue;
    try {
      const prog = JSON.parse(line);
      const id = prog.collegeId;
      if (!id) continue;

      if (!aicteMap.has(id)) {
        aicteMap.set(id, []);
      }
      aicteMap.get(id).push({
        name: prog.programName,
        degree: prog.degree,
        specialization: prog.specialization || prog.programName,
        intake: parseInt(prog.intake) || 0,
        duration: prog.duration || 'N/A',
        shift: prog.shift || 'FULL TIME',
        type: prog.programType || 'REGULAR'
      });
    } catch (e) {}
  }
  console.log(`Loaded AICTE data for ${aicteMap.size} unique institutions.`);

  // 3. Process Master File and Enrich
  const writer = fs.createWriteStream(tempPath);
  const masterRl = readline.createInterface({ input: fs.createReadStream(masterPath), crlfDelay: Infinity });

  let matched = 0;
  let totalProcessed = 0;
  let totalSeatsAdded = 0;

  for await (const line of masterRl) {
    if (!line.trim()) {
      writer.write('\n');
      continue;
    }
    totalProcessed++;
    try {
      const college = JSON.parse(line);
      const id = college.stableKey || college.aisheCode;

      if (id && aicteMap.has(id)) {
        const programs = aicteMap.get(id);
        const intakeSum = programs.reduce((sum, p) => sum + p.intake, 0);

        // Update college fields
        college.totalSeats = intakeSum;
        college.courses = programs;
        college.isTechnical = true;
        college.sourceMetadata = college.sourceMetadata || {};
        college.sourceMetadata.aicteVerified = true;
        college.sourceMetadata.lastSync = new Date().toISOString();

        matched++;
        totalSeatsAdded += intakeSum;
      }

      writer.write(JSON.stringify(college) + '\n');
    } catch (e) {
      writer.write(line + '\n');
    }
  }

  writer.end();

  // 4. Finalize
  await new Promise(resolve => writer.on('finish', resolve));
  fs.renameSync(tempPath, masterPath);

  console.log('\n--- MERGE COMPLETE ---');
  console.log(`Total Institutions Processed : ${totalProcessed.toLocaleString()}`);
  console.log(`Matches Found (Enriched)     : ${matched.toLocaleString()}`);
  console.log(`Total Verified Seats Added   : ${totalSeatsAdded.toLocaleString()}`);
  console.log(`Coverage Jump (Estimated)    : ${((matched/totalProcessed)*100).toFixed(1)}%`);
  console.log('----------------------\n');
}

runMerge().catch(console.error);
