import React, { useState, useEffect } from 'react';
import { fetchCollegeTruthPlacements } from '@/lib/api';
import SectionTrustSummary from '../Truth/SectionTrustSummary';
import SourcePopover from '../Truth/SourcePopover';
import GlassPanel from '../GlassPanel';
import './TruthPlacementsSection.css';

/**
 * TruthPlacementsSection.jsx — Phase 80.7 Implementation
 * ====================================================
 * High-fidelity Truth-Grade Placements section.
 */
export default function TruthPlacementsSection({ collegeId }) {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!collegeId) return;

        const load = async () => {
            try {
                setIsLoading(true);
                const result = await fetchCollegeTruthPlacements(collegeId);
                setData(result);
            } catch (err) {
                if (err.response?.status !== 404) {
                    console.error("Failed to load truth placements", err);
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
                Loading Evaluated Placement Metrics...
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

    if (!data || data.sectionStatus === 'official_data_unavailable') {
        return (
            <GlassPanel className="truth-empty-state">
                <div className="te-icon">💼</div>
                <h3 className="te-title">Official placement data unavailable</h3>
                <p className="te-desc">No current evaluated official source is linked for institutional placement outcomes.</p>
            </GlassPanel>
        );
    }

    const formatMetricValue = (value, type, unit, currency = 'INR') => {
        if (type === 'Placement Rate' || unit === '%') {
            return `${value}%`;
        }

        if (unit === 'LPA' || unit === 'Lakh') {
            return `₹${value} LPA`;
        }

        if (unit === 'CR' || unit === 'Cr') {
            return `₹${value} Cr`;
        }
        
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: currency,
            maximumFractionDigits: 0
        }).format(value).replace(/₹/g, '₹');
    };

    // Helper to get icon for metric
    const getMetricIcon = (type) => {
        if (type.includes('Highest')) return '🚀';
        if (type.includes('Average')) return '📊';
        if (type.includes('Median')) return '🎯';
        if (type.includes('Rate')) return '📈';
        return '📑';
    };

    return (
        <div className="truth-placements-section fade-in">
            <SectionTrustSummary 
                status={data.sectionStatus}
                freshnessStatus={data.freshnessStatus}
                primarySource={data.primarySource}
                lastEvaluatedAt={data.lastEvaluatedAt}
            />

            <div className="metrics-grid">
                {(data.items || []).map((item, idx) => (
                    <div key={idx} className={`metric-card ${item.metricType.toLowerCase().replace(/\s+/g, '-')}`}>
                        <div className="mc-header">
                            <span className="mc-icon">{getMetricIcon(item.metricType)}</span>
                            <span className="mc-label">{item.displayLabel || item.metricType}</span>
                        </div>
                        
                        <div className="mc-value-box">
                            <span className="mc-value">
                                {item.metricType === 'Placement Rate' 
                                    ? `${item.value}%` 
                                    : formatMetricValue(item.value, item.metricType, item.unit, item.currency)}
                            </span>
                            {item.applicableBatchYear && (
                                <span className="mc-year">Batch {item.applicableBatchYear}</span>
                            )}
                        </div>

                        <div className="mc-footer">
                            <div className="mc-canonical">
                                {item.localMetricLabel && item.localMetricLabel !== item.metricType && (
                                    <span className="mc-hint">As reported: {item.localMetricLabel}</span>
                                )}
                            </div>
                            <SourcePopover source={item.source}>
                                <span className="mc-info-trigger">Source Provenance ⓘ</span>
                            </SourcePopover>
                        </div>

                        {item.freshness?.status === 'stale' && (
                            <div className="item-stale-badge">Stale</div>
                        )}
                    </div>
                ))}
            </div>

            {data.hasConflict && (
                <div className="truth-section-disclaimer">
                    ⚠️ Conflicting placement data detected. Displaying deterministic primary source data.
                </div>
            )}
        </div>
    );
}
