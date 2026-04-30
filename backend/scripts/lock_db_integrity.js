const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

async function rebuildIndexes() {
    console.log("🛠️  STARTING DB INDEX HARDENING...");
    
    const uri = process.env.MONGODB_URI + (process.env.MONGODB_URI.endsWith('/') ? '' : '/') + (process.env.MONGODB_DB || 'cei_v2');
    console.log(`📡 Connecting to: ${uri}`);
    
    await mongoose.connect(uri);
    const db = mongoose.connection.db;
    const collection = db.collection('institutions');

    try {
        console.log("🧹 Clearing existing indexes...");
        await collection.dropIndexes();
        
        console.log("🏗️  Building Production Indexes...");
        
        // 1. Uniqueness & Identity
        await collection.createIndex({ id: 1 }, { unique: true, name: 'idx_unique_id' });
        
        // 2. Geography & Search
        await collection.createIndex({ state: 1 }, { name: 'idx_state' });
        await collection.createIndex({ authority: 1 }, { name: 'idx_authority' });
        
        // 3. Truth Coverage (Critical for Decision Routing)
        await collection.createIndex({ "coverage.coverageBucket": 1 }, { name: 'idx_coverage_bucket' });
        await collection.createIndex({ isVisible: 1 }, { name: 'idx_visibility' });
        await collection.createIndex({ isCore: 1 }, { name: 'idx_core_status' });
        
        // 4. Intelligence & Scores
        await collection.createIndex({ identityConfidence: 1 }, { name: 'idx_identity_confidence' });
        await collection.createIndex({ ceiScore: -1 }, { name: 'idx_cei_score' });
        await collection.createIndex({ rankingTier: 1 }, { name: 'idx_ranking_tier' });

        console.log("✅ All production indexes hardened.");
        
        const indexes = await collection.listIndexes().toArray();
        console.log(`📊 Active Indexes: ${indexes.length}`);
        
    } catch (err) {
        console.error("💥 Index Hardening Failed:", err.message);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

rebuildIndexes();
