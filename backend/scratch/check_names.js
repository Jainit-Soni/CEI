const { MongoClient } = require('mongodb');

async function run() {
  const client = await MongoClient.connect('mongodb://localhost:27017');
  const db = client.db('cei_v2');

  const testCases = [
    'Indian Institute of Technology Bhubaneswar',
    'National Institute of Technology Tiruchirappalli',
    'Maulana Azad National Institute of Technology Bhopal'
  ];

  const results = [];
  for (const name of testCases) {
    const college = await db.collection('institutions').findOne({ 
      $or: [{ name }, { shortName: name }] 
    });
    
    const cutoff = await db.collection('engineering_cutoffs').findOne({ 
      $or: [{ institute_name_normalized: name }, { institute_name_raw: name }] 
    });
    
    results.push({ 
      name, 
      foundInColleges: !!college, 
      foundInCutoffs: !!cutoff,
      collegeId: college ? college.id || college._id : null
    });
  }

  console.log('Match Results:');
  console.log(JSON.stringify(results, null, 2));

  // Check row counts for one of them to see if 500 is a safe limit
  if (results[0].foundInCutoffs) {
    const count = await db.collection('engineering_cutoffs').countDocuments({ 
      $or: [
        { institute_name_normalized: 'Indian Institute of Technology Bhubaneswar' }, 
        { institute_name_raw: 'Indian Institute of Technology Bhubaneswar' }
      ] 
    });
    console.log(`\nRow count for ${results[0].name}: ${count}`);
  }

  await client.close();
}

run().catch(console.error);
