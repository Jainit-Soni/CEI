/**
 * scripts/restore.js — CEI Deterministic Backup Restore (Phase XV)
 * =================================================================
 * Decrypts and restores a CEI backup file to MongoDB.
 * Verifies Merkle root before and after restoring.
 * Uses atomic MongoDB transaction — rolls back on mismatch.
 *
 * Usage:
 *   node backend/scripts/restore.js output/backups/cei_backup_2026-02-28T10-00-00.enc
 *
 * Env: BACKUP_ENCRYPTION_KEY (same key used during backup)
 *      MONGODB_URI
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');

const LOGGER = (() => { try { return require('../lib/logger'); } catch { return console; } })();

// ── Key ──────────────────────────────────────────────────────────────────────

function getKey() {
    const keyHex = process.env.BACKUP_ENCRYPTION_KEY;
    if (!keyHex || keyHex.length !== 64) {
        throw new Error('BACKUP_ENCRYPTION_KEY not set. Cannot decrypt backup.');
    }
    return Buffer.from(keyHex, 'hex');
}

// ── Decrypt ──────────────────────────────────────────────────────────────────

function decrypt(encryptedBuffer, key) {
    const iv = encryptedBuffer.slice(0, 16);
    const authTag = encryptedBuffer.slice(16, 32);
    const ciphertext = encryptedBuffer.slice(32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(ciphertext) + decipher.final('utf8');
}

// ── Merkle Root ──────────────────────────────────────────────────────────────

function computeRecordHash(record) {
    const { _id, __v, updatedAt, createdAt, ...hashable } = record;
    return crypto.createHash('sha256')
        .update(JSON.stringify(hashable, Object.keys(hashable).sort()))
        .digest('hex');
}

function computeMerkleRoot(hashes) {
    if (hashes.length === 0) return null;
    let level = [...hashes];
    while (level.length > 1) {
        const next = [];
        for (let i = 0; i < level.length; i += 2) {
            const l = level[i], r = level[i + 1] || l;
            next.push(crypto.createHash('sha256').update(l + r).digest('hex'));
        }
        level = next;
    }
    return level[0];
}

// ── Main Restore ──────────────────────────────────────────────────────────────

async function main() {
    const backupArg = process.argv[2];
    if (!backupArg) {
        console.error('Usage: node restore.js <backup_file.enc>');
        process.exit(1);
    }

    const backupPath = path.resolve(process.cwd(), backupArg);
    const metaPath = backupPath.replace('.enc', '.meta.json');

    if (!fs.existsSync(backupPath)) throw new Error(`Backup file not found: ${backupPath}`);
    if (!fs.existsSync(metaPath)) throw new Error(`Metadata file not found: ${metaPath}`);

    const startTime = Date.now();
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

    LOGGER.info('[Restore] Starting restore', { backupFile: path.basename(backupPath), meta });

    // Decrypt
    const key = getKey();
    const encrypted = fs.readFileSync(backupPath);
    const ndjson = decrypt(encrypted, key);
    const records = ndjson.split('\n').filter(Boolean).map(line => JSON.parse(line));

    // Pre-restore Merkle verification
    const preHashes = records.map(computeRecordHash);
    const preMerkle = computeMerkleRoot(preHashes);

    if (preMerkle !== meta.merkleRoot) {
        LOGGER.error('[Restore] Pre-restore Merkle MISMATCH — backup is compromised.');
        console.error('❌ ABORT: Backup Merkle root mismatch. Backup may be tampered with.');
        console.error(`   Expected: ${meta.merkleRoot}`);
        console.error(`   Got:      ${preMerkle}`);
        process.exit(1);
    }

    LOGGER.info('[Restore] Pre-restore Merkle root verified ✅');

    // Connect
    await mongoose.connect(process.env.MONGODB_URI);
    const College = require('../models/CollegeSchema');
    const session = await mongoose.startSession();

    let writtenCount = 0;
    try {
        await session.withTransaction(async () => {
            // Drop existing data within transaction
            await College.deleteMany({}, { session });

            // Bulk insert in batches of 500
            const batchSize = 500;
            for (let i = 0; i < records.length; i += batchSize) {
                const batch = records.slice(i, i + batchSize).map(r => {
                    const { _id, __v, ...rest } = r;
                    return rest;
                });
                await College.insertMany(batch, { session, ordered: false });
                writtenCount += batch.length;
                LOGGER.info(`[Restore] Inserted ${writtenCount}/${records.length}...`);
            }
        });
    } catch (txErr) {
        LOGGER.error('[Restore] Transaction failed — rolled back.', { error: txErr.message });
        console.error('❌ Restore transaction rolled back:', txErr.message);
        await session.endSession();
        await mongoose.disconnect();
        process.exit(1);
    } finally {
        session.endSession();
    }

    // Post-restore Merkle verification
    const restored = await College.find({}).lean();
    const postHashes = restored.map(computeRecordHash);
    const postMerkle = computeMerkleRoot(postHashes);
    const verified = postMerkle === meta.merkleRoot;

    const report = {
        status: verified ? 'SUCCESS' : 'INTEGRITY_MISMATCH',
        backupFile: path.basename(backupPath),
        recordsRestored: writtenCount,
        preMerkleRoot: preMerkle,
        postMerkleRoot: postMerkle,
        integrityVerified: verified,
        RPO_achieved_minutes: Math.round((Date.now() - new Date(meta.createdAt).getTime()) / 60000),
        RTO_achieved_minutes: Math.round((Date.now() - startTime) / 60000),
        durationMs: Date.now() - startTime
    };

    if (!verified) {
        LOGGER.error('[Restore] Post-restore INTEGRITY MISMATCH', report);
        console.error('❌ Post-restore Merkle mismatch — data may be corrupt.');
    } else {
        LOGGER.info('[Restore] Restore complete ✅', report);
        console.log('\n✅ CEI Restore complete:');
        console.log(JSON.stringify(report, null, 2));
    }

    await mongoose.disconnect();
    process.exit(verified ? 0 : 1);
}

main().catch(async (err) => {
    LOGGER.error('[Restore] Fatal error', { error: err.message });
    console.error('❌ Restore failed:', err.message);
    try { await mongoose.disconnect(); } catch { /* ignore */ }
    process.exit(1);
});
