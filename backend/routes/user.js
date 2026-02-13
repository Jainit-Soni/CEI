const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs").promises;
const { getRedisClient } = require("../config/redis");

const DATA_PATH = path.join(__dirname, "../models/user_choices.json");
const SHARED_PATH = path.join(__dirname, "../models/shared_lists.json");

// Helper to load choices for a specific UID
async function loadChoices(uid) {
    // 1. Try Redis first
    try {
        const redis = await getRedisClient();
        if (redis) {
            const data = await redis.get(`user:choices:${uid}`);
            if (data) return JSON.parse(data);
        }
    } catch (err) {
        console.error("Redis LoadChoices Error:", err.message);
    }

    // 2. Fallback to FS (for local dev)
    try {
        const data = await fs.readFile(DATA_PATH, "utf8");
        const all = JSON.parse(data);
        return all[uid] || [];
    } catch (err) {
        return [];
    }
}

// Helper to save choices for a specific UID
async function saveChoices(uid, choices) {
    // 1. Try Redis first
    let redisSuccess = false;
    try {
        const redis = await getRedisClient();
        if (redis) {
            await redis.set(`user:choices:${uid}`, JSON.stringify(choices), "EX", 60 * 60 * 24 * 30); // 30 days
            redisSuccess = true;
        }
    } catch (err) {
        console.error("Redis SaveChoices Error:", err.message);
    }

    // 2. Fallback to FS
    try {
        let all = {};
        try {
            const data = await fs.readFile(DATA_PATH, "utf8");
            all = JSON.parse(data);
        } catch (e) { }

        all[uid] = choices;
        await fs.writeFile(DATA_PATH, JSON.stringify(all, null, 2), "utf8");
    } catch (err) {
        if (!redisSuccess) throw err; // Only throw if both failed
    }
}

async function loadSharedList(id) {
    // 1. Try Redis
    try {
        const redis = await getRedisClient();
        if (redis) {
            const data = await redis.get(`user:share:${id}`);
            if (data) return JSON.parse(data);
        }
    } catch (err) {
        console.error("Redis LoadShare Error:", err.message);
    }

    // 2. Fallback to FS
    try {
        const data = await fs.readFile(SHARED_PATH, "utf8");
        const all = JSON.parse(data);
        return all[id];
    } catch (err) {
        return null;
    }
}

async function saveSharedList(id, listData) {
    // 1. Try Redis
    let redisSuccess = false;
    try {
        const redis = await getRedisClient();
        if (redis) {
            await redis.set(`user:share:${id}`, JSON.stringify(listData), "EX", 60 * 60 * 24 * 90); // 90 days
            redisSuccess = true;
        }
    } catch (err) {
        console.error("Redis SaveShare Error:", err.message);
    }

    // 2. Fallback to FS
    try {
        let all = {};
        try {
            const data = await fs.readFile(SHARED_PATH, "utf8");
            all = JSON.parse(data);
        } catch (e) { }

        all[id] = listData;
        await fs.writeFile(SHARED_PATH, JSON.stringify(all, null, 2), "utf8");
    } catch (err) {
        if (!redisSuccess) throw err;
    }
}

// GET /api/user/choices?uid=...
router.get("/user/choices", async (req, res) => {
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: "UID required" });

    const choices = await loadChoices(uid);
    res.json(choices);
});

// POST /api/user/choices
router.post("/user/choices", async (req, res) => {
    const { uid, choices } = req.body;
    if (!uid) return res.status(400).json({ error: "UID required" });
    if (!Array.isArray(choices)) return res.status(400).json({ error: "Choices must be an array" });

    await saveChoices(uid, choices);
    res.json({ success: true, count: choices.length });
});

// POST /api/user/share
router.post("/user/share", async (req, res) => {
    const { choices, userName } = req.body;
    if (!Array.isArray(choices) || choices.length === 0) {
        return res.status(400).json({ error: "Cannot share an empty list" });
    }

    const shareId = require("crypto").randomBytes(6).toString("hex");
    const listData = {
        choices,
        userName: userName || "Anonymous Student",
        createdAt: new Date().toISOString()
    };

    await saveSharedList(shareId, listData);
    res.json({ success: true, shareId });
});

// GET /api/user/share/:id
router.get("/user/share/:id", async (req, res) => {
    const { id } = req.params;
    const list = await loadSharedList(id);

    if (!list) {
        return res.status(404).json({ error: "Shared roadmap not found" });
    }

    res.json(list);
});

module.exports = router;
