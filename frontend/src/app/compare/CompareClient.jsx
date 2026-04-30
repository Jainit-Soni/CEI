"use client";

import { useComparator } from "@/hooks/useComparator";
import EmptyState from "@/components/EmptyState";
import Link from "next/link";
import { X, Activity, ArrowLeft, TrendingUp, Building, CheckCircle2 } from "lucide-react";
import "./ComparePage.css";

// ─── HELPERS ────────────────────────────────────────────────────────────────

const ABBR_MAP = [
    { re: /Indian Institute of Technology/gi, short: "IIT" },
    { re: /National Institute of Technology/gi, short: "NIT" },
    { re: /Indian Institute of Management/gi, short: "IIM" },
    { re: /Indian Institute of Information Technology/gi, short: "IIIT" },
    { re: /Birla Institute of Technology and Science/gi, short: "BITS" },
    { re: /Indian Institute of Science Education and Research/gi, short: "IISER" },
    { re: /Indian Institute of Science/gi, short: "IISc" },
];

function getShortName(c) {
    if (!c) return "Unknown";
    if (c.shortName) return c.shortName;
    let n = (c.name || "").trim();
    for (const { re, short } of ABBR_MAP) {
        if (re.test(n)) {
            const city = n.replace(re, "").replace(/[-,()]/g, " ").trim().split(/\s+/).filter(Boolean).join(" ");
            return city ? `${short} ${city}` : short;
        }
    }
    return n.split(",")[0].split("(")[0].trim();
}

function formatCleanNumber(n) {
    if (!Number.isFinite(n)) return null;
    return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(2))).replace(/\.00$/, "");
}

function formatPlacementPackage(raw, context = {}) {
    if (raw == null) return null;

    const unit = String(context.unit || "").toUpperCase();
    const path = String(context.path || "").toLowerCase();

    // ─── NEW: RANGE & PLUS DETECTION ───
    if (typeof raw === "string") {
        const text = raw.trim();
        if (!text || text === "—" || text === "N/A") return null;

        const isCr = /crore|cr|cpa/i.test(text);
        const isLpa = /lpa/i.test(text);
        const factor = isCr ? 100 : 1;

        // 1. Range Detect (e.g. "15-25 LPA")
        const rangeMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*[-–—]\s*([0-9]+(?:\.[0-9]+)?)/);
        if (rangeMatch && (isLpa || isCr)) {
            const low = formatCleanNumber(Number(rangeMatch[1]) * factor);
            const high = formatCleanNumber(Number(rangeMatch[2]) * factor);
            return (low && high) ? `₹${low}–${high} LPA` : null;
        }

        // 2. Plus Detect (e.g. "50+ LPA")
        const plusMatch = text.match(/([0-9]+(?:\.[0-9]+)?)\s*\+/);
        if (plusMatch && (isLpa || isCr)) {
            const num = formatCleanNumber(Number(plusMatch[1]) * factor);
            return num ? `₹${num}+ LPA` : null;
        }

        // 3. Single Number Detect (Fallback to existing logic)
        if (isLpa || isCr) {
            const match = text.match(/([0-9]+(?:\.[0-9]+)?)/);
            if (!match) return null;
            let n = Number(match[1]) * factor;
            if (n < 0.5 || n > 500) return null;
            const clean = formatCleanNumber(n);
            return clean ? `₹${clean} LPA` : null;
        }
    }

    // ─── LEGACY / NUMERIC LOGIC ───
    let n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return null;

    let unitType = null;

    // RISK 1: Explicit INR
    const isExplicitINR = 
        unit === "INR_PER_ANNUM" || unit === "INR/YEAR" || unit === "INR" ||
        path.includes("inr") || path.includes("salary_inr") ||
        path.includes("package_inr") || path.includes("ctc_inr") ||
        path.includes("annual_ctc_inr");

    if (isExplicitINR && n >= 1000) {
        n = n / 100000;
        unitType = "LPA";
    }

    if (!unitType) {
        if (unit === "LPA" || unit === "CTC_LPA" || path.includes("ctc_lpa") || path.includes("package_lpa")) {
            unitType = "LPA";
        } else if (unit === "CR" || unit === "CRORE") {
            n = n * 100;
            unitType = "LPA";
        } else {
            return null;
        }
    }

    if (n < 0.5 || n > 500) return null;
    const cleanNum = formatCleanNumber(n);
    return cleanNum ? `₹${cleanNum} LPA` : null;
}

