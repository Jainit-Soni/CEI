const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

// Configuration
const CONFIG = {
  dbUrl: 'mongodb://localhost:27017',
  dbName: 'cei_v2',
  collectionName: 'medical_seat_matrix',
  sourcePath: 'e:/CMAT-PROBLEM/cei-extractors/sources/output/mcc_ug_selected_docs/parsed_seat_matrix/mcc_ug_seat_matrix_clean_headers.ndjson',
  bridgeDir: 'E:/CMAT-PROBLEM/cei-extractors/output/mcc_bridge_audit'
};

/**
 * Load NDJSON file into a lookup map
 */
function loadLookup(filePath, keyFn, status) {
  const map = new Map();
  if (!fs.existsSync(filePath)) return map;
  
  const lines = fs.readFileSync(filePath, 'utf8').split('\n').filter(Boolean);
  for (const line of lines) {
    const data = JSON.parse(line);
    const key = keyFn(data);
    map.set(key, { ...data, bridge_status: status });
  }
  return map;
}

async function main() {
  console.log('--- MCC Seat Matrix Ingestion ---');
  
  // 1. Load Bridge Data
  console.log('Loading bridge metadata...');
  const keyFn = (d) => `${d.mcc_id || ''}||${d.clean_name || ''}`;
  
  const resolved = loadLookup(path.join(CONFIG.bridgeDir, 'mcc_identity_bridge.ndjson'), keyFn, 'resolved');
  const ambiguous = loadLookup(path.join(CONFIG.bridgeDir, 'mcc_identity_ambiguous.ndjson'), keyFn, 'ambiguous');
  const missing = loadLookup(path.join(CONFIG.bridgeDir, 'mcc_identity_missing.ndjson'), keyFn, 'unmatched');

  console.log(`Loaded ${resolved.size} resolved, ${ambiguous.size} ambiguous, ${missing.size} unmatched bridge mappings.`);

  // 2. Connect to Mongo
  const client = new MongoClient(CONFIG.dbUrl);
  await client.connect();
  const db = client.db(CONFIG.dbName);
  const collection = db.collection(CONFIG.collectionName);

  // Create Unique Index
  await collection.createIndex({ stable_import_key: 1 }, { unique: true });

  // 3. Process Seat Matrix
  console.log('Processing seat matrix documents...');
  const seatMatrixLines = fs.readFileSync(CONFIG.sourcePath, 'utf8').split('\n').filter(Boolean);
  
  const stats = {
    read: 0,
    upserted: 0,
    statusCount: {
      manual_override: 0,
      auto_match_v2: 0,
      auto_match_legacy: 0,
      ambiguous: 0,
      unmatched: 0,
      unknown: 0
    }
  };

  const ops = [];

  for (const line of seatMatrixLines) {
    const row = JSON.parse(line);
    stats.read++;
    
    // Identity Key for Bridge Lookup
    const bridgeKey = `${row.mcc_id || ''}||${row.institution_name_clean || ''}`;
    
    // Resolve Bridge Status
    let bridgeResult = resolved.get(bridgeKey) || ambiguous.get(bridgeKey) || missing.get(bridgeKey);
    let bridgeStatus = 'unmatched';

    if (bridgeResult) {
      if (bridgeResult.bridge_status === 'resolved') {
        if (bridgeResult.source === 'manual_override') bridgeStatus = 'manual_override';
        else if (bridgeResult.source === 'v2') bridgeStatus = 'auto_match_v2';
        else bridgeStatus = 'auto_match_legacy';
      } else {
        bridgeStatus = bridgeResult.bridge_status;
      }
    }

    stats.statusCount[bridgeStatus]++;

    // Construct Stable Key
    // Using authority||variant||round||entity_key as entity_key already contains normalized content
    const stableKey = `${row.authority}||${row.counselling_variant}||${row.round_inferred}||${row.entity_key}`;

    // Construct Document
    const doc = {
      stable_import_key: stableKey,
      
      // Raw/Clean Identifiers
      mcc_id: row.mcc_id,
      institution_name_raw: row.institution_name_raw,
      institution_header_raw: row.institution_header_raw,
      institution_name_clean: row.institution_name_clean,
      
      // Core Seat Data
      authority: row.authority,
      counselling_variant: row.counselling_variant,
      round: row.round_inferred,
      course_canonical: row.course_canonical,
      course_name_raw: row.course_name_raw,
      quota_canonical: row.quota_canonical,
      category_canonical: row.category_canonical,
      category_raw: row.category_raw,
      seat_count: row.seat_count,
      
      // Bridge Resolution
      is_resolved: bridgeStatus.startsWith('manual') || bridgeStatus.startsWith('auto'),
      bridge_status: bridgeStatus,
      is_manual_override: bridgeStatus === 'manual_override',
      resolved_target_db: bridgeResult ? (bridgeResult.target_db || (bridgeResult.source === 'v2' ? 'cei_v2' : 'cei_legacy')) : null,
      resolved_target_id: bridgeResult ? bridgeResult.target_id : null,
      resolved_target_name: bridgeResult ? bridgeResult.target_name : null,
      match_confidence: bridgeResult ? bridgeResult.confidence : 0,
      
      // Provenance & Audit
      provenance: row.provenance,
      source_file: path.basename(row.file_path || ''),
      ingested_at: new Date(),
      metadata: {
        parse_status: row.parse_status,
        confidence_score: row.confidence_score,
        document_title: row.document_title
      }
    };

    ops.push({
      updateOne: {
        filter: { stable_import_key: stableKey },
        update: { $set: doc },
        upsert: true
      }
    });

    if (ops.length >= 500) {
      const result = await collection.bulkWrite(ops);
      stats.upserted += (result.upsertedCount + result.modifiedCount);
      ops.length = 0;
    }
  }

  if (ops.length > 0) {
    const result = await collection.bulkWrite(ops);
    stats.upserted += (result.upsertedCount + result.modifiedCount);
  }

  // 4. Report
  const finalCount = await collection.countDocuments();
  
  console.log('\n--- Ingestion Summary ---');
  console.log(`Rows Read:     ${stats.read}`);
  console.log(`Ops Processed: ${stats.upserted} (Upserts/Updates)`);
  console.log(`Final Count:  ${finalCount}`);
  console.log('\n--- Bridge Status Distribution ---');
  Object.entries(stats.statusCount).forEach(([status, count]) => {
    if (count > 0) console.log(`${status.padEnd(20)}: ${count}`);
  });

  await client.close();
}

main().catch(console.error);
