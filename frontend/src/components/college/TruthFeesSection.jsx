import React, { useState, useEffect } from 'react';
import { fetchCollegeTruthFees } from '@/lib/api';
import SectionTrustSummary from '../Truth/SectionTrustSummary';
import SourcePopover from '../Truth/SourcePopover';
import GlassPanel from '../GlassPanel';
import './TruthFeesSection.css';

/**
 * TruthFeesSection.jsx — Phase 80.6 Implementation
 * ===============================================
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
                Loading Evaluated Fee Structure...
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
                <div className="te-icon">💰</div>
                <h3 className="te-title">Official fee data unavailable</h3>
                <p className="te-desc">No current evaluated official source is linked for institutional fees.</p>
            </GlassPanel>
        );
    }

    // Format currency
    const formatPrice = (amount, currency = 'INR') => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: currency,
            maximumFractionDigits: 0
        }).format(amount);
    };

    return (
        <div className="truth-fees-section fade-in">
            <SectionTrustSummary 
                status={data.sectionStatus}
                freshnessStatus={data.freshnessStatus}
                primarySource={data.primarySource}
                lastEvaluatedAt={data.lastEvaluatedAt}
            />

            <div className="fees-grid">
                {(data.items || []).map((item, idx) => (
                    <div key={idx} className="fee-item-card">
                        <div className="fic-header">
                            <span className="fic-type">{item.displayLabel || item.feeType}</span>
                            <span className="fic-period">{item.feePeriod}</span>
                        </div>
                        
                        <div className="fic-amount">
                            {formatPrice(item.amount, item.currency)}
                        </div>

                        <div className="fic-footer">
                            <div className="fic-meta">
                                {item.applicableCategoryCode !== 'GEN' && (
                                    <span className="fic-tag">Category: {item.applicableCategoryCode}</span>
                                )}
                                {item.applicableQuotaCode && item.applicableQuotaCode !== 'AI' && (
                                    <span className="fic-tag">Quota: {item.applicableQuotaCode}</span>
                                )}
                            </div>
                            
                            <SourcePopover source={item.source}>
                                <span className="fic-info-trigger">ⓘ</span>
                            </SourcePopover>
                        </div>

                        {item.freshness?.status === 'stale' && (
                            <div className="item-stale-banner">⚠️ Stale Data</div>
                        )}
                    </div>
                ))}
            </div>

            {data.hasConflict && (
                <div className="truth-section-disclaimer">
                    ⚠️ Conflicting fee records detected. Displaying deterministic primary source data.
                </div>
            )}
        </div>
    );
}
