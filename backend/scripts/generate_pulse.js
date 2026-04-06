const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function generate() {
  const dataPath = path.join(__dirname, '..', 'data', 'colleges.ndjson');
  const colleges = [];

  if (!fs.existsSync(dataPath)) {
    console.error('Data file not found at:', dataPath);
    process.exit(1);
  }

  const rl = readline.createInterface({ 
    input: fs.createReadStream(dataPath), 
    crlfDelay: Infinity 
  });

  for await (const line of rl) {
    if (!line.trim()) continue;
    try { colleges.push(JSON.parse(line)); } catch (e) {}
  }

  const total = colleges.length;
  
  const stats = {
    timestamp: new Date().toISOString(),
    overall: {
      totalColleges: total,
      verifiedSeats: colleges.filter(c => c.totalSeats > 0).length,
      coursesListed: colleges.filter(c => c.courses && c.courses.length > 0).length,
      cutoffsTracked: colleges.filter(c => c.pastCutoffs && c.pastCutoffs.length > 0).length,
      placementData: colleges.filter(c => c.placements && (c.placements.averagePackageNumeric > 0 || c.placements.medianSalaryLPA > 0)).length,
      feeStructures: colleges.filter(c => c.fees && (c.fees.totalNumeric > 0 || c.fees.total)).length,
      nirfRanked: colleges.filter(c => c.rankings && c.rankings.length > 0).length,
      websitesVerified: colleges.filter(c => c.website && c.website.trim()).length,
      gpsMapped: colleges.filter(c => c.coordinates && c.coordinates.lat).length
    },
    percentages: {}
  };

  // Calculate percentages
  Object.keys(stats.overall).forEach(key => {
    if (key === 'totalColleges') return;
    stats.percentages[key] = ((stats.overall[key] / total) * 100).toFixed(1);
  });

  const outputPath = path.join(__dirname, '..', '..', 'frontend', 'src', 'data', 'metadata_pulse.json');
  const outputDir = path.dirname(outputPath);
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(stats, null, 2));
  console.log(`Pulse data generated at: ${outputPath}`);
  console.log(`Total Colleges: ${total}`);
}

generate().catch(console.error);
