/**
 * scripts/backup.js — CEI Encrypted Nightly Dataset Backup (Phase XV)
 * ====================================================================
 * Creates a Merkle-verified, AES-256-GCM encrypted snapshot of all College records.
 * RPO target: 15 minutes. Run nightly (or on-demand).
 *
 * Output: output/backups/cei_backup_{YYYYMMDD_HHMMSS}.enc
 * Metadata: output/backups/cei_backup_{YYYYMMDD_HHMMSS}.meta.json
 *
 * Usage: node backend/scripts/backup.js
 * Env: BACKUP_ENCRYPTION_KEY (32-byte hex, 64 chars)
 *      MONGODB_URI (standard)
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env.local') });

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');

const BACKUP_DIR = path.resolve(__dirname, '../../output/backups');
const LOGGER = (() => { try { return require('../lib/logger'); } catch { return console; } })();

// ── Encryption Key ──────────────────────────────────────────────────────────

function getEncryptionKey() {
    const keyHex = process.env.BACKUP_ENCRYPTION_KEY;
    if (!keyHex || keyHex.length !== 64) {
        LOGGER.warn('[Backup] BACKUP_ENCRYPTION_KEY not set or not 64 hex chars. Generating ephemeral key. For production, set this in your environment.');
        const ephemeral = crypto.randomBytes(32).toString('hex');
        LOGGER.warn(`[Backup] Ephemeral key: ${ephemeral} — SAVE THIS to decrypt the backup.`);
        return Buffer.from(ephemeral, 'hex');
    }
    return Buffer.from(keyHex, 'hex');
}

// ── Merkle Root ─────────────────────────────────────────────────────────────

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
            const left = level[i];
            const right = level[i + 1] || left; // Duplicate last node for odd count
            next.push(crypto.createHash('sha256').update(left + right).digest('hex'));
        }
        level = next;
    }
    return level[0];
}

// ── AES-256-GCM Encryption ──────────────────────────────────────────────────

function encrypt(plaintext, key) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    // Format: iv (16 bytes) + authTag (16 bytes) + encrypted
    return Buffer.concat([iv, authTag, encrypted]);
}

// ── Main Backup ─────────────────────────────────────────────────────────────

async function main() {
    const startTime = Date.now();
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

    LOGGER.info('[Backup] Starting CEI dataset backup', { timestamp: ts });

    // Create output dir
    fs.mkdirSync(BACKUP_DIR, { recursive: true });

    // Connect
    await mongoose.connect(process.env.MONGODB_URI);
    LOGGER.info('[Backup] Connected to MongoDB');

    // Load College model
    const College = require('../models/CollegeSchema');

    // Stream all colleges in batches
    const batchSize = 500;
    let skip = 0;
    const ndjsonRows = [];
    const hashes = [];
    let total = 0;

    LOGGER.info('[Backup] Exporting college records...');

    while (true) {
        const batch = await College.find({}).skip(skip).limit(batchSize).lean();
        if (batch.length === 0) break;

        for (const rec of batch) {
            const rHash = computeRecordHash(rec);
            hashes.push(rHash);
            ndjsonRows.push(JSON.stringify(rec));
        }

        total += batch.length;
        skip += batchSize;
        LOGGER.info(`[Backup] Exported ${total} records...`);
    }

    const merkleRoot = computeMerkleRoot(hashes);
    const ndjson = ndjsonRows.join('\n');

    LOGGER.info(`[Backup] Total records: ${total} | Merkle root: ${merkleRoot}`);

    // Encrypt
    const key = getEncryptionKey();
    const encrypted = encrypt(ndjson, key);

    // Write backup file
    const backupFile = path.join(BACKUP_DIR, `cei_backup_${ts}.enc`);
    fs.writeFileSync(backupFile, encrypted);

    // Write metadata
    const meta = {
        version: '1.0',
        createdAt: new Date().toISOString(),
        recordCount: total,
        merkleRoot,
        algorithm: 'AES-256-GCM',
        ivLength: 16,
        authTagLength: 16,
        sizeBytes: encrypted.length,
        backupFile: path.basename(backupFile),
        durationMs: Date.now() - startTime
    };

    const metaFile = path.join(BACKUP_DIR, `cei_backup_${ts}.meta.json`);
    fs.writeFileSync(metaFile, JSON.stringify(meta, null, 2));

    LOGGER.info('[Backup] Backup complete.', meta);
    console.log('\n✅ CEI Backup complete:');
    console.log(`   File:         ${backupFile}`);
    console.log(`   Records:      ${total}`);
    console.log(`   Merkle Root:  ${merkleRoot}`);
    console.log(`   Size:         ${(encrypted.length / 1024).toFixed(1)} KB`);
    console.log(`   Duration:     ${meta.durationMs}ms`);

    await mongoose.disconnect();
    process.exit(0);
}

main().catch(async (err) => {
    LOGGER.error('[Backup] Backup failed', { error: err.message });
    console.error('❌ Backup failed:', err.message);
    try { await mongoose.disconnect(); } catch { /* ignore */ }
    process.exit(1);
});
