const mongoose = require("mongoose");
const path = require("path");

// Load Environment Variables (User must ensure these are set)
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

if (!MONGO_URI) {
    console.error("❌ Error: MONGO_URI not found in .env");
    process.exit(1);
}

const ReviewSchema = new mongoose.Schema({
    status: String,
    collegeId: String
});
const Review = mongoose.model("Review", ReviewSchema);

async function cleanup() {
    try {
        console.log("🔌 Connecting to MongoDB...");
        await mongoose.connect(MONGO_URI);
        console.log("✅ Connected.");

        // 1. Remove Rejected/Pending Reviews
        const res = await Review.deleteMany({
            status: { $in: ["rejected", "pending"] }
        });

        console.log(`🧹 Deleted ${res.deletedCount} unverified (pending/rejected) reviews.`);

        // 2. Optional: Remove reviews for 'test' colleges (if any existed in DB)
        const res2 = await Review.deleteMany({
            collegeId: { $regex: /test/i }
        });

        if (res2.deletedCount > 0) {
            console.log(`🧹 Deleted ${res2.deletedCount} reviews for test colleges.`);
        }

        console.log("✨ Cleanup Complete.");
    } catch (error) {
        console.error("❌ Cleanup failed:", error);
    } finally {
        await mongoose.disconnect();
        process.exit();
    }
}

cleanup();
