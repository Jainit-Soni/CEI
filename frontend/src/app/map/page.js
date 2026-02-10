"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { fetchStateStats } from "@/lib/api";
import Container from "@/components/Container";
import "./map.css";

// State nodes with positions and connections (neighboring states)
const STATE_NODES = {
    // North
    "Jammu and Kashmir": { x: 28, y: 12, connections: ["Ladakh", "Himachal Pradesh", "Punjab"] },
    "Ladakh": { x: 38, y: 10, connections: ["Jammu and Kashmir", "Himachal Pradesh"] },
    "Himachal Pradesh": { x: 32, y: 20, connections: ["Jammu and Kashmir", "Ladakh", "Punjab", "Haryana", "Uttarakhand"] },
    "Punjab": { x: 24, y: 24, connections: ["Jammu and Kashmir", "Himachal Pradesh", "Haryana", "Rajasthan"] },
    "Haryana": { x: 28, y: 30, connections: ["Punjab", "Himachal Pradesh", "Uttarakhand", "Uttar Pradesh", "Rajasthan", "Delhi"] },
    "Uttarakhand": { x: 38, y: 26, connections: ["Himachal Pradesh", "Haryana", "Uttar Pradesh"] },
    "Uttar Pradesh": { x: 42, y: 34, connections: ["Uttarakhand", "Haryana", "Rajasthan", "Madhya Pradesh", "Chhattisgarh", "Bihar"] },
    "Delhi": { x: 30, y: 32, connections: ["Haryana", "Uttar Pradesh"] },
    "Chandigarh": { x: 26, y: 22, connections: ["Punjab", "Haryana"] },

    // East
    "Bihar": { x: 52, y: 38, connections: ["Uttar Pradesh", "Jharkhand", "West Bengal"] },
    "Jharkhand": { x: 50, y: 46, connections: ["Bihar", "Uttar Pradesh", "Chhattisgarh", "Odisha", "West Bengal"] },
    "West Bengal": { x: 58, y: 48, connections: ["Bihar", "Jharkhand", "Odisha", "Sikkim", "Assam"] },
    "Sikkim": { x: 62, y: 32, connections: ["West Bengal", "Assam"] },
    "Assam": { x: 70, y: 36, connections: ["Sikkim", "West Bengal", "Meghalaya", "Arunachal Pradesh", "Nagaland", "Manipur"] },
    "Arunachal Pradesh": { x: 78, y: 28, connections: ["Assam", "Nagaland"] },
    "Nagaland": { x: 76, y: 40, connections: ["Arunachal Pradesh", "Assam", "Manipur"] },
    "Manipur": { x: 74, y: 46, connections: ["Nagaland", "Assam", "Mizoram"] },
    "Mizoram": { x: 70, y: 52, connections: ["Manipur", "Assam", "Tripura"] },
    "Tripura": { x: 64, y: 54, connections: ["Mizoram", "Assam", "Meghalaya"] },
    "Meghalaya": { x: 66, y: 44, connections: ["Assam", "Tripura"] },

    // Central
    "Rajasthan": { x: 20, y: 38, connections: ["Punjab", "Haryana", "Uttar Pradesh", "Madhya Pradesh", "Gujarat"] },
    "Madhya Pradesh": { x: 36, y: 48, connections: ["Rajasthan", "Uttar Pradesh", "Chhattisgarh", "Maharashtra", "Gujarat"] },
    "Chhattisgarh": { x: 46, y: 52, connections: ["Uttar Pradesh", "Madhya Pradesh", "Maharashtra", "Odisha", "Jharkhand"] },
    "Odisha": { x: 54, y: 58, connections: ["Jharkhand", "Chhattisgarh", "West Bengal", "Andhra Pradesh"] },

    // West
    "Gujarat": { x: 16, y: 50, connections: ["Rajasthan", "Madhya Pradesh", "Maharashtra", "Dadra and Nagar Haveli and Daman and Diu"] },
    "Maharashtra": { x: 28, y: 58, connections: ["Gujarat", "Madhya Pradesh", "Chhattisgarh", "Telangana", "Karnataka", "Goa"] },
    "Goa": { x: 22, y: 72, connections: ["Maharashtra", "Karnataka"] },
    "Dadra and Nagar Haveli and Daman and Diu": { x: 18, y: 62, connections: ["Gujarat", "Maharashtra"] },

    // South
    "Karnataka": { x: 26, y: 72, connections: ["Goa", "Maharashtra", "Telangana", "Andhra Pradesh", "Kerala", "Tamil Nadu"] },
    "Andhra Pradesh": { x: 38, y: 70, connections: ["Odisha", "Telangana", "Karnataka", "Tamil Nadu"] },
    "Telangana": { x: 34, y: 64, connections: ["Maharashtra", "Chhattisgarh", "Andhra Pradesh", "Karnataka"] },
    "Tamil Nadu": { x: 34, y: 82, connections: ["Andhra Pradesh", "Karnataka", "Kerala", "Puducherry"] },
    "Kerala": { x: 26, y: 86, connections: ["Karnataka", "Tamil Nadu", "Lakshadweep"] },
    "Puducherry": { x: 38, y: 78, connections: ["Tamil Nadu"] },

    // Islands
    "Andaman and Nicobar Islands": { x: 82, y: 78, connections: [] },
    "Lakshadweep": { x: 14, y: 82, connections: ["Kerala"] },
};

