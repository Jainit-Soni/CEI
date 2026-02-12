"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import "./map.css";

// Region grouping for visual organization
const REGIONS = {
    "Northern India": ["Delhi", "Haryana", "Himachal Pradesh", "Jammu and Kashmir", "Ladakh", "Punjab", "Rajasthan", "Uttarakhand", "Uttar Pradesh", "Chandigarh"],
    "Southern India": ["Andhra Pradesh", "Karnataka", "Kerala", "Tamil Nadu", "Telangana", "Puducherry"],
    "Eastern India": ["Bihar", "Jharkhand", "Odisha", "West Bengal", "Sikkim"],
    "Western India": ["Gujarat", "Maharashtra", "Goa", "Dadra and Nagar Haveli and Daman and Diu"],
    "Central India": ["Madhya Pradesh", "Chhattisgarh"],
    "North-East": ["Assam", "Arunachal Pradesh", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Tripura"],
    "Islands": ["Andaman and Nicobar Islands", "Lakshadweep"],
};

const REGION_ICONS = {
    "Northern India": "🏔️",
    "Southern India": "🌴",
    "Eastern India": "🌊",
    "Western India": "🏙️",
    "Central India": "🌿",
    "North-East": "⛰️",
    "Islands": "🏝️",
};

const REGION_GRADIENTS = {
    "Northern India": "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    "Southern India": "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
    "Eastern India": "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
    "Western India": "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
    "Central India": "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
    "North-East": "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
    "Islands": "linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)",
};

// Get tier color
function getTierColor(count) {
    if (count === 0) return { bg: "rgba(148, 163, 184, 0.1)", text: "#94a3b8", glow: "none", tier: "—" };
    if (count >= 40) return { bg: "rgba(251, 191, 36, 0.12)", text: "#f59e0b", glow: "0 0 20px rgba(251, 191, 36, 0.3)", tier: "🔥" };
    if (count >= 20) return { bg: "rgba(96, 165, 250, 0.12)", text: "#3b82f6", glow: "0 0 15px rgba(96, 165, 250, 0.2)", tier: "⭐" };
    if (count >= 10) return { bg: "rgba(167, 139, 250, 0.12)", text: "#8b5cf6", glow: "0 0 12px rgba(167, 139, 250, 0.2)", tier: "✦" };
    return { bg: "rgba(52, 211, 153, 0.1)", text: "#10b981", glow: "0 0 10px rgba(52, 211, 153, 0.15)", tier: "·" };
}

export default function MobileMapList({ stateStats, totalStats, onStateClick }) {
    const router = useRouter();
    const [expandedRegion, setExpandedRegion] = useState("Northern India");

    // Build region data with counts
    const regionData = useMemo(() => {
        return Object.entries(REGIONS).map(([region, states]) => {
            const statesWithData = states.map(name => {
                const st = stateStats[name];
                const count = typeof st === 'object' ? (st.count || 0) : (st || 0);
                const topColleges = typeof st === 'object' ? (st.topColleges || []) : [];
                return { name, count, topColleges };
            }).sort((a, b) => b.count - a.count);

            const totalCount = statesWithData.reduce((sum, s) => sum + s.count, 0);
            return { region, states: statesWithData, totalCount };
        }).sort((a, b) => b.totalCount - a.totalCount);
    }, [stateStats]);

    // Top 5 states across all regions
    const topStates = useMemo(() => {
        return Object.entries(stateStats)
            .map(([name, data]) => ({
                name,
                count: typeof data === 'object' ? (data.count || 0) : (data || 0),
                topColleges: typeof data === 'object' ? (data.topColleges || []) : [],
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }, [stateStats]);

    const handleNavigate = (stateName) => {
        router.push(`/colleges?state=${stateName}`);
    };

    return (
        <div className="mobile-map-v3">
            {/* Spotlight: Top 5 States */}
            <section className="map-spotlight">
                <div className="spotlight-header">
                    <span className="spotlight-badge">🏆 TOP STATES</span>
                    <h3>Education Powerhouses</h3>
                </div>
                <div className="spotlight-scroll">
                    {topStates.map((state, i) => {
                        const tier = getTierColor(state.count);
                        return (
                            <button
                                key={state.name}
                                className="spotlight-card"
                                onClick={() => handleNavigate(state.name)}
                                style={{ '--card-glow': tier.glow }}
                            >
                                <div className="spotlight-rank">#{i + 1}</div>
                                <div className="spotlight-count" style={{ color: tier.text }}>{state.count}</div>
                                <div className="spotlight-name">{state.name}</div>
                                {state.topColleges?.length > 0 && (
                                    <div className="spotlight-colleges">
                                        {state.topColleges.slice(0, 2).map((c, j) => (
                                            <span key={j} className="spotlight-college-tag">{c}</span>
                                        ))}
                                    </div>
                                )}
                                <div className="spotlight-cta">Explore →</div>
                            </button>
                        );
                    })}
                </div>
            </section>

            {/* Region Accordion */}
            <section className="map-regions">
                <div className="regions-header">
                    <span className="spotlight-badge">🗺️ BY REGION</span>
                    <h3>Explore by Geography</h3>
                </div>

                {regionData.map(({ region, states, totalCount }) => {
                    const isExpanded = expandedRegion === region;
                    return (
                        <div key={region} className={`region-block ${isExpanded ? "expanded" : ""}`}>
                            <button
                                className="region-header-btn"
                                onClick={() => setExpandedRegion(isExpanded ? null : region)}
                            >
                                <div className="region-left">
                                    <span className="region-icon">{REGION_ICONS[region]}</span>
                                    <div>
                                        <span className="region-name">{region}</span>
                                        <span className="region-meta">{states.length} states · {totalCount} colleges</span>
                                    </div>
                                </div>
                                <div className="region-right">
                                    <div
                                        className="region-bar"
                                        style={{
                                            background: REGION_GRADIENTS[region],
                                            width: `${Math.min(100, Math.max(20, (totalCount / 3)))}%`
                                        }}
                                    />
                                    <span className={`region-chevron ${isExpanded ? "open" : ""}`}>›</span>
                                </div>
                            </button>

                            {isExpanded && (
                                <div className="region-states">
                                    {states.map(({ name, count }) => {
                                        const tier = getTierColor(count);
                                        return (
                                            <button
                                                key={name}
                                                className="region-state-card"
                                                onClick={() => handleNavigate(name)}
                                            >
                                                <div className="state-dot" style={{ background: tier.text, boxShadow: tier.glow }} />
                                                <span className="state-name">{name}</span>
                                                <span className="state-count" style={{ color: tier.text }}>
                                                    {count}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </section>

            {/* Legend */}
            <div className="mobile-map-legend">
                <div className="legend-row">
                    <span className="legend-dot" style={{ background: "#f59e0b" }} />
                    <span>40+ Colleges</span>
                </div>
                <div className="legend-row">
                    <span className="legend-dot" style={{ background: "#3b82f6" }} />
                    <span>20-39</span>
                </div>
                <div className="legend-row">
                    <span className="legend-dot" style={{ background: "#8b5cf6" }} />
                    <span>10-19</span>
                </div>
                <div className="legend-row">
                    <span className="legend-dot" style={{ background: "#10b981" }} />
                    <span>1-9</span>
                </div>
            </div>
        </div>
    );
}
