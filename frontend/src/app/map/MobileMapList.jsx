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

export default function MobileMapList({ stateStats, totalStats, onStateClick }) {
    // Sort states by count (High to Low)
    const sortedStates = useMemo(() => {
        return Object.entries(stateStats)
            .map(([name, data]) => {
                const count = typeof data === 'object' ? (data.count || 0) : (data || 0);
                return { name, count };
            })
            .sort((a, b) => b.count - a.count);
    }, [stateStats]);

    return (
        <div className="mobile-map-list">
            <div className="mobile-list-header">
                <h3 className="title-glow">Strategic Priority Index</h3>
                <p>{totalStats?.colleges}+ colleges across {totalStats?.states} states & {totalStats?.uts} UTs</p>

                <div className="mobile-legend-compact">
                    <div className="legend-item"><span className="dot" style={{ background: '#fbbf24' }}></span> 40+</div>
                    <div className="legend-item"><span className="dot" style={{ background: '#60a5fa' }}></span> 20+</div>
                    <div className="legend-item"><span className="dot" style={{ background: '#a78bfa' }}></span> 10+</div>
                    <div className="legend-item"><span className="dot" style={{ background: '#34d399' }}></span> 1+</div>
                </div>
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
