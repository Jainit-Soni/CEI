const express = require("express");
const router = express.Router();
const Review = require("../models/Review");
const authMiddleware = require("../middleware/auth"); // Assuming this exists or we mock for guest

// GET /api/reviews/:collegeId
// Fetch reviews for a specific college
router.get("/:collegeId", async (req, res) => {
    try {
        const { collegeId } = req.params;
        const reviews = await Review.find({ collegeId, status: "approved" })
            .sort({ createdAt: -1 })
            .limit(20);

        // Calculate aggregate
        const stats = await Review.aggregate([
            { $match: { collegeId, status: "approved" } },
            { $group: { _id: null, avg: { $avg: "$rating" }, count: { $sum: 1 } } }
        ]);

        res.json({
            reviews,
            avgRating: stats[0]?.avg?.toFixed(1) || 0,
            totalReviews: stats[0]?.count || 0
        });
    } catch (error) {
        console.error("Error fetching reviews:", error);
        res.status(500).json({ error: "Failed to fetch reviews" });
    }
});

// POST /api/reviews
// Add a new review
router.post("/", async (req, res) => {
    try {
        const { collegeId, userId, userName, rating, comment } = req.body;

        if (!collegeId || !rating || !userId) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        const review = new Review({
            collegeId,
            userId,
            userName: userName || "Anonymous Student", // Privacy fallback
            rating,
            comment,
            status: "approved" // Auto-approve for MVP
        });

        await review.save();
        res.status(201).json(review);
    } catch (error) {
        console.error("Error saving review:", error);
        res.status(500).json({ error: "Failed to save review" });
    }
});

module.exports = router;
