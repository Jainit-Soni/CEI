"use client";

/**
 * ScoringComparisonMatrix.jsx — CEI Vector Score Comparison
 * ==========================================================
 * Side-by-side scoring decomposition for 2–5 institutions.
 * Data fetched from POST /api/explain/batch.
 *
 * Sections:
 *  1. CEI Score header row
 *  2. Vector decomposition table (A, F, I, S, D, U per institution)
 *  3. Strength Differential — auto-computed "College A leads in X"
 *  4. Monte Carlo variance toggle
 *  5. Version mismatch notice
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import "./ScoringComparisonMatrix.css";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").replace(/\/$/, "");

const BAND_COLORS = {
    Elite: { bg: "#0f172a", color: "#f8fafc" },
    High: { bg: "#1e3a5f", color: "#e0f0ff" },
    Competitive: { bg: "#164e63", color: "#cffafe" },
    Moderate: { bg: "#713f12", color: "#fef9c3" },
    Emerging: { bg: "#3f3f46", color: "#f4f4f5" },
};

const VECTOR_FULL = {
    A: "Accreditation",
    F: "Faculty Legacy",
    I: "Infrastructure",
    S: "Scale",
    D: "Demand",
    U: "Urban Proximity",
};

function CellBar({ value, max, isLeader }) {
    const pct = max > 0 ? (value / max) * 100 : 0;
    return (
        <div className="cell-bar-wrap">
            <div className="cell-bar-track">
                <div
                    className={`cell-bar-fill ${isLeader ? "leader" : ""}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            <span className={`cell-bar-val ${isLeader ? "leader" : ""}`}>
                {value.toFixed(1)}
            </span>
        </div>
    );
}

export default function ScoringComparisonMatrix({ colleges }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showVariance, setShowVariance] = useState(false);

    const ids = (colleges || []).map(c => c.id).filter(Boolean);

    const load = useCallback(async () => {
        if (ids.length < 1) return;
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(`${API_URL}/api/explain/batch`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ids }),
            });
            if (!res.ok) throw new Error(await res.text());
            setData(await res.json());
        } catch (err) {
            setError("Could not load scoring comparison data.");
        } finally {
            setLoading(false);
        }
    }, [ids.join(",")]);

    useEffect(() => { load(); }, [load]);

    if (loading) {
        return (
            <div className="scm-loading">
                <div className="scm-spinner" />
                Loading Constitutional Score Comparison…
            </div>
        );
    }
    if (error) return <div className="scm-error">⚠️ {error}</div>;
    if (!data) return null;
    if (!data.explanations?.length) return null;

    const exps = data.explanations;
    const vectors = Object.keys(VECTOR_FULL);

    // ── Compute strength differentials ───────────────────────────────────────
    const differentials = [];
    if (exps.length >= 2) {
        const [a, b] = exps;
        const aLeads = [], bLeads = [];
        vectors.forEach(code => {
            const aRow = a.vectorBreakdown.find(v => v.code === code);
            const bRow = b.vectorBreakdown.find(v => v.code === code);
            if (!aRow || !bRow) return;
            const delta = aRow.contribution - bRow.contribution;
            if (delta > 0.5) aLeads.push({ code, label: VECTOR_FULL[code], delta: +delta.toFixed(1) });
            if (delta < -0.5) bLeads.push({ code, label: VECTOR_FULL[code], delta: +Math.abs(delta).toFixed(1) });
        });
        if (aLeads.length) differentials.push({ name: a.college.shortName || a.college.name, leads: aLeads });
        if (bLeads.length) differentials.push({ name: b.college.shortName || b.college.name, leads: bLeads });
    }

    return (
        <div className="scm-root">

            {/* ── Version mismatch notice ───────────────────────────── */}
            {data.versionMismatch && (
                <div className="scm-version-warn">
                    ⚠️ These institutions were scored under different engine versions
                    ({data.versionIds?.join(" vs ")}). Direct score comparisons may not be
                    fully equivalent.
                </div>
            )}

            {/* ── Constitutional pinning ────────────────────────────── */}
            {data.activeVersion && (
                <div className="scm-version-pin">
                    Scores referenced under{" "}
                    <Link href={`/transparency/version/${data.activeVersion.versionId}`} className="scm-ver-link">
                        {data.activeVersion.versionId}
                    </Link>
                    {" · "}Dataset Hash: <span className="scm-hash">{data.activeVersion.datasetHash?.slice(0, 12)}…</span>
                </div>
            )}

            <div className="scm-section-label">CEI Scoring Decomposition</div>

            <div className="scm-table-wrap">
                <table className="scm-table" aria-label="CEI Score Comparison Matrix">
                    <thead>
                        {/* Score header row */}
                        <tr className="scm-score-row">
                            <th className="scm-label-col">Score</th>
                            {exps.map(exp => {
                                const band = exp.college.band || "Emerging";
                                const style = BAND_COLORS[band] || BAND_COLORS.Emerging;
                                return (
                                    <th key={exp.college.id} className="scm-college-col" style={style}>
                                        <div className="scm-college-name">{exp.college.shortName || exp.college.name}</div>
                                        <div className="scm-college-score">{exp.college.ceiScore ?? "—"}</div>
                                        <div className="scm-college-band">{band}</div>
                                    </th>
                                );
                            })}
                        </tr>
                        {/* Column labels */}
                        <tr className="scm-header-row">
                            <th className="scm-label-col">Vector (Weight)</th>
                            {exps.map(exp => (
                                <th key={exp.college.id} className="scm-college-col">
                                    Contribution
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {vectors.map(code => {
                            const rows = exps.map(exp => exp.vectorBreakdown?.find(v => v.code === code));
                            const contribs = rows.map(r => r?.contribution ?? 0);
                            const maxContrib = Math.max(...contribs);
                            const weight = rows[0]?.weightPct || "—";

                            return (
                                <tr key={code} className="scm-vec-row">
                                    <td className="scm-vec-label">
                                        <span className="scm-vec-code">{code}</span>
                                        <span className="scm-vec-name">{VECTOR_FULL[code]}</span>
                                        <span className="scm-vec-weight">{weight}</span>
                                    </td>
                                    {rows.map((row, i) => (
                                        <td key={exps[i].college.id} className="scm-value-cell">
                                            <CellBar
                                                value={row?.contribution ?? 0}
                                                max={maxContrib}
                                                isLeader={row?.contribution === maxContrib && maxContrib > 0}
                                            />
                                            {showVariance && exps[i].stabilityMeta?.stabilityIndex !== null && (
                                                <div className="scm-variance-note">
                                                    Stability: {exps[i].stabilityMeta.stabilityIndex}/100
                                                </div>
                                            )}
                                        </td>
                                    ))}
                                </tr>
                            );
                        })}

                        {/* Penalty row */}
                        <tr className="scm-penalty-row">
                            <td className="scm-vec-label">
                                <span className="scm-vec-code" style={{ background: "#7f1d1d" }}>−P</span>
                                <span className="scm-vec-name">Data Penalty</span>
                            </td>
                            {exps.map(exp => (
                                <td key={exp.college.id} className="scm-value-cell scm-penalty-cell">
                                    −{exp.scoreSummary.penalty}
                                </td>
                            ))}
                        </tr>

                        {/* Final score row */}
                        <tr className="scm-final-row">
                            <td className="scm-vec-label">
                                <strong>CEI Score</strong>
                            </td>
                            {exps.map(exp => (
                                <td key={exp.college.id} className="scm-final-cell">
                                    <strong>{exp.college.ceiScore ?? exp.scoreSummary.derivedScore}</strong>
                                </td>
                            ))}
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* ── Monte Carlo toggle ────────────────────────────────── */}
            <label className="scm-variance-toggle">
                <input
                    type="checkbox"
                    checked={showVariance}
                    onChange={e => setShowVariance(e.target.checked)}
                />
                <span>Show Monte Carlo Stability Index per vector</span>
            </label>

            {/* ── Strength Differential ─────────────────────────────── */}
            {differentials.length > 0 && (
                <div className="scm-differential-section">
                    <div className="scm-section-label">Strength Differential</div>
                    <div className="scm-differential-grid">
                        {differentials.map(d => (
                            <div key={d.name} className="scm-diff-block">
                                <div className="scm-diff-leader">{d.name} leads in:</div>
                                <ul className="scm-diff-list">
                                    {d.leads.map(l => (
                                        <li key={l.code}>
                                            <span className="scm-diff-vec">{VECTOR_FULL[l.code]}</span>
                                            <span className="scm-diff-delta">+{l.delta}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>
            )}

        </div>
    );
}