// Get node color based on absolute count thresholds
function getNodeColor(count) {
    if (count === 0) return "#64748b";
    if (count >= 40) return "#fbbf24"; // Gold (High)
    if (count >= 20) return "#60a5fa"; // Blue (Medium)
    if (count >= 10) return "#a78bfa"; // Purple (Low)
    return "#34d399"; // Green (Few)
}

// Get node size based on count
function getNodeSize(count) {
    const base = 24;
    if (count === 0) return base;
    if (count >= 40) return 48;
    if (count >= 20) return 40;
    if (count >= 10) return 32;
    return 28;
}

// Get glow intensity
function getGlowIntensity(count) {
    if (count === 0) return "0 0 20px rgba(100, 116, 139, 0.4)";
    if (count >= 40) return "0 0 40px rgba(251, 191, 36, 0.8), 0 0 80px rgba(251, 191, 36, 0.4)";
    if (count >= 20) return "0 0 35px rgba(96, 165, 250, 0.7), 0 0 70px rgba(96, 165, 250, 0.3)";
    if (count >= 10) return "0 0 30px rgba(167, 139, 250, 0.6), 0 0 60px rgba(167, 139, 250, 0.2)";
    return "0 0 25px rgba(52, 211, 153, 0.5), 0 0 50px rgba(52, 211, 153, 0.2)";
}

// Screen width detection for mobile fallback
const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
    const checkMobile = () => {
        setIsMobile(window.innerWidth < 900);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
}, []);

// ... (keep existing imports and STATE_NODES) ...

// Import the new list component
import MobileMapList from "./MobileMapList";

// ... (keep existing helper functions and component logic) ...