function formatCurrency(val) {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number' && val === 0) return null;

    const s = String(val).toLowerCase().trim();
    if (!s || s === "null" || s === "—" || s === "n/a" || s === "standard iit fees") return s || null;

    const n = parseFloat(s.replace(/[^0-9.]/g, ""));
    if (isNaN(n) || n <= 0) return s; // Return raw string if not purely numeric

    // If it's a small number, it might be LPA (misplaced)
    if (n < 500 && (s.includes("lpa") || s.includes("lakh"))) return `₹${n} LPA`;

    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0
    }).format(n);
}

function parseNumericForComparison(s) {
    if (!s) return null;
    
    // Normalize string for range/plus handling
    // If it's a range like "₹15–25 LPA", we take the first number (conservative lower bound)
    const match = String(s).match(/([0-9]+(?:\.[0-9]+)?)/);
    if (!match) return null;
    
    const n = parseFloat(match[1]);
    if (isNaN(n)) return null;
    
    // Scale to a common base (LPA) for comparison (though formatPlacementPackage already does this)
    // We check the original string for Cr context just in case
    if (s.includes("Cr") || s.includes("CPA")) return n * 100;
    return n;
}

function getField(c, field) {
    const obj = c.college || c;
    const isTruth = obj.meta?.truthTier === 'A' || obj.isVerified;

    if (field === "ceiScore") {
        const v = obj.ceiScore != null ? Number(obj.ceiScore).toFixed(2) : null;
        return { display: v };
    }

    if (field === "rank") {
        if (obj.rankingTier && !String(obj.rankingTier).includes("TBA"))
            return { display: obj.rankingTier };
        if (Array.isArray(obj.rankings) && obj.rankings.length) {
            const nirf = obj.rankings.find(r => String(r.source).toUpperCase() === "NIRF");
            const r = nirf || obj.rankings[0];
            return { display: `#${r.rank} ${r.source}` };
        }
        return { display: null };
    }

    if (field === "medianPackage") {
        const placements = obj.truth?.placements || obj.placements || obj.placementTruth || {};
        const val = placements.median_ctc_lpa || placements.medianPackage;
        return { 
            display: formatPlacementPackage(val, { path: "median_ctc_lpa" }), 
            verified: isTruth || !!placements.isVerified 
        };
    }

    if (field === "averagePackage") {
        const placements = obj.truth?.placements || obj.placements || obj.placementTruth || {};
        const val = placements.average_ctc_lpa || placements.avg_ctc_lpa || placements.averagePackage || placements.avgPackage;
        return { 
            display: formatPlacementPackage(val, { path: "average_ctc_lpa" }), 
            verified: isTruth || !!placements.isVerified 
        };
    }

    if (field === "highestPackage") {
        const placements = obj.truth?.placements || obj.placements || obj.placementTruth || {};
        const val = placements.highest_ctc_lpa || placements.highestPackage;
        return { 
            display: formatPlacementPackage(val, { path: "highest_ctc_lpa" }), 
            verified: isTruth || !!placements.isVerified 
        };
    }

    if (field === "fees") {
        const truth = obj.truth?.fees || obj.fees || {};
        const val = truth.total_fee || truth.tuitionNumeric || truth.totalNumeric || truth.tuition || obj.tuition;
        return { 
            display: formatCurrency(val), 
            verified: isTruth || !!(truth.isVerified) 
        };
    }

    if (field === "hostel") {
        const val = obj.meta?.hostelFees || obj.hostelFees;
        return { display: formatCurrency(val), verified: false };
    }

    return { display: null, verified: false };
}


function computeWinners(colleges, rows) {
    const out = {};
    for (const row of rows) {
        if (!row.winnerKey) { out[row.id] = Array(colleges.length).fill(false); continue; }
        const vals = colleges.map(c => parseNumericForComparison(getField(c, row.id).display));
        const valid = vals.filter(v => v !== null);
        if (!valid.length) { out[row.id] = Array(colleges.length).fill(false); continue; }
        const best = row.compare === "max" ? Math.max(...valid) : Math.min(...valid);
        out[row.id] = vals.map(v => v !== null && v === best);
    }
    return out;
}

