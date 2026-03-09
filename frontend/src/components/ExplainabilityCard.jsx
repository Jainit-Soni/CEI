"use client";

/**
 * ExplainabilityCard.jsx — "How Was This Score Calculated?"
 * =========================================================
 * Human-friendly explanation of a college's CEI score.
 * Uses plain language so any student can understand what drives rankings.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { API_BASE } from "@/lib/api"; // Import consolidated API base
import "./ExplainabilityCard.css";

const API_URL = API_BASE;

// Plain-language explanations for each scoring factor
const FACTOR_PLAIN_ENGLISH = {
    A: { icon: "🏆", what: "Academic Excellence", why: "Based on national rankings (NIRF/Tier 1 status). Higher ranking = more academic prestige." },
    F: { icon: "🏛️", what: "Institutional Record", why: "Based on the college's age and stability. Established institutions usually have better alumni networks." },
    I: { icon: "🏗️", what: "Infrastructure quality", why: "Covers campus facilities, premium status, and reliability of the physical environment." },
    S: { icon: "📐", what: "Program Breadth", why: "How many different specialized courses are offered. More variety = more career flexibility." },
    D: { icon: "📊", what: "Entrance Standards", why: "How tough it is to get in. High demand (CAT/GMAT) reflects the quality of your peers." },
    P: { icon: "💼", what: "Placement Strength", why: "The real-world ROI. Based on average packages and recruiter track records." },
};

function getPlainFactor(code) {
    return FACTOR_PLAIN_ENGLISH[code] || { icon: "📌", what: code, why: "A scoring factor used in the CEI algorithm." };
}

function getBandColor(band) {
    const b = (band || "").toLowerCase();
    if (b.includes("elite")) return "#4f46e5";
    if (b.includes("strong")) return "#0ea5e9";
    if (b.includes("develop")) return "#f59e0b";
    return "#8C8CA1";
}

function getStabilityPlainText(index) {
    if (index === null || index === undefined) return "Calculating reliability score...";
    if (index >= 75) return "✅ This score is highly stable and verified against internal benchmarks.";
    if (index >= 45) return "⚠️ Moderate stability. Recommended to verify with the latest placement reports.";
    return "🔴 Volatile data found. Use this score as a preliminary guide only.";
}

export default function ExplainabilityCard({ college }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expanded, setExpanded] = useState(null);

    useEffect(() => {
        if (!college?.id) return;
        setLoading(true);
        setError(null);

        // Fixed: Use local API_URL and add cache buster
        fetch(`${API_URL}/api/explain/${college.id}?_t=${Date.now()}`)
            .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
            .then(d => { setData(d); setLoading(false); })
            .catch(() => { setError("Could not load score explanation."); setLoading(false); });
    }, [college?.id]);

    if (loading) {
        return (
            <div className="explain-loading">
                <div className="explain-spinner" />
                Processing CEI vectors…
            </div>
        );
    }
    if (error) {
        return <div className="explain-error">⚠️ {error}</div>;
    }
    if (!data) return null;

    const { vectorBreakdown, scoreSummary, stabilityMeta, methodology } = data;
    const maxContrib = Math.max(...(vectorBreakdown || []).map(v => v.contribution));
    const finalScore = scoreSummary.finalScore ?? scoreSummary.derivedScore;
    const bandColor = getBandColor(college.competitivenessBand);

    const confidenceClass =
        stabilityMeta.confidenceBadge === "HIGH" ? "high" :
            stabilityMeta.confidenceBadge === "MEDIUM" ? "medium" :
                stabilityMeta.confidenceBadge === "LOW" ? "low" : "";

    return (
        <div className="explain-card">

            {/* ── Hero Score Summary ──────────────────────────────────── */}
            <div className="explain-hero">
                <div className="explain-hero-content">
                    <div className="explain-hero-score">
                        <span className="explain-score-big">{Math.round(finalScore)}</span>
                        <span className="explain-score-denom">/100</span>
                    </div>
                    <div className="explain-hero-meta">
                        <div className="explain-hero-title">CEI Evaluation</div>
                        <div className="explain-hero-desc">
                            College Excellence Index — verified cross-metric performance.
                        </div>
                        <div className="explain-band-pill" style={{ background: `${bandColor}18`, color: bandColor, borderColor: `${bandColor}35` }}>
                            {college.competitivenessBand || "Evaluating"} Band
                        </div>
                    </div>
                </div>
            </div>

            {/* ── 1. What Makes Up This Score ───────────────────────── */}
            <div className="explain-matrix-section">
                <div className="explain-section-label">What drives this score?</div>
                <p className="explain-section-intro">
                    We analyze {college.name} across 6 dimensions to calculate an unbiased value.
                </p>

                <div className="explain-factors-list">
                    {(vectorBreakdown || []).map(v => {
                        const pf = getPlainFactor(v.code);
                        const pct = Math.round((v.contribution / maxContrib) * 100);
                        const isOpen = expanded === v.code;
                        return (
                            <div key={v.code} className={`explain-factor-row ${isOpen ? "open" : ""}`}>
                                <button
                                    className="explain-factor-header"
                                    onClick={() => setExpanded(isOpen ? null : v.code)}
                                    aria-expanded={isOpen}
                                >
                                    <span className="explain-factor-icon">{pf.icon}</span>
                                    <span className="explain-factor-name">{pf.what}</span>
                                    <div className="explain-factor-bar-wrap">
                                        <div className="explain-factor-bar-track">
                                            <div className="explain-factor-bar-fill" style={{ width: `${pct}%` }} />
                                        </div>
                                        <span className="explain-factor-score">+{Math.round(v.contribution)}</span>
                                    </div>
                                    <span className="explain-factor-weight">{v.weightPct} weight</span>
                                    <span className="explain-factor-chevron">{isOpen ? "▲" : "▼"}</span>
                                </button>
                                {isOpen && (
                                    <div className="explain-factor-detail">
                                        <p className="explain-factor-why">{pf.why}</p>
                                        <div className="explain-factor-stats">
                                            <span>Factor Achievement: <strong>{v.rawPct}</strong></span>
                                            <span>Contribution: <strong>+{Math.round(v.contribution)} points</strong></span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── New: Simplified "What is CEI?" Guide ──────────────── */}
            <div className="explain-guide-section" style={{ marginTop: '30px', borderTop: '1px dashed #e2e8f0', paddingTop: '24px' }}>
                <div className="explain-section-label">What is CEI?</div>
                <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '16px', fontSize: '0.9rem', color: '#475569', lineHeight: '1.5' }}>
                    <p style={{ margin: 0 }}>
                        The <strong>College Excellence Index (CEI)</strong> is a proprietary transparent algorithm that evaluates institutions on facts, not marketing.
                        Unlike traditional rankings, we weigh <strong>Placement ROI (35%)</strong> and <strong>Admissions Standards (15%)</strong> as the highest indicators of current value.
                    </p>
                    <div style={{ marginTop: '12px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '0.75rem', padding: '4px 8px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>✔️ Unbiased</span>
                        <span style={{ fontSize: '0.75rem', padding: '4px 8px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>✔️ ROI Focused</span>
                        <span style={{ fontSize: '0.75rem', padding: '4px 8px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px' }}>✔️ Anti-Hype</span>
                    </div>
                </div>
            </div>

            {/* ── 2. How Reliable Is This Score ─────────────────────── */}
            <div className="explain-stability-section" style={{ marginTop: '30px' }}>
                <div className="explain-section-label">Reliability & Trust</div>

                <div className="stability-panel">
                    <div className="stability-badge" aria-hidden="true">
                        {stabilityMeta.stabilityIcon}
                    </div>
                    <div className="stability-body">
                        <div className="stability-label">
                            <span className={stabilityMeta.stabilityColor}>
                                {stabilityMeta.stabilityLabel}
                            </span>
                            {stabilityMeta.confidenceBadge && (
                                <span className={`confidence-badge-pill ${confidenceClass}`}>
                                    {stabilityMeta.confidenceBadge} CONFIDENCE
                                </span>
                            )}
                        </div>

                        {stabilityMeta.stabilityIndex !== null && (
                            <div className="stability-index-row">
                                <div className="stability-index-bar-track">
                                    <div
                                        className={`stability-index-bar-fill ${stabilityMeta.stabilityColor}`}
                                        style={{ width: `${stabilityMeta.stabilityIndex}%` }}
                                    />
                                </div>
                                <span className="stability-index-val">
                                    {stabilityMeta.stabilityIndex}/100
                                </span>
                            </div>
                        )}

                        <div className="stability-description">
                            {getStabilityPlainText(stabilityMeta.stabilityIndex)}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── 3. Data Transparency ───────────────────────────────── */}
            {methodology && (
                <div className="explain-anchor-section">
                    <div className="explain-section-label">Audit & Transparency</div>
                    <div className="explain-anchor">
                        <div className="anchor-intro">
                            This score is cryptographically hashed and version-controlled. Any change to the formula is documented in our public ledger.
                        </div>
                        <div className="anchor-row">
                            <span className="anchor-key">Model</span>
                            <span className="anchor-val">
                                {methodology.versionId}
                                <Link
                                    href={`/transparency/version/${methodology.versionId}`}
                                    className="anchor-link"
                                    aria-label="Audit scoring version"
                                >
                                    ↗ Audit
                                </Link>
                            </span>
                        </div>
                        <div className="anchor-row">
                            <span className="anchor-key">Last Audit</span>
                            <span className="anchor-val">
                                {methodology.activatedAt
                                    ? new Date(methodology.activatedAt).toLocaleDateString("en-IN", {
                                        day: "numeric", month: "long", year: "numeric"
                                    })
                                    : "—"
                                }
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
