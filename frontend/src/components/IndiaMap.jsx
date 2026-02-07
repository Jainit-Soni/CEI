"use client";

import { useState, useEffect } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
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

    const maxCount = Math.max(...Object.values(stats), 1);
    const colorScale = scaleLinear()
        .domain([0, maxCount])
        .range(["#E0E7FF", "#4F46E5"]);

    const getStateCount = (stateName) => {
        if (!stateName) return 0;
        // Try different name formats
        const normalized = stateName.toLowerCase().replace(/\s+/g, "");
        const withSpaces = stateName.toLowerCase();
        const withDashes = stateName.toLowerCase().replace(/\s+/g, "-");

        return (
            stats[normalized] ||
            stats[withSpaces] ||
            stats[withDashes] ||
            stats[stateName] ||
            0
        );
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
        const count = getStateCount(stateName);
        setHoveredState({ name: stateName, count });
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
                <Geographies geography={geoData}>
                    {({ geographies }) =>
                        geographies.map((geo) => {
                            const stateName = geo.properties.NAME_1 || geo.properties.name;
                            const count = getStateCount(stateName);

                            return (
                                <Geography
                                    key={geo.rsmKey || geo.properties.ID_1}
                                    geography={geo}
                                    onMouseEnter={() => handleMouseEnter(geo)}
                                    onMouseLeave={() => setHoveredState(null)}
                                    onClick={() => handleStateClick(geo)}
                                    style={{
                                        default: {
                                            fill: count > 0 ? colorScale(count) : "#F1F5F9",
                                            stroke: "#64748B",
                                            strokeWidth: 0.5,
                                            outline: "none",
                                            transition: "all 0.3s ease",
                                        },
                                        hover: {
                                            fill: "#4F46E5",
                                            stroke: "#3730A3",
                                            strokeWidth: 1.5,
                                            outline: "none",
                                            cursor: "pointer",
                                        },
                                        pressed: {
                                            fill: "#3730A3",
                                            outline: "none",
                                        },
                                    }}
                                />
                            );
                        })
                    }
                </Geographies>
            </ComposableMap>

            {/* Floating Tooltip */}
            {hoveredState && (
                <div
                    className="map-tooltip"
                    style={{
                        position: "fixed",
                        left: `${tooltipPos.x + 15}px`,
                        top: `${tooltipPos.y - 60}px`,
                        zIndex: 1000,
                    }}
                >
                    <div className="tooltip-content">
                        <span className="tooltip-title">{hoveredState.name}</span>
                        <span className="tooltip-count">{hoveredState.count} Colleges</span>
                    </div>
                </div>
            )}
        </div>
    );
}
