#!/usr/bin/env node

/**
 * MCC UG cutoff ingestion script
 * Ingests mapped cutoffs into MongoDB.
 */

const fs = require('fs-extra');
const path = require('path');
const { MongoClient } = require('mongodb');

const CONFIG = {
  dbUrl: 'mongodb://localhost:27017',
  dbName: 'cei_v2',
  collectionName: 'medical_cutoffs',
  sourcePath: 'e:/CMAT-PROBLEM/cei-extractors/sources/output/mcc_ug_selected_docs/parsed_results/mcc_ug_cutoffs_mapped_v2.ndjson'
};

async function main() {
  if (!(await fs.pathExists(CONFIG.sourcePath))) {
    throw new Error(`Missing ${CONFIG.sourcePath}`);
  }

  const client = new MongoClient(CONFIG.dbUrl);
  await client.connect();
  const db = client.db(CONFIG.dbName);
  const collection = db.collection(CONFIG.collectionName);

  // Create Index
  await collection.createIndex({ stable_import_key: 1 }, { unique: true });
  await collection.createIndex({ institution_id: 1 });

  console.log('Processing cutoffs...');
  const lines = (await fs.readFile(CONFIG.sourcePath, 'utf8')).split('\n').filter(Boolean);
  
  const ops = [];
  let ingestedCount = 0;

  for (const line of lines) {
    const row = JSON.parse(line);
    
    // Construct stable key
    const stableKey = `MCC||MCC_UG||${row.round}||${row.institute_raw}||${row.course}||${row.quota}||${row.category}`;

    const doc = {
      stable_import_key: stableKey,
      authority: 'MCC',
      counselling_variant: 'MCC_UG',
      round: row.round,
      institute_raw: row.institute_raw,
      course_canonical: row.course,
      quota_canonical: row.quota,
      category_canonical: row.category,
      closing_rank: row.closing_rank,
      
      institution_id: row.institution_id,
      institution_name_canonical: row.institution_name_canonical,
      is_resolved: row.is_resolved,
      match_score: row.match_score,
      
      ingested_at: new Date()
    };

    ops.push({
      updateOne: {
        filter: { stable_import_key: stableKey },
        update: { $set: doc },
        upsert: true
      }
    });

    if (ops.length >= 500) {
      await collection.bulkWrite(ops);
      ingestedCount += ops.length;
      ops.length = 0;
    }
  }

  if (ops.length > 0) {
    await collection.bulkWrite(ops);
    ingestedCount += ops.length;
  }

  console.log(`Ingested ${ingestedCount} cutoffs into ${CONFIG.collectionName}.`);
  await client.close();
}

main().catch(console.error);
