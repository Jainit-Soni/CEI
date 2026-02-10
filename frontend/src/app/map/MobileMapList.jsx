"use client";

import { useMemo } from "react";
import "./map.css";

// Helper for color logic (Same as main map)
function getNodeColor(count) {
    if (count === 0) return "#64748b";
    if (count >= 40) return "#fbbf24"; // Gold
    if (count >= 20) return "#60a5fa"; // Blue
    if (count >= 10) return "#a78bfa"; // Purple
    return "#34d399"; // Green
}

export default function MobileMapList({ stateStats, onStateClick }) {
    // Sort states by count (High to Low)
    const sortedStates = useMemo(() => {
        return Object.entries(stateStats)
            .sort(([, countA], [, countB]) => countB - countA)
            .map(([name, count]) => ({ name, count }));
    }, [stateStats]);

    return (
        <div className="mobile-map-list">
            <div className="mobile-list-header">
                <h3>State Density Index</h3>
                <p>Select a region to explore colleges</p>
            </div>

            <div className="mobile-states-grid">
                {sortedStates.map(({ name, count }) => (
                    <button
                        key={name}
                        className="mobile-state-card"
                        onClick={() => onStateClick(name)}
                    >
                        <div
                            className="mobile-state-indicator"
                            style={{ background: getNodeColor(count) }}
                        />
                        <div className="mobile-state-info">
                            <span className="mobile-state-name">{name}</span>
                            <span className="mobile-state-count">{count} Colleges</span>
                        </div>
                        <span className="mobile-arrow">→</span>
                    </button>
                ))}
            </div>
        </div>
    );
}