// ─── ROWS CONFIG ────────────────────────────────────────────────────────────
const ROWS = [
    { id: "ceiScore",       section: "performance", name: "CEI Score",     meta: "Synthetic ranking index · 2026",         winnerKey: "ceiScore",       compare: "max", stripe: false, size: "lg", winClass: "csw-indigo", tagClass: "tc-indigo", tagLabel: "Top Tier",     grad: "linear-gradient(135deg,#4338ca,#9333ea)" },
    { id: "rank",           section: "performance", name: "NIRF / Band",   meta: "Official national standing",              winnerKey: null,                             stripe: true,  size: "md" },
    
    { id: "medianPackage",  section: "career",      name: "Median CTC",    meta: "Middle-most placement salary",            winnerKey: "medianPackage",  compare: "max", stripe: false, size: "lg", winClass: "csw-emerald", tagClass: "tc-emerald", tagLabel: "Strongest Displayed", solidColor: "#059669" },
    { id: "averagePackage", section: "career",      name: "Average CTC",   meta: "Mean institutional placement",            winnerKey: "averagePackage", compare: "max", stripe: true,  size: "lg", winClass: "csw-emerald", tagClass: "tc-emerald", tagLabel: "Higher Metric",       solidColor: "#059669" },
    { id: "highestPackage", section: "career",      name: "Highest CTC",   meta: "Maximum recorded placement",              winnerKey: "highestPackage", compare: "max", stripe: false, size: "lg", winClass: "csw-amber",  tagClass: "tc-amber",  tagLabel: "Higher Reported Value", solidColor: "#d97706" },
    
    { id: "fees",           section: "economic",    name: "Tuition Fee",   meta: "Base programme cost",                     winnerKey: "fees",           compare: "min", stripe: true,  size: "lg", winClass: "csw-slate",  tagClass: "tc-slate",  tagLabel: "Best Shown Value", solidColor: "#475569" },
    { id: "hostel",         section: "economic",    name: "Hostel / Residential Cost", meta: "Living & hostel expenses",      winnerKey: null,                             stripe: true,  size: "md" },
];

const SECTIONS = [
    { id: "performance", label: "Institutional Standing" },
    { id: "career",      label: "Placement Reality" },
    { id: "economic",    label: "Financial Commitment" },
];

