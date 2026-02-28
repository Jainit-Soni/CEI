"use client";
/**
 * ImprovementSimulator.jsx — CEI Institutional Improvement Sandbox (Phase XIII)
 * ===============================================================================
 * A sandboxed what-if simulator for institutions to explore score improvements.
 *
 * CRITICAL: This component never writes to the database.
 * Every result is labeled "Hypothetical" with a clear disclaimer.
 */

import { useState } from "react";
import "./ImprovementSimulator.css";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").replace(/\/$/, "");

const NAAC_GRADES = ["A++", "A+", "A", "B++", "B+", "B", "C", ""];
const TIERS = ["Tier 1", "Tier 2", "Tier 3", "University", "Stand Alone"];

const BAND_COLORS = {
    Elite: { color: "#60a5fa", bg: "rgba(96,165,250,0.12)" },
    High: { color: "#34d399", bg: "rgba(52,211,153,0.12)" },
    Competitive: { color: "#fbbf24", bg: "rgba(251,191,36,0.12)" },
    Moderate: { color: "#f87171", bg: "rgba(248,113,113,0.12)" },
    Emerging: { color: "#94a3b8", bg: "rgba(148,163,184,0.12)" }
};

export default function ImprovementSimulator({ college }) {
    const [naacGrade, setNaacGrade] = useState(college?.meta?.naacGrade || "");
    const [placementRate, setPlacementRate] = useState(parseFloat(college?.placements?.placementRate) || 70);
    const [rankingTier, setRankingTier] = useState(college?.rankingTier || "Tier 3");

    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    async function runSimulation() {
        if (!college?.id) return;
        setLoading(true);
        setError(null);
        setResult(null);

        try {
            const res = await fetch(`${API_URL}/api/simulator/what-if`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    collegeId: college.id,
                    hypotheticals: {
                        naacGrade: naacGrade !== (college?.meta?.naacGrade || "") ? naacGrade : undefined,
                        placementRate: placementRate !== parseFloat(college?.placements?.placementRate || 70) ? placementRate : undefined,
                        rankingTier: rankingTier !== college?.rankingTier ? rankingTier : undefined
                    }
                })
            });

            if (!res.ok) throw new Error((await res.json()).error || "Simulation failed");
            const data = await res.json();
            setResult(data);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    const bandCfg = (band) => BAND_COLORS[band] || BAND_COLORS.Emerging;

    return (
        <div className="sim-root">
            {/* Watermark banner */}
            <div className="sim-watermark-bar">
                🔬 HYPOTHETICAL SANDBOX — No changes are saved to the database
            </div>

            <div className="sim-body">
                {/* Controls */}
                <div className="sim-controls">
                    <h3 className="sim-heading">Improvement Simulator</h3>
                    <p className="sim-subtext">
                        Adjust parameters below to see how changes could affect the CEI score.
                        Results are approximate and use a simplified model.
                    </p>

                    <div className="sim-field">
                        <label>NAAC Grade</label>
                        <select value={naacGrade} onChange={e => setNaacGrade(e.target.value)}>
                            {NAAC_GRADES.map(g => <option key={g} value={g}>{g || "—"}</option>)}
                        </select>
                    </div>

                    <div className="sim-field">
                        <label>Placement Rate: <strong>{placementRate}%</strong></label>
                        <input
                            type="range" min={0} max={100} step={1}
                            value={placementRate}
                            onChange={e => setPlacementRate(+e.target.value)}
                        />
                    </div>

                    <div className="sim-field">
                        <label>Ranking Tier</label>
                        <select value={rankingTier} onChange={e => setRankingTier(e.target.value)}>
                            {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    <button
                        className="sim-run-btn"
                        onClick={runSimulation}
                        disabled={loading}
                    >
                        {loading ? "Simulating..." : "▶ Run Simulation"}
                    </button>

                    {error && <div className="sim-error">⚠️ {error}</div>}
                </div>

                {/* Result */}
                {result && (
                    <div className="sim-result">
                        <div className="sim-result-tag">⚗️ Hypothetical Result</div>

                        <div className="sim-score-row">
                            {/* Current */}
                            <div className="sim-score-card">
                                <div className="sim-score-label">Current Score</div>
                                <div className="sim-score-val">{result.currentScore?.toFixed(1)}</div>
                                <div
                                    className="sim-band-pill"
                                    style={{ color: bandCfg(result.currentBand).color, background: bandCfg(result.currentBand).bg }}
                                >
                                    {result.currentBand}
                                </div>
                            </div>

                            {/* Arrow */}
                            <div className={`sim-delta-arrow ${result.scoreDelta >= 0 ? "positive" : "negative"}`}>
                                {result.scoreDelta >= 0 ? "▲" : "▼"}
                                <span>{Math.abs(result.scoreDelta).toFixed(1)} pts</span>
                            </div>

                            {/* Simulated */}
                            <div className="sim-score-card highlight">
                                <div className="sim-score-label">Simulated Score</div>
                                <div className="sim-score-val">{result.simulatedScore?.toFixed(1)}</div>
                                <div
                                    className="sim-band-pill"
                                    style={{ color: bandCfg(result.simulatedBand).color, background: bandCfg(result.simulatedBand).bg }}
                                >
                                    {result.simulatedBand}
                                </div>
                            </div>
                        </div>

                        <div className="sim-disclaimer">
                            {result.disclaimer}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
