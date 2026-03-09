"use client";

/**
 * ExplainabilityCard.jsx — "How Was This Score Calculated?"
 * =========================================================
 * Human-friendly explanation of a college's CEI score.
 * Uses plain language so any student can understand what drives rankings.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import "./ExplainabilityCard.css";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").replace(/\/$/, "");

// Plain-language explanations for each scoring factor
const FACTOR_PLAIN_ENGLISH = {
    A: { icon: "🏆", what: "Accreditation Quality", why: "Shows if the college is officially quality-certified (e.g. NAAC A+ grade). Higher grade = more trust." },
    F: { icon: "🏛️", what: "Institution Age & Track Record", why: "Older, well-established colleges tend to have stronger faculty, alumni networks, and proven outcomes." },
    I: { icon: "🏗️", what: "Infrastructure & Ownership", why: "Covers campus facilities, land, ownership type (Govt / Autonomous). Better infrastructure = better learning environment." },
    S: { icon: "📐", what: "Scale of Institution", why: "Universities score higher than autonomous colleges, which score above regular colleges. Broader scale → more opportunities." },
    D: { icon: "📊", what: "Demand & Selectivity", why: "How competitive admissions are. Higher demand means more students want in — a strong signal of quality." },
    P: { icon: "💼", what: "Placement Outcomes", why: "Based on actual placement rates and salary packages from the college. Key indicator for your career after graduation." },
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
    if (index === null || index === undefined) return "Reliability score not available yet.";
    if (index >= 75) return "✅ This score is very reliable — it stays consistent even when we test small data variations.";
    if (index >= 45) return "⚠️ Moderate reliability. The score could shift slightly if key data changes. Cross-check before deciding.";
    return "🔴 Lower reliability. This college's score is sensitive to data gaps. Use as a guide, not a final verdict.";
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

        fetch(`${API_URL}/api/explain/${college.id}`)
            .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
            .then(d => { setData(d); setLoading(false); })
            .catch(() => { setError("Could not load score explanation."); setLoading(false); });
    }, [college?.id]);

    if (loading) {
        return (
            <div className="explain-loading">
                <div className="explain-spinner" />
                Loading score breakdown…
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
                        <span className="explain-score-big">{Number(finalScore).toFixed(1)}</span>
                        <span className="explain-score-denom">/100</span>
                    </div>
                    <div className="explain-hero-meta">
                        <div className="explain-hero-title">CEI Score</div>
                        <div className="explain-hero-desc">
                            College Excellence Index — a composite score across 6 key factors.
                        </div>
                        <div className="explain-band-pill" style={{ background: `${bandColor}18`, color: bandColor, borderColor: `${bandColor}35` }}>
                            {college.competitivenessBand || "—"} Band
                        </div>
                    </div>
                </div>
                {Number(scoreSummary.penalty) > 0 && (
                    <div className="explain-penalty-note">
                        ⚡ A small deduction of <strong>{scoreSummary.penalty} points</strong> was applied due to missing or incomplete data. Colleges with fully filled data score higher.
                    </div>
                )}
            </div>

            {/* ── 1. What Makes Up This Score ───────────────────────── */}
            <div className="explain-matrix-section">
                <div className="explain-section-label">What makes up this score?</div>
                <p className="explain-section-intro">
                    The score is built from 6 factors. Click any factor to learn what it means and why it matters for your decision.
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
                                        <span className="explain-factor-score">+{v.contribution.toFixed(1)}</span>
                                    </div>
                                    <span className="explain-factor-weight">{v.weightPct} weight</span>
                                    <span className="explain-factor-chevron">{isOpen ? "▲" : "▼"}</span>
                                </button>
                                {isOpen && (
                                    <div className="explain-factor-detail">
                                        <p className="explain-factor-why">{pf.why}</p>
                                        <div className="explain-factor-stats">
                                            <span>Performance: <strong>{v.rawPct}</strong></span>
                                            <span>Impact on total: <strong>+{v.contribution.toFixed(1)} pts</strong></span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ── 2. How Reliable Is This Score ─────────────────────── */}
            <div className="explain-stability-section">
                <div className="explain-section-label">How reliable is this score?</div>

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
                    <div className="explain-section-label">Data Transparency</div>
                    <div className="explain-anchor">
                        <div className="anchor-intro">
                            🔒 This score is based on verified, versioned data. You can audit exactly which dataset was used and when it was last updated.
                        </div>
                        <div className="anchor-row">
                            <span className="anchor-key">Scoring Model</span>
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
                            <span className="anchor-key">Data Updated</span>
                            <span className="anchor-val">
                                {methodology.activatedAt
                                    ? new Date(methodology.activatedAt).toLocaleDateString("en-IN", {
                                        day: "numeric", month: "long", year: "numeric"
                                    })
                                    : "—"
                                }
                            </span>
                        </div>
                        {methodology.datasetHash && (
                            <div className="anchor-row">
                                <span className="anchor-key">Dataset ID</span>
                                <span className="anchor-val anchor-hash">
                                    {methodology.datasetHash?.slice(0, 12)}…
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
