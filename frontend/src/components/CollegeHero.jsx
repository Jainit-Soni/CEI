import React, { useState, useEffect } from 'react';
import Button from './Button';
import TrustBadge from './TrustBadge';
import AddToChoiceButton from './AddToChoiceButton';
import PredictionBadge from './PredictionBadge';
import { Users } from 'lucide-react';
import './CollegeHero.css';
import ScrollReveal from './animations/ScrollReveal';
import { postActivityPing, fetchLiveActivity } from '@/lib/api';

export default function CollegeHero({ college }) {
    const [liveViewers, setLiveViewers] = useState(0);

    useEffect(() => {
        if (!college?._id && !college?.id) return;

        const collegeId = college._id || college.id;

        // 1. Log the view
        postActivityPing(collegeId).catch(err => console.error("Ping failed", err));

        // 2. Fetch stats
        fetchLiveActivity(collegeId)
            .then(data => {
                if (data.viewers > 0) setLiveViewers(data.viewers);
            })
            .catch(err => console.error("Stats failed", err));

    }, [college]);

    if (!college) return null;

    return (
        <div className="cinematic-hero">
            <div className="cinematic-bg">
                <div className="cinematic-orb orb-1"></div>
                <div className="cinematic-orb orb-2"></div>
                <div className="cinematic-grid"></div>
            </div>

            <div className="cinematic-content">
                <div className="hero-container">
                    <div className="hero-badge-row gap-4 mb-3">
                        <Button href="/colleges" variant="ghost" size="sm" className="hero-back-btn">
                            ← Back
                        </Button>
                        <PredictionBadge college={college} />

                        {college.ceiScore > 0 && (
                            <div className="live-pulse-badge" style={{ background: 'linear-gradient(135deg, #111827, #374151)', color: '#fbbf24', border: '1px solid #4b5563', padding: '6px 14px', borderRadius: '16px', fontWeight: 'bold' }}>
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none" className="mr-1" style={{ display: 'inline', marginBottom: '2px' }}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                                {Math.round(college.ceiScore)} CEI Score ({college.competitivenessBand || 'Evaluated'})
                            </div>
                        )}

                        {liveViewers > 1 && (
                            <div className="live-pulse-badge">
                                <span className="pulse-dot"></span>
                                <Users size={12} className="mr-1" />
                                {liveViewers} viewing now
                            </div>
                        )}

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
                                <ScrollReveal as="h1" containerClassName="hero-title" baseRotation={1} blurStrength={4}>
                                    {college.name}
                                </ScrollReveal>
                                <ScrollReveal as="p" containerClassName="hero-subtitle" baseOpacity={0.3} blurStrength={2}>
                                    {college.location} • {college.rankingTier || "Unranked"}
                                </ScrollReveal>
                            </div>
                        </div>

                        <div className="hero-actions gap-4">
                            <AddToChoiceButton college={college} />

                            {college.officialUrl && (
                                <a
                                    href={college.officialUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="official-link-btn ml-3"
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
