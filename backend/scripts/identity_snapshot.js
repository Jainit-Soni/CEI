/**
 * backend/scripts/identity_snapshot.js
 * ====================================
 * Daily identity registry snapshot system.
 * Prevents irreversible data loss and enables identity audit trails.
 */

const fs = require('fs');
const path = require('path');

const REGISTRY_PATH = path.join(__dirname, '..', 'data', 'truth', 'identity_registry.json');
const CODE_REGISTRY_PATH = path.join(__dirname, '..', 'data', 'truth', 'official_code_registry.json');
const SNAPSHOT_DIR = path.join(__dirname, '..', 'data', 'identity_snapshots');

function createSnapshot() {
    try {
        if (!fs.existsSync(SNAPSHOT_DIR)) {
            fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });
        }

        const date = new Date().toISOString().split('T')[0];
        const timestamp = new Date().getTime();
        
        const registrySnapPath = path.join(SNAPSHOT_DIR, `${date}_identity_registry.json`);
        const codeSnapPath = path.join(SNAPSHOT_DIR, `${date}_official_code_registry.json`);

        if (fs.existsSync(REGISTRY_PATH)) {
            fs.copyFileSync(REGISTRY_PATH, registrySnapPath);
            console.log(`✅ Identity Registry Snapshot created: ${registrySnapPath}`);
        }

        if (fs.existsSync(CODE_REGISTRY_PATH)) {
            fs.copyFileSync(CODE_REGISTRY_PATH, codeSnapPath);
            console.log(`✅ Official Code Registry Snapshot created: ${codeSnapPath}`);
        }

        // Cleanup: Keep only last 30 days
        const files = fs.readdirSync(SNAPSHOT_DIR);
        if (files.length > 60) { // 30 days * 2 files
            const sorted = files.sort();
            const toDelete = sorted.slice(0, files.length - 60);
            toDelete.forEach(f => {
                fs.unlinkSync(path.join(SNAPSHOT_DIR, f));
                console.log(`🗑️  Cleaned up old snapshot: ${f}`);
            });
        }

    } catch (err) {
        console.error("❌ Snapshot failed:", err.message);
    }
}

createSnapshot();
