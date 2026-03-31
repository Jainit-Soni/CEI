/**
 * models/SourceEvidence.js — CEI National Data Verification Engine (Phase XVI)
 * =============================================================================
 * A single source record linked to a VerifiedField.
 * One field can have multiple sources — multi-source agreement = higher confidence.
 */

const mongoose = require('mongoose');
const mingo = require('mingo');

// Mock MongoQuery wrapper
class MongoQuery {
    constructor(data) { this.data = data; }
    lean() { return this; }
    then(resolve) { resolve(this.data); }
}

const SourceEvidenceMock = {
    find: (query = {}) => {
        const q = new mingo.Query(query);
        const result = q.find(global.sourceEvidence || []).all();
        return new MongoQuery(result);
    },
    findOne: (query = {}) => {
        const q = new mingo.Query(query);
        const result = q.find(global.sourceEvidence || []).all();
        return new MongoQuery(result.length > 0 ? result[0] : null);
    },
    create: async (doc) => doc,
    save: async (doc) => doc
};

module.exports = SourceEvidenceMock;
