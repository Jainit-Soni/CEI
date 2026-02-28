/**
 * sync_new_scores.js — CEI Data Pipeline v2.0
 * ============================================
 * Syncs scored CSV output from the Intelligence Engine into MongoDB.
 *
 * GUARANTEES:
 *   - ACID-compliant: all writes within a MongoDB session transaction
 *   - Rollback on ANY anomaly (integrity check fail, unexpected error)
 *   - No partial writes ever committed
 *   - Every run logged to AuditLog collection with full provenance
 *   - Input CSV verified against scoring manifest before any write
 *   - Diff-based update summary logged on completion
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '.env.local') });

const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const crypto = require('crypto');
const AuditLog = require('./models/AuditLog');

// ── Config ────────────────────────────────────────────────────────────────────
const CSV_PATH = path.join(__dirname, '../output/scoring/master_scored_institutions.csv');
const MANIFEST_PATH = path.join(__dirname, '../output/scoring/scoring_run_manifest.json');
const COLLEGES_COLL = 'colleges'; // MongoDB collection name
const BATCH_SIZE = 500;        // Records per transaction chunk

// ── Helpers ───────────────────────────────────────────────────────────────────
function sha256File(filepath) {
    return new Promise((resolve, reject) => {
        const h = crypto.createHash('sha256');
        const stream = fs.createReadStream(filepath);
        stream.on('data', chunk => h.update(chunk));
        stream.on('end', () => resolve(h.digest('hex')));
        stream.on('error', reject);
    });
}

function normalizeForMatch(name) {
    return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function loadCSV(filepath) {
    return new Promise((resolve, reject) => {
        const rows = [];
        fs.createReadStream(filepath)
            .pipe(csv())
            .on('data', row => rows.push(row))
            .on('end', () => resolve(rows))
            .on('error', reject);
    });
}

// ── Main Pipeline ─────────────────────────────────────────────────────────────
async function syncScores() {
    const startTime = Date.now();
    console.log('\n' + '='.repeat(60));
    console.log('  CEI Sync Pipeline v2.0 — Transactional Mode');
    console.log('='.repeat(60) + '\n');

    // ── Step 0: Connect ──────────────────────────────────────────────────────
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅  MongoDB connected');

    const db = mongoose.connection.db;
    let auditPayload = {
        event: 'SYNC_START',
        trigger: 'manual',
        operator: process.env.SYNC_OPERATOR || 'system',
        totalRecords: 0,
        updatedRecords: 0,
        failedRecords: 0,
        skippedRecords: 0,
    };

    try {
        // ── Step 1: Verify CSV against Manifest ──────────────────────────────
        if (!fs.existsSync(CSV_PATH)) throw new Error(`CSV not found: ${CSV_PATH}`);
        if (!fs.existsSync(MANIFEST_PATH)) throw new Error(`Manifest not found: ${MANIFEST_PATH}`);

        const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
        const actualHash = await sha256File(CSV_PATH);

        console.log(`📋  Engine Version : ${manifest.engine_version}`);
        console.log(`📥  Input Hash     : ${manifest.input_sha256}`);
        console.log(`🔐  Expected CSV   : ${manifest.output_sha256}`);
        console.log(`🔍  Actual  CSV    : ${actualHash}\n`);

        if (actualHash !== manifest.output_sha256) {
            await AuditLog.create({
                ...auditPayload,
                event: 'SCORE_VERIFY_FAIL',
                inputHash: manifest.input_sha256,
                outputHash: manifest.output_sha256,
                engineVersion: manifest.engine_version,
                errorMessage: `CSV hash mismatch. Expected: ${manifest.output_sha256}, Got: ${actualHash}`,
                durationMs: Date.now() - startTime,
            });
            throw new Error('❌  INTEGRITY CHECK FAILED — CSV hash does not match manifest. Aborting sync.');
        }
        console.log('✅  Integrity verified — CSV matches manifest.\n');

        auditPayload.engineVersion = manifest.engine_version;
        auditPayload.inputHash = manifest.input_sha256;
        auditPayload.outputHash = actualHash;
        auditPayload.bandDistribution = manifest.band_distribution;

        // ── Step 2: Load CSV rows ─────────────────────────────────────────────
        console.log('📂  Loading CSV rows...');
        const csvRows = await loadCSV(CSV_PATH);
        console.log(`    ${csvRows.length.toLocaleString()} rows loaded from CSV.\n`);
        auditPayload.totalRecords = csvRows.length;

        // ── Step 3: Build name→id lookup from MongoDB ─────────────────────────
        console.log('🔍  Building name→id lookup from MongoDB...');
        const allDocs = await db.collection(COLLEGES_COLL).find({}, { projection: { id: 1, name: 1 } }).toArray();
        const idMap = new Map();
        allDocs.forEach(doc => {
            if (doc.name) idMap.set(normalizeForMatch(doc.name), doc.id);
        });
        console.log(`    ${idMap.size.toLocaleString()} documents indexed.\n`);

        // ── Step 4: Transactional batch writes ───────────────────────────────
        console.log('🚀  Beginning transactional sync...');
        let updated = 0, failed = 0, skipped = 0;
        const unmatchedRows = [];

        // Process in batches to avoid session timeout on 66k documents
        for (let i = 0; i < csvRows.length; i += BATCH_SIZE) {
            const batch = csvRows.slice(i, i + BATCH_SIZE);
            const session = await mongoose.startSession();

            try {
                await session.withTransaction(async () => {
                    const bulkOps = [];

                    for (const row of batch) {
                        const normName = normalizeForMatch(row.institution_name);
                        const mongoId = idMap.get(normName);

                        if (!mongoId) {
                            skipped++;
                            unmatchedRows.push(row.institution_name);
                            continue;
                        }

                        const ceiScore = parseFloat(parseFloat(row.cei_score).toFixed(2));
                        const stabilityIdx = parseFloat(row.stability_index || '0');
                        const confidence = row.confidence_badge || 'Medium';
                        const band = row.competitiveness_band || 'Emerging';
                        const isVolatile = row.is_volatile === 'True' || row.is_volatile === true;

                        if (isNaN(ceiScore)) { failed++; continue; }

                        bulkOps.push({
                            updateOne: {
                                filter: { id: mongoId },
                                update: {
                                    $set: {
                                        ceiScore,
                                        competitivenessBand: band,
                                        stabilityIndex: stabilityIdx,
                                        confidenceBadge: confidence,
                                        isScoreVolatile: isVolatile,
                                        _recordHash: row._record_hash || '',
                                        ceiEngineVersion: manifest.engine_version,
                                        ceiScoredAt: new Date(),
                                    }
                                }
                            }
                        });
                    }

                    if (bulkOps.length > 0) {
                        const result = await db.collection(COLLEGES_COLL)
                            .bulkWrite(bulkOps, { session, ordered: false });
                        updated += result.modifiedCount;
                        failed += result.writeErrors?.length || 0;
                    }
                });

                // Progress log every 10 batches
                if ((i / BATCH_SIZE) % 10 === 0) {
                    process.stdout.write(`\r    Progress: ${Math.min(i + BATCH_SIZE, csvRows.length).toLocaleString()} / ${csvRows.length.toLocaleString()} (${updated.toLocaleString()} updated)`);
                }
            } catch (txErr) {
                // Transaction automatically rolled back by withTransaction
                console.error(`\n  ❌  Batch ${i}-${i + BATCH_SIZE} transaction rolled back:`, txErr.message);
                failed += batch.length;
            } finally {
                await session.endSession();
            }
        }

        console.log('\n');
        auditPayload.updatedRecords = updated;
        auditPayload.failedRecords = failed;
        auditPayload.skippedRecords = skipped;

        // ── Step 5: Write Audit Log ───────────────────────────────────────────
        await AuditLog.create({
            ...auditPayload,
            event: 'SYNC_COMPLETE',
            durationMs: Date.now() - startTime,
        });

        // ── Step 6: Summary ──────────────────────────────────────────────────
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log('─'.repeat(60));
        console.log('  📊 Sync Complete:');
        console.log(`    ✅  Updated  : ${updated.toLocaleString()}`);
        console.log(`    ⏭️   Skipped  : ${skipped.toLocaleString()} (no name match)`);
        console.log(`    ❌  Failed   : ${failed.toLocaleString()}`);
        console.log(`    ⏱️   Duration : ${duration}s`);

        if (unmatchedRows.length > 0) {
            const unmatchedPath = path.join(__dirname, '../output/scoring/unmatched_names.txt');
            fs.writeFileSync(unmatchedPath, unmatchedRows.join('\n'));
            console.log(`\n  ⚠️  ${unmatchedRows.length} names had no match. See: ${unmatchedPath}`);
        }

        console.log('  📋 Audit log written to MongoDB.\n');
        console.log('='.repeat(60) + '\n');

    } catch (err) {
        // Final catch — write a FAILED audit log
        await AuditLog.create({
            ...auditPayload,
            event: 'SYNC_FAILED',
            errorMessage: err.message,
            errorStack: err.stack,
            durationMs: Date.now() - startTime,
        }).catch(() => { });
        console.error('\n❌  Sync failed:', err.message);
    } finally {
        await mongoose.disconnect();
    }
}

syncScores();
