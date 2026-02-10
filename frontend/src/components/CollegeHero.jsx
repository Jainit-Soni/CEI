import React from 'react';
import Button from './Button';
import TrustBadge from './TrustBadge';
import AddToChoiceButton from './AddToChoiceButton';
import './CollegeHero.css';

export default function CollegeHero({ college }) {
    if (!college) return null;

    // Fallback gradient if no image (using consistent brand colors)
    // In a real app, we'd map college IDs to specific cover images

    return (
        <div className="cinematic-hero">
            <div className="cinematic-bg">
                <div className="cinematic-orb orb-1"></div>
                <div className="cinematic-orb orb-2"></div>
                <div className="cinematic-grid"></div>
            </div>

            <div className="cinematic-content">
                <div className="hero-container">
                    <div className="hero-badge-row">
                        <Button href="/colleges" variant="ghost" size="sm" className="hero-back-btn">
                            ← Back
                        </Button>
                        <TrustBadge
                            source={college.source}
                            lastUpdated={college.lastUpdated}
                            type="data"
                        />
                    </div>

                    <div className="hero-main">
                        <div className="hero-brand">
                            {college.logo ? (
                                <img src={college.logo} alt={`${college.name} Logo`} className="hero-logo" />
                            ) : (
                                <div className="hero-logo-placeholder">
                                    {college.shortName ? college.shortName.substring(0, 2) : "C"}
                                </div>
                            )}
                            <div className="hero-text">
                                <h1 className="hero-title">{college.name}</h1>
                                <p className="hero-subtitle">
                                    {college.location} • {college.rankingTier || "Unranked"}
                                </p>
                            </div>
                        </div>

                        <div className="hero-actions">
                            <AddToChoiceButton college={college} />

                            {college.officialUrl && (
                                <a
                                    href={college.officialUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="official-link-btn"
                                >
                                    Visit Official Website
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
