import React, { useState, useEffect } from 'react';
import { fetchCollegeTruthFees } from '@/lib/api';
import SectionTrustSummary from '../Truth/SectionTrustSummary';
import SourcePopover from '../Truth/SourcePopover';
import GlassPanel from '../GlassPanel';
import './TruthPlacementsSection.css'; // Reusing placement styles for consistency or create TruthFeesSection.css

/**
 * TruthFeesSection.jsx
 * ====================
 * High-fidelity Truth-Grade Fees section.
 */
export default function TruthFeesSection({ collegeId }) {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!collegeId) return;

        const load = async () => {
            try {
                setIsLoading(true);
                const result = await fetchCollegeTruthFees(collegeId);
                setData(result);
            } catch (err) {
                if (err.response?.status !== 404) {
                    console.error("Failed to load truth fees", err);
                    setError("Unable to connect to truth engine.");
                } else {
                    setData({ sectionStatus: 'official_data_unavailable' });
                }
            } finally {
                setIsLoading(false);
            }
        };

        load();
    }, [collegeId]);

    if (isLoading) {
        return (
            <div className="truth-section-loading">
                <span className="spinner"></span>
                Loading Evaluated Fee Metrics...
            </div>
        );
    }

    if (error) {
        return (
            <GlassPanel className="truth-error-state">
                <div className="te-icon">⚠️</div>
                <div className="te-text">{error}</div>
            </GlassPanel>
        );
    }

    if (!data || data.sectionStatus === 'official_data_unavailable' || !data.items || data.items.length === 0) {
        return (
            <GlassPanel className="truth-empty-state">
                <div className="te-icon">💰</div>
                <h3 className="te-title">Official fee data unavailable</h3>
                <p className="te-desc">No current evaluated official source is linked for institutional fee structures.</p>
            </GlassPanel>
        );
    }

    // Helper to get icon for fee type
    const getFeeIcon = (type) => {
        if (type.includes('Tuition')) return '🏫';
        if (type.includes('Hostel')) return '🏠';
        if (type.includes('Caution')) return '🛡️';
        if (type.includes('Total')) return '💰';
        return '📑';
    };

    return (
        <div className="truth-fees-section fade-in">
            <SectionTrustSummary 
                status={data.sectionStatus}
                freshnessStatus={data.freshnessStatus}
                primarySource={data.primarySource}
                lastEvaluatedAt={data.lastEvaluatedAt}
            />

            <div className="metrics-grid">
                {data.items.map((item, idx) => (
                    <div key={idx} className={`metric-card fee-card ${item.feeType ? item.feeType.toLowerCase().replace(/\s+/g, '-') : 'general'}`}>
                        <div className="mc-header">
                            <span className="mc-icon">{getFeeIcon(item.feeType || item.displayLabel || '')}</span>
                            <span className="mc-label">{item.displayLabel || item.feeType}</span>
                        </div>
                        
                        <div className="mc-value-box">
                            <span className="mc-value">
                                {typeof item.value === 'number' ? `₹${item.value.toLocaleString('en-IN')}` : item.value}
                            </span>
                            {item.academicYear && (
                                <span className="mc-year">AY {item.academicYear}</span>
                            )}
                        </div>

                        <div className="mc-footer">
                            <div className="mc-canonical">
                                {item.category && (
                                    <span className="mc-hint">Category: {item.category}</span>
                                )}
                            </div>
                            <SourcePopover source={item.source}>
                                <span className="mc-info-trigger">Source Provenance ⓘ</span>
                            </SourcePopover>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
