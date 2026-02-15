const mongoose = require("mongoose");

const ReviewSchema = new mongoose.Schema({
    collegeId: { type: String, required: true, index: true },
    userId: { type: String, required: true },
    userName: { type: String, required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, maxlength: 1000 },
    createdAt: { type: Date, default: Date.now },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "approved" } // Auto-approve for now
});

// Index for efficient fetching
ReviewSchema.index({ collegeId: 1, createdAt: -1 });

module.exports = mongoose.model("Review", ReviewSchema);
