"use client";
/**
 * DataConfidenceBadge.jsx — CEI Data Trust Indicator
 * ====================================================
 * Compact public trust badge showing institution data quality.
 * 🟢 High | 🟡 Moderate | 🔴 Low
 *
 * Usage: <DataConfidenceBadge label="high" score={82} />
 */

import { useState } from "react";
import "./DataConfidenceBadge.css";

const CONFIG = {
    high: {
        emoji: "🟢",
        label: "High Confidence",
        description: "This institution's data has been cross-verified against government sources (AISHE/UGC/AICTE) and/or independently audited.",
        className: "dcb-high"
    },
    moderate: {
        emoji: "🟡",
        label: "Moderate Confidence",
        description: "Core data is verified but not all fields have been cross-checked against official government registries.",
        className: "dcb-moderate"
    },
    low: {
        emoji: "🔴",
        label: "Low / Self-Declared",
        description: "Data is primarily self-declared or unverified. Treat placement figures and metrics with caution.",
        className: "dcb-low"
    }
};

export default function DataConfidenceBadge({ label = "low", score = null, compact = false }) {
    const [showTooltip, setShowTooltip] = useState(false);
    const cfg = CONFIG[label] || CONFIG.low;

    return (
        <div
            className={`dcb-wrapper ${compact ? "dcb-compact" : ""}`}
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            <span className={`dcb-badge ${cfg.className}`}>
                <span className="dcb-emoji">{cfg.emoji}</span>
                {!compact && <span className="dcb-text">{cfg.label}</span>}
                {score !== null && !compact && (
                    <span className="dcb-score">{score}/100</span>
                )}
            </span>

            {showTooltip && (
                <div className="dcb-tooltip" role="tooltip">
                    <strong>{cfg.label}{score !== null ? ` (${score}/100)` : ""}</strong>
                    <p>{cfg.description}</p>
                    <a href="/methodology#data-confidence" className="dcb-tooltip-link">
                        How is this calculated? →
                    </a>
                </div>
            )}
        </div>
    );
}
