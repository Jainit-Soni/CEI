import React, { useState, useEffect } from 'react';
import Button from './Button';
import TrustBadge from './TrustBadge';
import AddToChoiceButton from './AddToChoiceButton';
import PredictionBadge from './PredictionBadge';
import './CollegeHero.css';
import ScrollReveal from './animations/ScrollReveal';
import { postActivityPing, fetchLiveActivity } from '@/lib/api';

export default function CollegeHero({ college }) {
    const [liveViewers, setLiveViewers] = useState(0);
    // Note: setLiveViewers is called in useEffect, but liveViewers state is not defined in the provided snippet.
    // This might be an oversight or handled elsewhere. Keeping the call as per instruction.
    useEffect(() => {
        if (!college?._id && !college?.id) return;
        const collegeId = college._id || college.id;
        postActivityPing(collegeId).catch(err => console.error("Ping failed", err));
        fetchLiveActivity(collegeId)
            .then(data => { if (data.viewers > 0) setLiveViewers(data.viewers); })
            .catch(err => console.error("Stats failed", err));
    }, [college]);

    if (!college) return null;

    return (
        <div className="terminal-hero">
            <div className="terminal-bg">
                <div className="terminal-mesh"></div>
                <div className="terminal-gradient-orb"></div>
            </div>

            <div className="terminal-content">
                <div className="terminal-container">
                    {/* Top Action Row */}
                    <div className="terminal-top-nav">
                        <Button href="/colleges" variant="ghost" size="sm" className="terminal-back-btn">
                            ← Intelligence Database
                        </Button>
                        <div className="terminal-badges">
                            <PredictionBadge college={college} />
                            <TrustBadge
                                source={college.source}
                                lastUpdated={college.lastUpdated}
                                type="data"
                            />
                        </div>
                    </div>

                    {/* Main Executive Layout */}
                    <div className="terminal-main">
                        <div className="terminal-identity-panel">
                            <div className="terminal-logo-container">
                                {college.logo ? (
                                    <img src={college.logo} alt={`${college.name} Logo`} className="terminal-logo" />
                                ) : (
                                    <div className="terminal-logo-placeholder">
                                        {college.shortName ? college.shortName.substring(0, 2) : "C"}
                                    </div>
                                )}
                            </div>
                            <div className="terminal-identity-text">
                                <h1 className="terminal-title">{college.name}</h1>
                                <a 
                                    href={college.location !== "Not Available" ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(college.name + " " + college.location)}` : "#"}
                                    target={college.location !== "Not Available" ? "_blank" : "_self"}
                                    rel="noopener noreferrer"
                                    className={`terminal-location-link ${college.location === "Not Available" ? "link-disabled" : ""}`}
                                    title={college.location !== "Not Available" ? "View on Google Maps" : "Location Not Available"}
                                    onClick={(e) => college.location === "Not Available" && e.preventDefault()}
                                >
                                    <span className="loc-marker">📍</span>
                                    <span className="loc-text">{college.location}</span>
                                    {college.location !== "Not Available" && (
                                        <svg className="loc-external-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>
                                    )}
                                </a>
                                {college.rankingTier && (
                                    <div className="terminal-tier-row">
                                        <span className="tier-tag">{college.rankingTier}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Intelligence HUD (Right Side Data) */}
                        <div className="terminal-intelligence-hud">
                            <div className="hud-card">
                                <div className="hud-label">AVERAGE PACKAGE</div>
                                <div className={`hud-value ${college.placements?.averagePackage === "Not Available" ? "hud-value-na" : ""}`}>
                                    {college.placements?.averagePackage || "Not Available"}
                                </div>
                                {college.placements?.averagePackage !== "Not Available" && <div className="hud-status status-online"></div>}
                            </div>
                            <div className="hud-card">
                                <div className="hud-label">ESTABLISHED</div>
                                <div className={`hud-value ${college.meta?.establishedYear === "Not Available" ? "hud-value-na" : ""}`}>
                                    {college.meta?.establishedYear || "Not Available"}
                                </div>
                            </div>
                            <div className="hud-card">
                                <div className="hud-label">TUITION (ANNUAL)</div>
                                <div className={`hud-value ${college.tuition === "Not Available" ? "hud-value-na" : ""}`}>
                                    {college.tuition || "Not Available"}
                                </div>
                            </div>
                            <div className="hud-card cei-highlight">
                                <div className="hud-label">CEI SCORE</div>
                                <div className="hud-value">{Math.round(college.ceiScore || 0)}</div>
                                <div className="hud-subvalue">{college.competitivenessBand || "Validated"}</div>
                            </div>
                        </div>
                    </div>

                    {/* Action Hub */}
                    <div className="terminal-actions">
                        <div className="action-cluster">
                            <AddToChoiceButton college={college} className="terminal-add-btn" />
                            {college.officialUrl && college.officialUrl !== "Not Available" && (
                                <a
                                    href={college.officialUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="terminal-official-btn"
                                >
                                    <span>Official Portal</span>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                                        <polyline points="15 3 21 3 21 9"></polyline>
                                        <line x1="10" y1="14" x2="21" y2="3"></line>
                                    </svg>
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
