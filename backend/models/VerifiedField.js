/**
 * models/VerifiedField.js — CEI National Data Verification Engine (Phase XVI)
 * ============================================================================
 * Stores the verified state of one critical data field for one institution.
 * Every change to a VerifiedField is immutable in the AuditLog.
 *
 * Confidence Score Mapping:
 *   90–100 → Verified
 *   70–89  → Likely Accurate
 *   40–69  → Needs Review
 *   0–39   → Untrusted
 */

const mongoose = require('mongoose');
const mingo = require('mingo');

// Mock MongoQuery wrapper (simplified for this model)
class MongoQuery {
    constructor(data) { this.data = data; }
    lean() { return this; }
    // Add other chainable methods if needed
    then(resolve) { resolve(this.data); }
}

const VerifiedFieldMock = {
    find: (query = {}) => {
        const q = new mingo.Query(query);
        const result = q.find(global.verifiedFields || []).all();
        return new MongoQuery(result);
    },
    findOne: (query = {}) => {
        const q = new mingo.Query(query);
        const result = q.find(global.verifiedFields || []).all();
        return new MongoQuery(result.length > 0 ? result[0] : null);
    },
    save: async (doc) => doc,
    schema: { methods: {} }
};

module.exports = VerifiedFieldMock;
