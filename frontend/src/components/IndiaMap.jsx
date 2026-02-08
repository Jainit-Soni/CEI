"use client";

import { useState, useEffect } from "react";
import { ComposableMap, Geographies, Geography, ZoomableGroup } from "react-simple-maps";
import { scaleLinear } from "d3-scale";
import { useRouter } from "next/navigation";
import "./IndiaMap.css";

// URL to the real India GeoJSON file
const INDIA_GEO_URL = "/india-geo.json";

export default function IndiaMap({ stats = {}, onStateClick }) {
    const router = useRouter();
    const [hoveredState, setHoveredState] = useState(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
    const [geoData, setGeoData] = useState(null);

    // Load real GeoJSON data
    useEffect(() => {
        fetch(INDIA_GEO_URL)
            .then((res) => res.json())
            .then((data) => setGeoData(data))
            .catch((err) => console.error("Failed to load GeoJSON:", err));
    }, []);

    // Extract counts safely for color scale
    const counts = Object.values(stats).map(s => (typeof s === 'object' ? s.count : s) || 0);
    const maxCount = Math.max(...counts, 1);

    const colorScale = scaleLinear()
        .domain([0, maxCount])
        .range(["#E0E7FF", "#4F46E5"]);

    const getStateStats = (stateName) => {
        if (!stateName) return { count: 0, topColleges: [] };

        // Try different name formats
        const normalized = stateName.toLowerCase().replace(/\s+/g, "");
        const withSpaces = stateName.toLowerCase();
        const withDashes = stateName.toLowerCase().replace(/\s+/g, "-");

        const data = stats[normalized] || stats[withSpaces] || stats[withDashes] || stats[stateName];

        if (!data) return { count: 0, topColleges: [] };

        // Handle backward compatibility (if stats values were just numbers)
        if (typeof data === 'number') return { count: data, topColleges: [] };

        return data; // { count, topColleges }
    };

    const handleStateClick = (geo) => {
        const stateName = geo.properties.NAME_1 || geo.properties.name;
        if (!stateName) return;

        if (onStateClick) {
            onStateClick({ name: stateName });
        } else {
            const stateId = stateName.toLowerCase().replace(/\s+/g, "-");
            router.push(`/colleges?state=${stateId}`);
        }
    };

    const handleMouseEnter = (geo) => {
        const stateName = geo.properties.NAME_1 || geo.properties.name;
        const st = getStateStats(stateName);
        setHoveredState({ name: stateName, ...st });
    };

    const handleMouseMove = (event) => {
        setTooltipPos({ x: event.clientX, y: event.clientY });
    };

    if (!geoData) {
        return (
            <div className="india-map-loading">
                <div className="loading-spinner"></div>
                <p>Loading India Map...</p>
            </div>
        );
    }

    return (
        <div className="india-map-container" onMouseMove={handleMouseMove}>
            <ComposableMap
                projection="geoMercator"
                projectionConfig={{
                    scale: 1200,
                    center: [78, 22],
                }}
                width={1000}
                height={800}
                className="india-geo-map"
            >
                <ZoomableGroup center={[78, 22]} zoom={1} minZoom={1} maxZoom={5}>
                    <Geographies geography={geoData}>
                        {({ geographies }) =>
                            geographies.map((geo) => {
                                const stateName = geo.properties.NAME_1 || geo.properties.name;
                                const { count } = getStateStats(stateName);

                                return (
                                    <Geography
                                        key={geo.rsmKey || geo.properties.ID_1}
                                        geography={geo}
                                        onMouseEnter={() => handleMouseEnter(geo)}
                                        onMouseLeave={() => setHoveredState(null)}
                                        onClick={() => handleStateClick(geo)}
                                        style={{
                                            default: {
                                                fill: count > 0 ? colorScale(count) : "#F8FAFC",
                                                stroke: "#CBD5E1",
                                                strokeWidth: 0.75,
                                                outline: "none",
                                                transition: "all 0.3s ease",
                                            },
                                            hover: {
                                                fill: "#4F46E5",
                                                stroke: "#312E81",
                                                strokeWidth: 2,
                                                outline: "none",
                                                cursor: "pointer",
                                                filter: "drop-shadow(0 4px 6px rgba(0,0,0,0.1))"
                                            },
                                            pressed: {
                                                fill: "#312E81",
                                                outline: "none",
                                            },
                                        }}
                                    />
                                );
                            })
                        }
                    </Geographies>
                </ZoomableGroup>
            </ComposableMap>

            {/* Floating Tooltip */}
            {hoveredState && (
                <div
                    className="map-tooltip"
                    style={{
                        position: "fixed",
                        left: `${tooltipPos.x + 20}px`,
                        top: `${tooltipPos.y - 40}px`,
                        zIndex: 1000,
                        pointerEvents: "none"
                    }}
                >
                    <div className="tooltip-content glass-panel">
                        <div className="tooltip-header">
                            <span className="tooltip-title">{hoveredState.name}</span>
                            <span className="tooltip-badge">{hoveredState.count}</span>
                        </div>
                        {hoveredState.topColleges && hoveredState.topColleges.length > 0 && (
                            <div className="tooltip-colleges">
                                {hoveredState.topColleges.map((c, i) => (
                                    <div key={i} className="tooltip-college-item">• {c}</div>
                                ))}
                                {hoveredState.count > 3 && (
                                    <div className="tooltip-more">+{hoveredState.count - 3} more</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
