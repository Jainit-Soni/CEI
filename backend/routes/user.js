const SHARED_PATH = path.join(__dirname, "../models/shared_lists.json");

// Helper to load all choices
async function loadAllChoices() {
    try {
        const data = await fs.readFile(DATA_PATH, "utf8");
        return JSON.parse(data);
    } catch (err) {
        return {};
    }
}

// Helper to save all choices
async function saveAllChoices(data) {
    await fs.writeFile(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
}

async function loadSharedLists() {
    try {
        const data = await fs.readFile(SHARED_PATH, "utf8");
        return JSON.parse(data);
    } catch (err) {
        return {};
    }
}

async function saveSharedLists(data) {
    await fs.writeFile(SHARED_PATH, JSON.stringify(data, null, 2), "utf8");
}

// GET /api/user/choices?uid=...
router.get("/user/choices", async (req, res) => {
    const { uid } = req.query;
    if (!uid) return res.status(400).json({ error: "UID required" });

    const all = await loadAllChoices();
    res.json(all[uid] || []);
});

// POST /api/user/choices
router.post("/user/choices", async (req, res) => {
    const { uid, choices } = req.body;
    if (!uid) return res.status(400).json({ error: "UID required" });
    if (!Array.isArray(choices)) return res.status(400).json({ error: "Choices must be an array" });

    const all = await loadAllChoices();
    all[uid] = choices;
    await saveAllChoices(all);

    res.json({ success: true, count: choices.length });
});

// POST /api/user/share
router.post("/user/share", async (req, res) => {
    const { choices, userName } = req.body;
    if (!Array.isArray(choices) || choices.length === 0) {
        return res.status(400).json({ error: "Cannot share an empty list" });
    }

    const shareId = require("crypto").randomBytes(6).toString("hex");
    const sharedLists = await loadSharedLists();

    sharedLists[shareId] = {
        choices,
        userName: userName || "Anonymous Student",
        createdAt: new Date().toISOString()
    };

    await saveSharedLists(sharedLists);
    res.json({ success: true, shareId });
});

// GET /api/user/share/:id
router.get("/user/share/:id", async (req, res) => {
    const { id } = req.params;
    const sharedLists = await loadSharedLists();
    const list = sharedLists[id];

    if (!list) {
        return res.status(404).json({ error: "Shared roadmap not found" });
    }

    res.json(list);
});

module.exports = router;