return (
    <div className="constellation-page">
        <Container>
            {/* Header */}
            <header className="constellation-header header-fade-in">
                <h1 className="constellation-title">
                    <span className="title-glow">Strategic</span> India Map
                </h1>
                <p className="constellation-subtitle">
                    {totalStats.colleges}+ colleges across {totalStats.states} states & {totalStats.uts} UTs
                </p>
            </header>

            {/* Main Map Area */}
            <div className="constellation-layout">
                {isMobile ? (
                    <MobileMapList
                        stateStats={stateStats}
                        onStateClick={handleStateClick}
                    />
                ) : (
                    <>
                        {/* Constellation Map */}
                        <div className="constellation-map-container map-fade-in">
                            <div className="constellation-map">
                                {/* Connection Lines */}
                                <svg className="connections-layer">
                                    {connections.map((conn, i) => {
                                        const isActive = activeState &&
                                            (conn.from === activeState || conn.to === activeState);

                                        return (
                                            <line
                                                key={`${conn.from}-${conn.to}`}
                                                x1={`${conn.x1}%`}
                                                y1={`${conn.y1}%`}
                                                x2={`${conn.x2}%`}
                                                y2={`${conn.y2}%`}
                                                stroke={isActive ? "url(#activeGradient)" : "url(#lineGradient)"}
                                                strokeWidth={isActive ? 3 : 1}
                                                strokeOpacity={isActive ? 1 : 0.3}
                                                className="connection-line"
                                            />
                                        );
                                    })}
                                    <defs>
                                        <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.2" />
                                            <stop offset="50%" stopColor="#7c3aed" stopOpacity="0.4" />
                                            <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.2" />
                                        </linearGradient>
                                        <linearGradient id="activeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" stopColor="#fbbf24" stopOpacity="1" />
                                            <stop offset="50%" stopColor="#f59e0b" stopOpacity="1" />
                                            <stop offset="100%" stopColor="#fbbf24" stopOpacity="1" />
                                        </linearGradient>
                                    </defs>
                                </svg>

                                {/* State Nodes */}
                                {Object.entries(STATE_NODES).map(([stateName, node], index) => {
                                    const count = stateStats[stateName] || 0;
                                    const isHovered = hoveredState === stateName;
                                    const isSelected = selectedState === stateName;
                                    const isActive = isHovered || isSelected;
                                    const size = getNodeSize(count);
                                    const color = getNodeColor(count);
                                    const glow = getGlowIntensity(count);

                                    return (
                                        <div
                                            key={stateName}
                                            className={`state-node ${isActive ? "active" : ""} ${count === 0 ? "empty" : ""}`}
                                            style={{
                                                left: `${node.x}%`,
                                                top: `${node.y}%`,
                                                width: size,
                                                height: size,
                                                backgroundColor: color,
                                                boxShadow: glow,
                                                transform: isActive ? 'scale(1.3)' : 'scale(1)',
                                            }}
                                            onMouseEnter={() => setHoveredState(stateName)}
                                            onMouseLeave={() => setHoveredState(null)}
                                            onClick={() => handleStateClick(stateName)}
                                        >
                                            {/* Inner pulse */}
                                            <div className="node-pulse" />

                                            {/* Count badge */}
                                            {count > 0 && (
                                                <span className="node-count">{count}</span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Info Panel - Fixed position, no cutoff issues */}
                        {activeData && (
                            <div
                                key={activeData.name}
                                className="info-panel info-panel-slide-in"
                            >
                                <div className="panel-header">
                                    <h3 className="panel-title">{activeData.name}</h3>
                                    <div
                                        className="panel-indicator"
                                        style={{ backgroundColor: getNodeColor(activeData.count) }}
                                    />
                                </div>

                                <div className="panel-stats">
                                    <div className="stat-item">
                                        <span className="stat-value">{activeData.count}</span>
                                        <span className="stat-label">Colleges</span>
                                    </div>
                                    <div className="stat-item">
                                        <span className="stat-value">{activeData.connections.length}</span>
                                        <span className="stat-label">Neighbors</span>
                                    </div>
                                </div>

                                {activeData.connections.length > 0 && (
                                    <div className="panel-connections">
                                        <span className="connections-label">Connected to:</span>
                                        <div className="connections-list">
                                            {activeData.connections.map(conn => (
                                                <span key={conn} className="connection-tag">{conn}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <button className="explore-btn" onClick={() => handleStateClick(activeData.name)}>
                                    Explore Colleges →
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Legend */}
            <div className="constellation-legend legend-fade-in">
                <div className="legend-title">College Density</div>
                <div className="legend-nodes">
                    <div className="legend-node">
                        <span className="node-dot" style={{ background: "#fbbf24", boxShadow: "0 0 20px #fbbf24" }}></span>
                        <span>High (40+)</span>
                    </div>
                    <div className="legend-node">
                        <span className="node-dot" style={{ background: "#60a5fa", boxShadow: "0 0 20px #60a5fa" }}></span>
                        <span>Medium (20-40)</span>
                    </div>
                    <div className="legend-node">
                        <span className="node-dot" style={{ background: "#a78bfa", boxShadow: "0 0 20px #a78bfa" }}></span>
                        <span>Low (10-20)</span>
                    </div>
                    <div className="legend-node">
                        <span className="node-dot" style={{ background: "#34d399", boxShadow: "0 0 20px #34d399" }}></span>
                        <span>Few (1-10)</span>
                    </div>
                    <div className="legend-node">
                        <span className="node-dot" style={{ background: "#64748b", boxShadow: "0 0 20px #64748b" }}></span>
                        <span>None</span>
                    </div>
                </div>
            </div>
        </Container >
    </div >
);
}
