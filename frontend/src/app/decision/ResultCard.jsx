"use client";

/**
 * app/decision/ResultCard.jsx
 * ============================
 * Displays a single college recommendation returned by the decision engine.
 */

import { useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";

const MATCH_COLOR = {
    Excellent: { bg: '#d1fae5', color: '#065f46' },
    Good: { bg: '#dbeafe', color: '#1d4ed8' },
    Fair: { bg: '#fef3c7', color: '#92400e' },
    Stretch: { bg: '#fee2e2', color: '#991b1b' },
};

const PR_LABEL_COLOR = (label) => {
    if (label?.includes('Highly')) return { bg: '#d1fae5', color: '#065f46', dot: '#10b981' };
    if (label?.includes('Moderate')) return { bg: '#fef3c7', color: '#92400e', dot: '#f59e0b' };
    return { bg: '#fee2e2', color: '#991b1b', dot: '#ef4444' };
};

export default function ResultCard({ rec, rank }) {
    const [expanded, setExpanded] = useState(false);
    const matchColors = MATCH_COLOR[rec.match] || MATCH_COLOR.Fair;
    const isTop3 = rank <= 3;

    return (
        <div
            className="dec-card"
            style={{ borderLeft: isTop3 ? '4px solid #4f46e5' : undefined, animation: `slideUp 0.3s ease ${rank * 0.05}s both` }}
        >
            {/* Rank Number */}
            <div className={`dec-card-rank ${isTop3 ? 'top3' : ''}`}>#{rank}</div>

            {/* Content */}
            <div className="dec-card-body">
                <h3 className="dec-card-name">{rec.name}</h3>

                {/* Chips */}
                <div className="dec-card-meta">
                    {rec.state && <span className="dec-pill dec-pill-state">{rec.state}</span>}
                    {rec.rankingTier && <span className="dec-pill dec-pill-tier">{rec.rankingTier}</span>}
                    {rec.ceiScore > 0 && <span className="dec-pill dec-pill-cei">CEI {rec.ceiScore.toFixed(0)}</span>}
                    {rec.dataConfidenceLabel === 'high' && <span className="dec-pill dec-pill-verified">✓ Verified</span>}
                    {rec.placementReliabilityLabel && (() => {
                        const c = PR_LABEL_COLOR(rec.placementReliabilityLabel);
                        return (
                            <span style={{ background: c.bg, color: c.color, display: 'inline-flex', alignItems: 'center', gap: 4 }} className="dec-pill">
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot, flexShrink: 0 }} />
                                {rec.placementReliabilityLabel}
                            </span>
                        );
                    })()}
                </div>

                {/* Reasons */}
                {rec.reasons?.length > 0 && (
                    <ul className="dec-card-reasons">
                        {rec.reasons.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                )}

                {/* Expand for more details */}
                {rec.overview && (
                    <button
                        onClick={() => setExpanded(o => !o)}
                        style={{ marginTop: 10, fontSize: '0.78rem', color: '#6366f1', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, padding: 0 }}
                    >
                        {expanded ? <><ChevronUp size={14} /> Less</> : <><ChevronDown size={14} /> About this college</>}
                    </button>
                )}
                {expanded && rec.overview && (
                    <p style={{ marginTop: 8, fontSize: '0.8125rem', color: '#475569', lineHeight: 1.6, maxWidth: 560 }}>
                        {rec.overview.slice(0, 300)}{rec.overview.length > 300 ? '…' : ''}
                    </p>
                )}
            </div>

            {/* Score Side */}
            <div className="dec-score-side">
                <div className="dec-score-number">{rec.studentScore}</div>
                <div className="dec-score-label">Match Score</div>
                <div className="dec-match-badge" style={{ background: matchColors.bg, color: matchColors.color }}>
                    {rec.match}
                </div>
                {rec.estimatedROI && (
                    <div className="dec-roi">ROI {rec.estimatedROI}</div>
                )}
                {rec.tuition && (
                    <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginTop: 4 }}>
                        Fee: {rec.tuition.slice(0, 12)}
                    </div>
                )}
            </div>
        </div>
    );
}
