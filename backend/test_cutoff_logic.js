const mongoose = require('mongoose');
const { getEngineeringCutoffs } = require('./services/engineeringCutoffReadService');

async function test() {
  await mongoose.connect('mongodb://localhost:27017/cei_v2');
  const db = mongoose.connection.db;

  const filters = { institutionId: 'CORE-IIT-BOMBAY' };
  
  const result = await getEngineeringCutoffs({
    db,
    filters,
    page: 1,
    limit: 2
  });

  console.log(`Found ${result.meta.total} records.`);
  if (result.items.length > 0) {
    console.log(`First item:`, result.items[0].institution.name);
    console.log(`Program:`, result.items[0].program.name);
  } else {
    console.log('No items returned!');
  }

  await mongoose.disconnect();
}

test().catch(console.error);
