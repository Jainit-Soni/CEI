const express = require("express");
const router = express.Router();
const scholarships = require("../models/scholarships.json");

// @route   GET /api/scholarships
// @desc    Get all scholarships with optional filtering
// @access  Public
router.get("/", (req, res) => {
    try {
        let results = scholarships;

        // Filter by Category
        if (req.query.category) {
            const category = req.query.category.toLowerCase();
            results = results.filter(s => s.category.toLowerCase() === category);
        }

        res.json(results);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

// @route   GET /api/scholarships/:id
// @desc    Get scholarship by ID
// @access  Public
router.get("/:id", (req, res) => {
    try {
        const scholarship = scholarships.find(s => s.id === req.params.id);

        if (!scholarship) {
            return res.status(404).json({ msg: "Scholarship not found" });
        }

        res.json(scholarship);
    } catch (err) {
        console.error(err.message);
        res.status(500).send("Server Error");
    }
});

module.exports = router;