// ─── SKELETON ───────────────────────────────────────────────────────────────
function Skeleton() {
    const C = 3;
    return (
        <div className="arena-page">
            <div className="arena-bar" />
            <div className="arena-hero">
                <div className="h-3 w-20 bg-slate-200 rounded-full mb-4 animate-pulse" />
                <div className="h-16 w-2/5 bg-slate-200 rounded-2xl animate-pulse" />
            </div>
            <div className="matrix-wrapper">
                <table className="cmp-table" style={{ "--cols": C }}>
                    <thead>
                        <tr>
                            <th className="th-corner" />
                            {Array.from({ length: C }).map((_, i) => (
                                <th key={i} className="th-col">
                                    <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {ROWS.map(row => (
                            <tr key={row.id} className={row.stripe ? "tr-stripe" : ""}>
                                <td className="td-label">
                                    <div className="h-3 w-20 bg-slate-200 rounded animate-pulse mb-1" />
                                    <div className="h-2 w-14 bg-slate-100 rounded animate-pulse" />
                                </td>
                                {Array.from({ length: C }).map((_, i) => (
                                    <td key={i} className="td-data">
                                        <div className="h-12 w-24 bg-slate-100 rounded-xl animate-pulse mx-auto" />
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
export default function CompareClient() {
    const { pinnedColleges, pinnedIds, unpinCollege, isLoading } = useComparator();

    if (isLoading && pinnedIds.length > 0 && pinnedColleges.length === 0) return <Skeleton />;

    if (pinnedColleges.length === 0) {
        return (
            <div className="arena-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "80vh", padding: "0 24px" }}>
                <div style={{ maxWidth: 480, width: "100%" }}>
                    <EmptyState icon="⚖️" title="Comparison List Empty"
                        description="Add up to 3 institutions from the registry to begin a head-to-head comparison."
                        actionLabel="Browse Institutions" actionHref="/colleges" />
                </div>
            </div>
        );
    }

    const cols   = pinnedColleges;
    const N      = cols.length;

    // Filter out rows where no college has data
    const activeRows = ROWS.filter(row => {
        return cols.some(c => getField(c, row.id).display !== null);
    });

    const winners = computeWinners(cols, activeRows);

    let lastSection = null;

    return (
        <div className="arena-page">

            {/* ── COMMAND BAR ─── */}
            <div className="arena-bar">
                <Link href="/colleges" className="bar-back">
                    <ArrowLeft size={13} /> Back
                </Link>
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                    <span className="bar-count">{N} / 3 institutions</span>
                    <Link href="/colleges" className="bar-cta">+ Add</Link>
                </div>
            </div>

            {/* ── HERO ─── */}
            <div className="arena-hero">
                <div className="hero-eyebrow">
                    Institutional Comparison
                </div>
                <h1 className="hero-title">Compare<br/>Colleges</h1>
                <p className="hero-sub">Evaluating verified admission, fee, placement, and ranking signals.</p>
            </div>

            {/* ── COMPARISON TABLE ─── */}
            <div className="matrix-wrapper">
                <table className="cmp-table" style={{ "--cols": N }}>
                    <thead>
                        <tr>
                            {/* sticky corner */}
                            <th className="th-corner">
                                <span className="corner-label">Parameters</span>
                            </th>
                            {cols.map((c, ci) => {
                                const id  = c.id || c._id;
                                const nm  = getShortName(c);
                                const loc = (c.location || c.city || "").split(",")[0].trim() || "National";
                                return (
                                    <th key={`hdr-${ci}`} className="th-col">
                                        <div className="college-card">
                                            <button className="card-rm" onClick={() => unpinCollege(id)} aria-label={`Remove ${nm}`}>
                                                <X size={10} strokeWidth={3} />
                                            </button>
                                            <div className="card-emblem">
                                                {c.logo
                                                    ? <img src={c.logo} alt="" width={28} height={28} style={{ objectFit: "contain" }} />
                                                    : <Activity size={18} color="#6366f1" />
                                                }
                                            </div>
                                            <div className="card-name">{nm}</div>
                                            <div className="card-loc">{loc}</div>
                                        </div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>

                    <tbody>
                        {activeRows.map(row => {
                            const showSectionHeader = row.section !== lastSection;
                            lastSection = row.section;
                            const section = SECTIONS.find(s => s.id === row.section);
                            const winMap  = winners[row.id] || [];

                            return (
                                <>
                                    {/* Section divider row */}
                                    {showSectionHeader && (
                                        <tr key={`sec-${row.section}`} className="tr-section">
                                            <td colSpan={N + 1} className="td-section">
                                                <span className="section-kicker">{section?.label}</span>
                                            </td>
                                        </tr>
                                    )}

                                    {/* Data row */}
                                    <tr key={row.id} className={row.stripe ? "tr-stripe" : "tr-plain"}>
                                        <td className={`td-label${row.stripe ? " td-label-stripe" : ""}`}>
                                            <div className="lbl-name">{row.name}</div>
                                            <div className="lbl-meta">{row.meta}</div>
                                        </td>
                                        {cols.map((c, ci) => {
                                            const { display, verified } = getField(c, row.id);
                                            const isW = winMap[ci] === true;
                                            const isNull = !display;

                                            // cell class
                                            let cellCls = isW && row.winClass ? `td-data cell-win ${row.winClass}` : "td-data";
                                            if (row.stripe) cellCls += " td-stripe";

                                            // number styles
                                            let numStyle = {};
                                            if (isW && row.grad)       numStyle = { background: row.grad, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" };
                                            else if (isW && row.solidColor) numStyle = { color: row.solidColor };

                                            return (
                                                <td key={`${row.id}-${ci}`} className={cellCls}>
                                                    {isNull ? (
                                                        <span className="null-dash">—</span>
                                                    ) : (
                                                        <div className={`num-wrap ${row.size === "lg" ? "num-lg" : "num-md"}`}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                                                                <span className="dv-num" style={numStyle}>{display}</span>
                                                                {verified && (
                                                                    <div className="verified-badge-mini" title="Official Truth-Verified Data">
                                                                        <CheckCircle2 size={8} color="#10b981" />
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {isW && row.tagLabel && (
                                                                <span className={`winner-tag ${row.tagClass}`}>{row.tagLabel}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                </>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* ── FOOTNOTE ─── */}
            <div className="arena-footer" style={{ padding: "32px 24px", maxWidth: 1200, margin: "0 auto" }}>
                <div style={{ padding: "20px", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "16px", display: "flex", gap: "12px" }}>
                    <div className="tc-indigo" style={{ marginTop: "2px" }}>
                        <CheckCircle2 size={14} />
                    </div>
                    <div style={{ fontSize: "12px", color: "var(--color-text-dim)", lineHeight: "1.6" }}>
                        <p style={{ fontWeight: 600, color: "var(--color-text)", marginBottom: "4px" }}>Methodology & Data Integrity</p>
                        <p>Metrics highlighted as stronger are compared using a <strong>conservative lower-bound proxy</strong> for non-exact reported ranges (e.g., ₹15–25 LPA is evaluated as 15.0). This ensures a defensive, source-safe comparison. Official verification badges indicate data directly cross-referenced with institutional truth-sources.</p>
                    </div>
                </div>
            </div>

            <div style={{ height: 80 }} />
        </div>
    );
}
