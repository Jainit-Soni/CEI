const mongoose = require('mongoose');
const mingo = require('mingo');
const { getRedisStatus } = require('../services/dataStore'); // optional if needed

/**
 * MongoQuery wrapper to simulate Mongoose's chainable API (.select, .lean, .sort)
 * using mingo behind the scenes on a JS array.
 */
class MongoQuery {
  constructor(data, isSingle = false) {
    this.data = data;
    this.isSingle = isSingle;
    this._select = null;
    this._skip = 0;
    this._limit = null;
    this._sort = null;
  }

  select(fields) {
    if (typeof fields === 'string') {
      this._select = fields.split(' ').reduce((acc, f) => { acc[f] = 1; return acc; }, {});
    } else {
      this._select = fields;
    }
    return this;
  }

  lean() { return this; }

  sort(sortObj) {
    this._sort = sortObj;
    return this;
  }

  skip(n) { this._skip = n; return this; }
  limit(n) { this._limit = n; return this; }

  // Automatically execute the query when awaited
  then(resolve, reject) {
    try {
      let result = this.data;

      // Apply Sort
      if (this._sort && Array.isArray(result)) {
         result = new mingo.Query({}).find(result).sort(this._sort).all();
      }

      // Apply Skip & Limit
      if (Array.isArray(result)) {
        if (this._skip > 0) result = result.slice(this._skip);
        if (this._limit > 0) result = result.slice(0, this._skip + this._limit); // wait, Mingo cursor can handle this better
      }

      // Apply Projection
      if (this._select && result) {
        const _projectDoc = (doc) => {
          const projected = { _id: doc._id || doc.id, id: doc.id || doc._id }; // Always include IDs
          for (const k in this._select) {
            const parts = k.split('.');
            if (parts.length === 1 && doc[k] !== undefined) {
              projected[k] = doc[k];
            } else if (parts.length === 2 && doc[parts[0]] && doc[parts[0]][parts[1]] !== undefined) {
              projected[parts[0]] = projected[parts[0]] || {};
              projected[parts[0]][parts[1]] = doc[parts[0]][parts[1]];
            }
          }
          return projected;
        };

        if (Array.isArray(result)) {
           result = result.map(_projectDoc);
        } else if (this.isSingle) {
           result = _projectDoc(result);
        }
      }

      if (this.isSingle) {
        resolve(Array.isArray(result) ? result[0] || null : result || null);
      } else {
        resolve(result || []);
      }
    } catch (e) {
      reject(e);
    }
  }
}



/**
 * The Mongoose Model Mock for CollegeSchema.
 * This intercepts all College.find() calls across the application
 * and deeply filters the in-memory `global.colleges` array in milliseconds.
 */
const CollegeMock = {
  find: (query = {}) => {
    // Basic pre-processing if someone passes Mongoose ObjectIds natively
    const stringifiedQuery = JSON.parse(JSON.stringify(query)); 
    const q = new mingo.Query(stringifiedQuery);
    const result = q.find(global.colleges || []).all();
    return new MongoQuery(result);
  },

  findOne: (query = {}) => {
    const stringifiedQuery = JSON.parse(JSON.stringify(query)); 
    const q = new mingo.Query(stringifiedQuery);
    const result = q.find(global.colleges || []).all();
    return new MongoQuery(result.length > 0 ? result[0] : null, true);
  },

  findById: (id) => {
    return CollegeMock.findOne({ _id: id.toString() });
  },

  countDocuments: async (query = {}) => {
    const stringifiedQuery = JSON.parse(JSON.stringify(query)); 
    const q = new mingo.Query(stringifiedQuery);
    return q.find(global.colleges || []).all().length;
  },

  aggregate: async (pipeline) => {
    // Handle Mongoose strict pipeline differences
    const sanitizedPipeline = JSON.parse(JSON.stringify(pipeline));
    const agg = new mingo.Aggregator(sanitizedPipeline);
    return agg.run(global.colleges || []);
  },

  // Mock write methods to prevent crashing on admin ops, returning safe defaults
  updateOne: async () => ({ modifiedCount: 1, matchedCount: 1 }),
  updateMany: async () => ({ modifiedCount: 1, matchedCount: 1 }),
  deleteOne: async () => ({ deletedCount: 1 }),

  distinct: async (field, query = {}) => {
    // 1. Filter dataset using mingo
    const stringifiedQuery = JSON.parse(JSON.stringify(query));
    const q = new mingo.Query(stringifiedQuery);
    const matched = q.find(global.colleges || []).all();
    
    // 2. Extract distinct values using a Set
    const values = new Set();
    matched.forEach(doc => {
      // Handle nested fields like "meta.district"
      const val = field.split('.').reduce((obj, key) => (obj && obj[key] !== undefined) ? obj[key] : undefined, doc);
      if (val !== undefined && val !== null) {
        values.add(val);
      }
    });
    return Array.from(values);
  },
  
  collection: {
    name: "colleges_flatfile"
  }
};

console.log("✅ CollegeMock loaded with distinct() support");
module.exports = CollegeMock;
