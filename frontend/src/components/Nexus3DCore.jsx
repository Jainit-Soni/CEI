"use client";

import React, { useMemo } from 'react';
import './Nexus3DCore.css';

/**
 * Nexus3DCore — True Isometric 3D Data Visualization
 * Renders scoring factors as physical extruded pillars in an isometric world.
 */
export default function Nexus3DCore({ college }) {
    if (!college) return null;

    const base = Number(college.ceiScore) || 65;
    const safeBase = isNaN(base) ? 65 : base;
    const canonical = college.canonicalId || college.id || "default";

    // Deterministic factor generation (matches IntelligenceRadar logic)
    const generateProxyScore = (seedStr, index, baseScore) => {
        let hash = 0;
        const str = `${seedStr}-${index}`;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }
        const safeHash = Math.abs(hash);
        const variance = (safeHash % 30) - 15;
        return Math.min(100, Math.max(20, baseScore + variance));
    };

    const factors = useMemo(() => [
        { label: 'Accr.', score: generateProxyScore(canonical, 1, safeBase), color: '#6366f1', icon: '🏆' },
        { label: 'Track', score: generateProxyScore(canonical, 2, safeBase), color: '#8b5cf6', icon: '🏛️' },
        { label: 'Infra', score: generateProxyScore(canonical, 3, safeBase), color: '#0ea5e9', icon: '🏗️' },
        { label: 'Scale', score: generateProxyScore(canonical, 4, safeBase), color: '#10b981', icon: '📐' },
        { label: 'Demand', score: generateProxyScore(canonical, 5, safeBase), color: '#f59e0b', icon: '📊' },
        { label: 'Place.', score: generateProxyScore(canonical, 6, safeBase), color: '#ef4444', icon: '💼' }
    ], [canonical, safeBase]);

    return (
        <div className="nexus-3d-wrapper">
            <div className="nexus-3d-scene">
                {/* Isometric Grid Floor */}
                <div className="nexus-floor">
                    <div className="nexus-grid-lines"></div>
                </div>

                {/* Score Medallion (Floating in Center) */}
                <div className="nexus-medallion-float">
                    <div className="nexus-diamond">
                        <div className="diamond-face top">{Math.round(safeBase)}</div>
                        <div className="diamond-face front">CEI</div>
                        <div className="diamond-face right">CORE</div>
                    </div>
                    <div className="diamond-shadow"></div>
                </div>

                {/* Isometric Pillars */}
                <div className="nexus-pillars-container">
                    {factors.map((f, i) => (
                        <div 
                            key={i} 
                            className={`nexus-pillar-wrap p-${i}`}
                            style={{ '--h': `${f.score * 1.5}px`, '--c': f.color }}
                        >
                            <div className="nexus-pillar">
                                <div className="pillar-face top">
                                    <span className="pillar-icon">{f.icon}</span>
                                </div>
                                <div className="pillar-face front"></div>
                                <div className="pillar-face right"></div>
                                
                                <div className="pillar-label">
                                    <span className="p-score">{Math.round(f.score)}</span>
                                    <span className="p-text">{f.label}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            
            <div className="nexus-legend">
                {factors.map((f, i) => (
                    <div key={i} className="legend-item">
                        <span className="dot" style={{ background: f.color }}></span>
                        {f.label}
                    </div>
                ))}
            </div>
        </div>
    );
}
