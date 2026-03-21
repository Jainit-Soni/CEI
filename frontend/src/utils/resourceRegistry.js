/**
 * LEGACY FALLBACK REGISTRY (V5 - Direct Asset Hosting)
 * ⚠️ DEPRECATED: Papers are now served directly from the backend /api/exam/:id
 * Only videos and historical fallback data remain here.
 */

const CMAT_VIDS = [
    { id: "0Sqzw8_JRMg", title: "Comprehensive CMAT 2026 Guide", channel: "MBA Wallah", duration: "21:10" },
    { id: "sYbJFs5d558", title: "VARC Mastery Series", channel: "MBA Wallah", duration: "14:45" },
    { id: "CB_zlbN_RpY", title: "Innovation & Entrepreneurship", channel: "MBA Wallah", duration: "18:20" }
];

const CAT_VIDS = [
    { id: "hJq8i_HjQwY", title: "CAT 2025 Complete Syllabus & Strategy", channel: "Career Launcher", duration: "15:30" },
    { id: "sYbJFs5d558", title: "VARC Advanced Concepts", channel: "MBA Wallah", duration: "14:45" },
    { id: "r1b2c3d4e5f", title: "DILR High-Level Setup", channel: "Elites Grid", duration: "32:15" } // Valid placeholder format
];

const JEE_VIDS = [
    { id: "k9Y61vW8M1c", title: "JEE Main 2026 Roadmap & Strategy", channel: "Physics Wallah", duration: "24:12" },
    { id: "T9_8V00_0h0", title: "Important Chapters for JEE 2026", channel: "Mathongo", duration: "16:50" },
    { id: "5vW3N8mUa0E", title: "Advanced Physics Problems", channel: "Physics Galaxy", duration: "45:00" }
];

const GATE_VIDS = [
    { id: "5vW3N8mUa0E", title: "GATE 2026 Master Preparation Strategy", channel: "Unacademy GATE", duration: "18:45" },
    { id: "0Sqzw8_JRMg", title: "Engineering Mathematics Tricks", channel: "GATE Academy", duration: "22:15" },
    { id: "CB_zlbN_RpY", title: "Aptitude Section Masterclass", channel: "Made Easy", duration: "55:30" }
];

const genVideos = (vids) => vids.map(v => ({
    ...v,
    url: `https://www.youtube.com/watch?v=${v.id}`
}));

export const resourceRegistry = {
    cmat: {
        videos: genVideos(CMAT_VIDS),
        papers: [
            { year: "2024", name: "CMAT 2024 Official (Direct)", url: "/papers/cmat_2024.pdf", isDirect: true },
            { year: "2023", name: "CMAT 2023 Solved (Direct)", url: "/papers/cmat_2023.pdf", isDirect: true },
            { year: "2022", name: "CMAT 2022 Slot 1 (Direct)", url: "/papers/cmat_2022.pdf", isDirect: true }
        ]
    },
    cat: {
        videos: genVideos(CAT_VIDS),
        papers: [
            { year: "2023", name: "CAT 2023 Slot 1 (Direct)", url: "/papers/cat_2023.pdf", isDirect: true },
            { year: "2022", name: "CAT 2022 Archive (Direct)", url: "/papers/cat_2022.pdf", isDirect: true }
        ]
    },
    jee: {
        videos: genVideos(JEE_VIDS),
        papers: [
            { year: "2024", name: "JEE Main 2024 (Direct)", url: "/papers/jee_2024.pdf", isDirect: true }
        ]
    },
    gate: {
        videos: genVideos(GATE_VIDS),
        papers: [
            { year: "2024", name: "GATE 2024 Official (Direct)", url: "/papers/gate_2024.pdf", isDirect: true }
        ]
    }
};
