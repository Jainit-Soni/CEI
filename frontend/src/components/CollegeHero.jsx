import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, MapPin, ExternalLink } from 'lucide-react';
import Button from './Button';
import TrustBadge from './TrustBadge';
import AddToChoiceButton from './AddToChoiceButton';
import PredictionBadge from './PredictionBadge';
import FitBadge from './FitBadge';
import './CollegeHero.css';
import ScrollReveal from './animations/ScrollReveal';
import { postActivityPing, fetchLiveActivity } from '@/lib/api';

export default function CollegeHero({ college }) {
    const [liveViewers, setLiveViewers] = useState(0);

    useEffect(() => {
        if (!college?._id && !college?.id) return;
        const collegeId = college._id || college.id;
        postActivityPing(collegeId).catch(err => console.error("Ping failed", err));
        fetchLiveActivity(collegeId)
            .then(data => { if (data.viewers > 0) setLiveViewers(data.viewers); })
            .catch(err => console.error("Stats failed", err));
    }, [college]);

    if (!college) return null;

    // Metadata Sanitization & Trust Filter
    const sanitize = (val) => {
        if (!val) return null;
        const upper = val.toUpperCase();
        if (upper === 'NOT APPLICABLE' || upper === 'NULL' || upper === 'NOT AVAILABLE' || upper === 'PENDING') return null;
        return val;
    };

    const cleanLocation = sanitize(college.location);
    const cleanUniversity = sanitize(college.university);
    const cleanType = sanitize(college.ownership || college.type);

    // Filter meaningful metrics for the light intelligence row
    const quickIntel = [
        { label: 'Avg Package', value: college.placements?.averagePackage, icon: '💰' },
        { label: 'Annual Fees', value: college.tuition, icon: '📜' },
        { label: 'Ranking', value: college.rankingTier || college.nirfRanking, icon: '🏆' }
    ].filter(m => m.value && sanitize(m.value));

    return (
        <section className="cei-hero-v5">
            <div className="hero-shell-v5">
                <div className="hero-core-v5">
                    <div className="hero-logo-v5">
                        {college.logo ? (
                            <img src={college.logo} alt={college.name} className="logo-img" />
                        ) : (
                            <div className="logo-placeholder-v5">
                                <span className="logo-icon">🏛️</span>
                            </div>
                        )}
                    </div>
                    
                    <div className="hero-info-v5">
                        {cleanLocation && (
                            <div className="location-strip-v5">
                                <MapPin size={14} className="pin-v5" />
                                <span className="loc-text-v5">{cleanLocation}</span>
                                <a 
                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${college.name} ${cleanLocation}`)}`}
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="maps-action-v5"
                                >
                                    Open in Maps <ExternalLink size={12} />
                                </a>
                            </div>
                        )}
                        
                        <h1 className="hero-name-v5">{college.name}</h1>
                        
                        <div className="hero-signals-v5">
                            {cleanUniversity && (
                                <span className="h-sig univ-v5">{cleanUniversity}</span>
                            )}
                            {college.courses?.length > 0 && (
                                <span className="h-sig"><strong>{college.courses.length}</strong> Programs</span>
                            )}
                            {college.officialUrl && college.officialUrl !== "Not Available" && (
                                <a href={college.officialUrl} target="_blank" rel="noopener noreferrer" className="h-sig s-ver hover:opacity-80 transition-opacity flex items-center gap-1">
                                    Official Hub <ExternalLink size={10} />
                                </a>
                            )}
                            {cleanType && (
                                <span className="h-sig s-type">{cleanType}</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="hero-score-v5">
                    {college.ceiScore && college.ceiScore > 0 ? (
                        <Link href="/methodology" className="sf-metric green-metric tooltip group cursor-pointer">
                            <span className="tooltiptext text-xs text-left p-3 w-64 bg-slate-900 leading-relaxed shadow-xl border border-slate-700">
                                <strong>How is this calculated?</strong><br/><br/>
                                This AI score is derived mathematically. It does not reflect a legal endorsement. Click to view the open-source Algorithm Methodology.
                            </span>
                            <div className="sf-value group-hover:text-emerald-300 transition-colors">{Number(college.ceiScore).toFixed(2)}</div>
                            <div className="sf-label flex items-center justify-center gap-1">
                                CEI SCORE <Info size={10} className="opacity-50" />
                            </div>
                        </Link>
                    ) : (
                        <div className="score-status-v5">
                            <div className="ss-label">INSTITUTION STATUS</div>
                            <div className="ss-value">Vetted</div>
                            <div className="ss-hint">Score calculation in progress</div>
                        </div>
                    )}
                </div>
            </div>

            <div className="hero-tray-v5">
                <div className="tray-metrics-v5">
                    {quickIntel.map((m, i) => (
                        <div key={i} className="tm-unit-v5">
                            <span className="tm-lab-v5">{m.label}</span>
                            <span className="tm-val-v5">{m.value}</span>
                        </div>
                    ))}
                </div>

                <div className="tray-actions-v5">
                    <AddToChoiceButton college={college} className="btn-choice-v5" />
                    {college.officialUrl && college.officialUrl !== "Not Available" && (
                        <a href={college.officialUrl} target="_blank" rel="noopener noreferrer" className="btn-portal-v5">
                            <span>Portal</span>
                            <ExternalLink size={14} />
                        </a>
                    )}
                    {liveViewers > 0 && (
                        <div className="live-stat-v5">
                            <span className="live-point-v5"></span>
                            {liveViewers} Analyzing Now
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
