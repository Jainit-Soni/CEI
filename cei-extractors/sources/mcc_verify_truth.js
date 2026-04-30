#!/usr/bin/env node

/**
 * MCC Truth Verification Script
 * Queries ingested medical data for verification.
 */

const { MongoClient } = require('mongodb');

const MONGO_URI = 'mongodb://localhost:27017';

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db('cei_v2');

  const targetId = 'CORE-AIIMS-DELHI'; // AIIMS Delhi
  console.log(`--- Verifying Truth for AIIMS Delhi (${targetId}) ---`);

  console.log('\n[SEATS]');
  const seats = await db.collection('medical_seat_matrix').find({ resolved_target_id: targetId }).toArray();
  if (seats.length === 0) {
    // Try by institution_id if the field name is different
    const seats2 = await db.collection('medical_seat_matrix').find({ institution_id: targetId }).toArray();
    seats2.forEach(s => console.log(`  - ${s.course_canonical} | ${s.quota_canonical} | ${s.category_canonical || 'ALL'}: ${s.seat_count}`));
  } else {
    seats.forEach(s => console.log(`  - ${s.course_canonical} | ${s.quota_canonical} | ${s.category_canonical || 'ALL'}: ${s.seat_count}`));
  }

  console.log('\n[CUTOFFS]');
  const cutoffs = await db.collection('medical_cutoffs').find({ institution_id: targetId }).toArray();
  cutoffs.sort((a, b) => a.round.localeCompare(b.round));
  cutoffs.forEach(c => {
    console.log(`  - ${c.round} | ${c.course_canonical} | ${c.category_canonical}: ${c.closing_rank}`);
  });

  if (seats.length === 0 && cutoffs.length === 0) {
    console.log('  No data found for AIIMS Delhi. Linkage may be missing.');
  }

  await client.close();
}

main().catch(console.error);
