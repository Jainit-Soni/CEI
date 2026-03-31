const mingo = require('mingo');

/**
 * User.js — CEI User Model Mock
 * =============================
 * Replaces Mongoose User model with an in-memory store to support
 * the "No-MongoDB" architecture requested by the user.
 */

// Initialize global user store if not present
if (!global.usersStore) {
    global.usersStore = [];
}

class UserInstance {
    constructor(data) {
        Object.assign(this, data);
        if (!this._id) {
            this._id = `u_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
        }
    }

    async save() {
        const index = global.usersStore.findIndex(u => u.firebaseUid === this.firebaseUid);
        if (index > -1) {
            global.usersStore[index] = { ...this };
        } else {
            global.usersStore.push({ ...this });
        }
        return this;
    }
}

const UserMock = {
    findOne: async (query) => {
        const q = new mingo.Query(query);
        const result = q.find(global.usersStore).all();
        if (result.length > 0) {
            return new UserInstance(result[0]);
        }
        return null;
    },

    // Allow "new User({...})" syntax
    model: function (data) {
        return new UserInstance(data);
    }
};

// This allows both `const User = require('./User')` AND `new User(...)`
function UserConstructor(data) {
    return new UserInstance(data);
}
UserConstructor.findOne = UserMock.findOne;
UserConstructor.find = async (query) => {
    const q = new mingo.Query(query);
    return q.find(global.usersStore).all().map(u => new UserInstance(u));
};

module.exports = UserConstructor;
