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
        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 5000,
            // ── Read Replica (Option 3) ───────────────────────────────────────
            // Routes all read ops to secondary when replica set is active.
            // Falls back to primary silently when no replica exists.
            readPreference: 'secondaryPreferred',
            // ── Connection Pool ───────────────────────────────────────────────
            maxPoolSize: 20,      // Handle burst concurrency (default: 5)
            minPoolSize: 2,       // Keep warm connections alive
            // ── Timeouts ─────────────────────────────────────────────────────
            socketTimeoutMS: 30000,
            heartbeatFrequencyMS: 10000,
        });

        console.log(`MongoDB Connected: ${conn.connection.host} (readPreference: secondaryPreferred)`);
    } catch (error) {
        console.error(`Error connecting to MongoDB: ${error.message}`);
        process.exit(1);
    }
};

module.exports = connectDB;
