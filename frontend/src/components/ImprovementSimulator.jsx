"use client";
/**
 * ImprovementSimulator.jsx — "What if this college improved?"
 * ===============================================================================
 * A sandboxed what-if simulator for students/institutions to explore score changes.
 */

import { useState } from "react";
import "./ImprovementSimulator.css";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").replace(/\/$/, "");

const NAAC_GRADES = ["A++", "A+", "A", "B++", "B+", "B", "C", ""];
const TIERS = ["Tier 1", "Tier 2", "Tier 3", "University", "Stand Alone"];

const BAND_COLORS = {
    Elite: { color: "#4f46e5", bg: "rgba(79, 70, 229, 0.12)", border: "rgba(79, 70, 229, 0.3)" },
    High: { color: "#0ea5e9", bg: "rgba(14, 165, 233, 0.12)", border: "rgba(14, 165, 233, 0.3)" },
    Competitive: { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.12)", border: "rgba(245, 158, 11, 0.3)" },
    Moderate: { color: "#ef4444", bg: "rgba(239, 68, 68, 0.12)", border: "rgba(239, 68, 68, 0.3)" },
    Emerging: { color: "#8b5cf6", bg: "rgba(139, 92, 246, 0.12)", border: "rgba(139, 92, 246, 0.3)" }
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
            {/* Watermark notice */}
            <div className="sim-watermark-bar">
                ✨ HYPOTHETICAL SIMULATOR — Does not affect actual college rankings
            </div>

            <div className="sim-body">
                {/* Controls */}
                <div className="sim-controls">
                    <h3 className="sim-heading">Score Simulator</h3>
                    <p className="sim-subtext">
                        Wondering how a better NAAC grade or higher placement rate would impact this college's CEI score? Play around with the sliders below to find out!
                    </p>

                    <div className="sim-field">
                        <label>Expected NAAC Grade</label>
                        <select className="sim-select" value={naacGrade} onChange={e => setNaacGrade(e.target.value)}>
                            {NAAC_GRADES.map(g => <option key={g} value={g}>{g || "Not Accredited"}</option>)}
                        </select>
                    </div>

                    <div className="sim-field">
                        <label>Expected Placement Rate: <strong className="sim-val-highlight">{placementRate}%</strong></label>
                        <input
                            type="range" min={0} max={100} step={1}
                            value={placementRate}
                            onChange={e => setPlacementRate(+e.target.value)}
                            className="sim-slider"
                        />
                    </div>

                    <div className="sim-field">
                        <label>Expected College Type/Tier</label>
                        <select className="sim-select" value={rankingTier} onChange={e => setRankingTier(e.target.value)}>
                            {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    <button
                        className="sim-run-btn"
                        onClick={runSimulation}
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <span className="sim-spinner"></span>
                                Calculating...
                            </>
                        ) : (
                            "▶ See New Score"
                        )}
                    </button>

                    {error && <div className="sim-error">⚠️ {error}</div>}
                </div>

                {/* Result */}
                {result && (
                    <div className="sim-result">
                        <div className="sim-result-tag">Predicted Score Change</div>

                        <div className="sim-score-row">
                            {/* Current */}
                            <div className="sim-score-card">
                                <div className="sim-score-label">Current Score</div>
                                <div className="sim-score-val">{result.currentScore?.toFixed(1)}</div>
                                <div
                                    className="sim-band-pill"
                                    style={{ color: bandCfg(result.currentBand).color, background: bandCfg(result.currentBand).bg, borderColor: bandCfg(result.currentBand).border }}
                                >
                                    {result.currentBand}
                                </div>
                            </div>

                            {/* Arrow */}
                            <div className={`sim-delta-arrow ${result.scoreDelta >= 0 ? "positive" : "negative"}`}>
                                {result.scoreDelta >= 0 ? "↗" : "↘"}
                                <span>{result.scoreDelta > 0 ? "+" : ""}{result.scoreDelta?.toFixed(1)} pts</span>
                            </div>

                            {/* Simulated */}
                            <div className="sim-score-card highlight">
                                <div className="sim-score-label">New Estimated Score</div>
                                <div className="sim-score-val highlight-val">{result.simulatedScore?.toFixed(1)}</div>
                                <div
                                    className="sim-band-pill"
                                    style={{ color: bandCfg(result.simulatedBand).color, background: bandCfg(result.simulatedBand).bg, borderColor: bandCfg(result.simulatedBand).border }}
                                >
                                    {result.simulatedBand}
                                </div>
                            </div>
                        </div>

                        <div className="sim-disclaimer">
                            Note: This is just an estimate using a simplified formula. The real CEI algorithm considers over 40+ dynamic data points to generate the final rank.
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
