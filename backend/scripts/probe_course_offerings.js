const { MongoClient } = require('mongodb');

async function main() {
  const client = await MongoClient.connect('mongodb://localhost:27017');
  const db = client.db('cei_v2');

  // Count distinct institution_ids
  const distinctIds = await db.collection('course_offerings').distinct('institution_id');
  console.log('Distinct institution_ids in course_offerings:', distinctIds.length);
  console.log('Sample institution_ids:', distinctIds.slice(0, 5));

  // Check the institutions collection — what field matches?
  const instSample = await db.collection('institutions').find({}).limit(3).project({
    institution_id: 1, aicte_id: 1, institution_name: 1
  }).toArray();
  console.log('\nSample institution records (id fields):');
  console.log(JSON.stringify(instSample, null, 2));

  // Try to find a specific institution's courses via institution_id join
  const testInstId = distinctIds[0];
  const courses = await db.collection('course_offerings').find({ institution_id: testInstId }).limit(5).project({
    course_name: 1, course_level: 1, intake: 1, programme: 1, mode: 1
  }).toArray();
  console.log(`\nSample courses for institution_id="${testInstId}":`);
  console.log(JSON.stringify(courses, null, 2));

  // Cross-check: does an institution doc exist with matching institution_id?
  const matchInst = await db.collection('institutions').findOne({ institution_id: testInstId });
  console.log('\nMatching institution doc found?', !!matchInst, matchInst ? matchInst.institution_name : 'N/A');

  await client.close();
}

main().catch(console.error);
