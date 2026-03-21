const mongoose = require('mongoose');

/**
 * CEI MongoDB Connection — Production Grade
 * ==========================================
 * readPreference: 'secondaryPreferred'
 *   → Reads route to the replica node when one exists (Option 3 — Read Replica).
 *   → When Atlas has no replica set enabled, automatically falls back to primary.
 *   → Prevents analytics/search queries from competing with write ops.
 *
 * To enable a read replica on Atlas:
 *   1. Cluster → Edit → Enable M10+ tier (minimum for replicas)
 *   2. Atlas automatically manages replica election
 *   3. No code change required — readPreference handles the routing
 */
const connectDB = async () => {
    try {
        let uri = process.env.MONGODB_URI;
        const dbName = process.env.MONGODB_DB;
        
        // If URI doesn't contain the DB name but MONGODB_DB is provided, append it
        if (dbName && uri && !uri.includes(`/${dbName}`) && uri.endsWith('/')) {
            uri = `${uri}${dbName}`;
        } else if (dbName && uri && !uri.includes(`/${dbName}`) && !uri.includes('?', uri.indexOf('://') + 3)) {
            // Handle case where URI might not end in / and doesn't have params
            if (!uri.split('/').pop().includes(':')) {
                // Already has a DB name? Let's be safe and just log it
            } else {
                uri = `${uri}/${dbName}`;
            }
        }

        console.log(`[DB] Connecting to URI: ${uri}`);
        const conn = await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 5000,
            readPreference: 'secondaryPreferred',
            maxPoolSize: 20,
            minPoolSize: 2,
            socketTimeoutMS: 30000,
            heartbeatFrequencyMS: 10000,
        });

        console.log(`MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    } catch (error) {
        console.error(`Error connecting to MongoDB: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
