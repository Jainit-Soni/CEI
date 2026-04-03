"use client";

import { useComparator } from "@/hooks/useComparator";
import EmptyState from "@/components/EmptyState";
import Link from "next/link";
import { X, Activity, ArrowLeft, TrendingUp, Building, Zap } from "lucide-react";
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

function parseNum(s) {
    if (!s || ["N/A", "TBA", "Contact", "—", null, undefined].includes(s)) return null;
    s = String(s).toLowerCase().replace(/,/g, "");
    const n = parseFloat(s.replace(/[^0-9.]/g, ""));
    if (isNaN(n)) return null;
    if (s.includes("cr") || s.includes("crore")) return n * 100;
    return n;
}

function fmtVal(raw) {
    if (raw === null || raw === undefined) return null;
    if (typeof raw === "object" && !Array.isArray(raw))
        raw = raw.amount || raw.tuition || raw.value || Object.values(raw)[0];
    const s = String(raw ?? "").trim();
    if (!s || s === "null" || s === "undefined") return null;
    const digits = s.replace(/[^0-9]/g, "");
    const n = parseInt(digits, 10);
    if (!isNaN(n) && n > 0) {
        if (n >= 10000000) return (n / 10000000).toFixed(2).replace(/\.?0+$/, "") + " Cr";
        if (n >= 100000)   return (n / 100000).toFixed(1).replace(/\.?0+$/, "")  + " L";
        if (n >= 1000)     return (n / 1000).toFixed(0) + "K";
    }
    return s;
}

function getField(c, field) {
    const obj = c.college || c;
    if (field === "ceiScore") {
        const v = obj.ceiScore != null ? obj.ceiScore.toFixed(1) : null;
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
    if (field === "avgPackage")     return { display: fmtVal(obj.placements?.averagePackage), verified: obj.placements?.isVerified };
    if (field === "highestPackage") return { display: fmtVal(obj.placements?.highestPackage), verified: obj.placements?.isVerified };
    if (field === "fees")           return { display: fmtVal(obj.tuition || obj.fees?.totalFee || obj.fees), verified: !!(obj.fees?.isVerified) };
    if (field === "hostel")         return { display: fmtVal(obj.meta?.hostelFees), verified: false };
    return { display: null, verified: false };
}


function computeWinners(colleges, rows) {
    const out = {};
    for (const row of rows) {
        if (!row.winnerKey) { out[row.id] = Array(colleges.length).fill(false); continue; }
        const vals = colleges.map(c => parseNum(getField(c, row.id).display));
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
    { id: "avgPackage",     section: "career",      name: "Avg Package",   meta: "Median annual placement CTC",             winnerKey: "avgPackage",     compare: "max", stripe: false, size: "lg", winClass: "csw-emerald", tagClass: "tc-emerald", tagLabel: "Alpha ROI",  solidColor: "#059669" },
    { id: "highestPackage", section: "career",      name: "Peak Package",  meta: "Maximum recorded placement",              winnerKey: "highestPackage", compare: "max", stripe: true,  size: "lg", winClass: "csw-amber",  tagClass: "tc-amber",  tagLabel: "Ceiling",    solidColor: "#d97706" },
    { id: "fees",           section: "economic",    name: "Tuition Fee",   meta: "Base programme cost",                     winnerKey: "fees",           compare: "min", stripe: false, size: "lg", winClass: "csw-slate",  tagClass: "tc-slate",  tagLabel: "Low Cost",   solidColor: "#475569" },
    { id: "hostel",         section: "economic",    name: "Residential",   meta: "Living & hostel expenses",                winnerKey: null,                             stripe: true,  size: "md" },
];

const SECTIONS = [
    { id: "performance", label: "Performance Index" },
    { id: "career",      label: "Career Outcomes" },
    { id: "economic",    label: "Economic Load" },
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
                    <EmptyState icon="⚔️" title="The Arena is Empty"
                        description="Add up to 5 institutions from the registry to begin a head-to-head comparison."
                        actionLabel="Browse Registry" actionHref="/colleges" />
                </div>
            </div>
        );
    }

    const cols   = pinnedColleges;
    const N      = cols.length;
    const winners = computeWinners(cols, ROWS);

    let lastSection = null;

    return (
        <div className="arena-page">

            {/* ── COMMAND BAR ─── */}
            <div className="arena-bar">
                <Link href="/colleges" className="bar-back">
                    <ArrowLeft size={13} /> Back
                </Link>
                <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                    <span className="bar-count">{N} / 5 combatants</span>
                    <Link href="/colleges" className="bar-cta">+ Add</Link>
                </div>
            </div>

            {/* ── HERO ─── */}
            <div className="arena-hero">
                <div className="hero-eyebrow">
                    <Zap size={10} color="#6366f1" /> Battle Arena
                </div>
                <h1 className="hero-title">The<br/>Comparison</h1>
                <p className="hero-sub">{N} institutions across {ROWS.length} parameters</p>
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
                        {ROWS.map(row => {
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
                                                                    <div className="verified-badge-mini" title="Truth-Verified Data">
                                                                        <Zap size={8} fill="#10b981" color="#10b981" />
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

            <div style={{ height: 80 }} />
        </div>
    );
}
