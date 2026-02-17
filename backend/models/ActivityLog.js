const mongoose = require("mongoose");

const ActivityLogSchema = new mongoose.Schema({
    collegeId: {
        type: String,
        required: true,
        index: true
    },
    action: {
        type: String,
        enum: ["view"],
        default: "view"
    },
    timestamp: {
        type: Date,
        default: Date.now,
        expires: 1800 // Documents expire after 30 minutes (1800 seconds)
    }
});

module.exports = mongoose.model("ActivityLog", ActivityLogSchema);
