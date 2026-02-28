"use client";

/**
 * ExplainabilityCard.jsx — CEI Institutional Score Explainability
 * ================================================================
 * Renders three progressive layers of explanation for a single institution:
 *
 *  1. Score Breakdown Matrix  — Vector | Weight | Raw% | Contribution
 *  2. Stability & Confidence  — Monte Carlo stability index with deterministic badge
 *  3. Constitutional Anchor   — Version ID, dataset hash, activation date → link to /transparency
 *
 * Data fetched from: GET /api/explain/:id
 * All data is anchored to the active ScoringVersion — never stale or unversioned.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import "./ExplainabilityCard.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

export default function ExplainabilityCard({ college }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!college?.id) return;
        setLoading(true);
        setError(null);

        fetch(`${API_URL}/api/explain/${college.id}`)
            .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
            .then(d => { setData(d); setLoading(false); })
            .catch(e => { setError("Could not load score explanation."); setLoading(false); });
    }, [college?.id]);

    if (loading) {
        return (
            <div className="explain-loading">
                <div className="explain-spinner" />
                Loading constitutional score data…
            </div>
        );
    }
    if (error) {
        return <div className="explain-error">⚠️ {error}</div>;
    }
    if (!data) return null;

    const { vectorBreakdown, scoreSummary, stabilityMeta, methodology } = data;
    const maxContrib = Math.max(...(vectorBreakdown || []).map(v => v.contribution));

    const confidenceClass =
        stabilityMeta.confidenceBadge === "HIGH" ? "high" :
            stabilityMeta.confidenceBadge === "MEDIUM" ? "medium" :
                stabilityMeta.confidenceBadge === "LOW" ? "low" : "";

    return (
        <div className="explain-card">

            {/* ── 1. Score Breakdown Matrix ──────────────────────────── */}
            <div className="explain-matrix-section">
                <div className="explain-section-label">Score Vector Decomposition</div>

                {/* Summary strip */}
                <div className="score-summary-strip">
                    <div className="score-stat">
                        <span className="score-stat-label">Gross Score</span>
                        <span className="score-stat-val">{scoreSummary.grossScore}</span>
                    </div>
                    <div className="score-stat">
                        <span className="score-stat-label">Data Penalty</span>
                        <span className="score-stat-val">−{scoreSummary.penalty}</span>
                    </div>
                    <div className="score-stat">
                        <span className="score-stat-label">CEI Score</span>
                        <span className="score-stat-val final">{scoreSummary.finalScore ?? scoreSummary.derivedScore}</span>
                    </div>
                    <div className="score-stat">
                        <span className="score-stat-label">Band</span>
                        <span className="score-stat-val">{college.competitivenessBand || "—"}</span>
                    </div>
                </div>

                <table className="explain-matrix" aria-label="Score vector breakdown">
                    <thead>
                        <tr>
                            <th>Vector</th>
                            <th>Weight</th>
                            <th>Raw Value</th>
                            <th>Contribution</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(vectorBreakdown || []).map(v => (
                            <tr key={v.code}>
                                <td>
                                    <div className="vec-name-cell">
                                        <span className="vec-code">{v.code}</span>
                                        <span className="vec-desc">{v.description}</span>
                                    </div>
                                </td>
                                <td>{v.weightPct}</td>
                                <td>{v.rawPct}</td>
                                <td>
                                    <div className="contrib-bar-wrap">
                                        <div
                                            className="contrib-bar"
                                            style={{ width: `${Math.round((v.contribution / maxContrib) * 60)}px` }}
                                            aria-hidden="true"
                                        />
                                        <span className="contrib-val">+{v.contribution.toFixed(1)}</span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan={3}>Total (before penalty)</td>
                            <td>+{scoreSummary.grossScore}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            {/* ── 2. Stability & Confidence ──────────────────────────── */}
            <div className="explain-stability-section">
                <div className="explain-section-label">Monte Carlo Stability Assessment</div>

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
                            {stabilityMeta.stabilityIndex !== null
                                ? `Computed across ${stabilityMeta.monteCarloRuns || 50} Monte Carlo simulations with ±5% vector perturbation. ` +
                                `A score of ${stabilityMeta.stabilityIndex}/100 indicates ${stabilityMeta.stabilityIndex >= 75
                                    ? "this institution's ranking is highly robust to minor data variations."
                                    : stabilityMeta.stabilityIndex >= 45
                                        ? "moderate sensitivity to data changes — verify core metrics."
                                        : "significant rank volatility — treat placement in current band with caution."
                                }`
                                : "Stability index not computed for this institution in the current scoring run."
                            }
                        </div>
                    </div>
                </div>
            </div>

            {/* ── 3. Constitutional Anchor ───────────────────────────── */}
            <div className="explain-anchor-section">
                <div className="explain-section-label">Constitutional Reference</div>

                {methodology ? (
                    <div className="explain-anchor">
                        <div className="anchor-row">
                            <span className="anchor-key">Scoring Version</span>
                            <span className="anchor-val">
                                {methodology.versionId}
                                <Link
                                    href={`/transparency/version/${methodology.versionId}`}
                                    className="anchor-link"
                                    aria-label="View scoring version details"
                                >
                                    ↗ Inspect
                                </Link>
                            </span>
                        </div>
                        <div className="anchor-row">
                            <span className="anchor-key">Dataset Hash</span>
                            <span className="anchor-val anchor-hash">
                                {methodology.datasetHash?.slice(0, 16)}…{methodology.datasetHash?.slice(-8)}
                            </span>
                        </div>
                        <div className="anchor-row">
                            <span className="anchor-key">Activated</span>
                            <span className="anchor-val">
                                {methodology.activatedAt
                                    ? new Date(methodology.activatedAt).toLocaleDateString("en-IN", {
                                        day: "numeric", month: "long", year: "numeric"
                                    })
                                    : "—"
                                }
                            </span>
                        </div>
                        <div className="anchor-row">
                            <span className="anchor-key">Engine</span>
                            <span className="anchor-val">{methodology.engineVersion || college.ceiEngineVersion || "—"}</span>
                        </div>
                        {college._recordHash && (
                            <div className="anchor-row">
                                <span className="anchor-key">Record Hash</span>
                                <span className="anchor-val anchor-hash">
                                    {String(college._recordHash).slice(0, 16)}…
                                </span>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="no-version-notice">
                        ⚠️ No active scoring version found. The governance layer must publish a version before constitutional anchoring is available.
                        <Link href="/transparency" className="anchor-link" style={{ color: "#b45309", marginLeft: 8 }}>
                            → View Transparency API
                        </Link>
                    </div>
                )}
            </div>

        </div>
    );
}
