import React, { useState, useEffect } from 'react';
import { fetchCollegeTruthSeats } from '@/lib/api';
import SectionTrustSummary from '../Truth/SectionTrustSummary';
import SourcePopover from '../Truth/SourcePopover';
import GlassPanel from '../GlassPanel';
import './TruthSeatsSection.css';

/**
 * TruthSeatsSection.jsx — Phase 80.4 Implementation
 * ================================================
 * First Truth-Grade frontend section for Seats & Intake.
 */
export default function TruthSeatsSection({ collegeId }) {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!collegeId) return;

        const load = async () => {
            try {
                setIsLoading(true);
                console.log(`[CEI][UI][seats] Loading seats for collegeId: ${collegeId}`);
                const result = await fetchCollegeTruthSeats(collegeId);
                console.log(`[CEI][UI][seats] Backend response:`, result);
                
                if (result && result.sectionStatus === 'available') {
                    console.log(`[CEI][UI][seats] Rows received: ${result.data?.length || 0}`);
                } else {
                    console.log(`[CEI][UI][detail] Empty-state reason: ${result?.message || 'Unknown'}`);
                }
                
                setData(result);
            } catch (err) {
                // Ignore 404s as they are handled by the response state now (or 200 soft-missing)
                if (err.response?.status !== 404) {
                    console.error("Failed to load truth seats", err);
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

    const summary = React.useMemo(() => {
        if (!data?.items) return null;
        const totalIntake = data.items.reduce((sum, item) => sum + (parseInt(item.value) || 0), 0);
        const degrees = Array.from(new Set(data.items.map(i => i.degree).filter(Boolean)));
        return {
            programCount: data.items.length,
            totalIntake,
            degrees: degrees.slice(0, 3)
        };
    }, [data]);

    if (isLoading) {
        return (
            <div className="truth-section-loading">
                <span className="spinner"></span>
                Loading Evaluated Intake Data...
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
                <div className="te-icon">🚫</div>
                <h3 className="te-title">Official data unavailable</h3>
                <p className="te-desc">No current evaluated official source is linked for seats and intake for this year.</p>
            </GlassPanel>
        );
    }

    return (
        <div className="truth-seats-section fade-in">
            <SectionTrustSummary 
                status={data.sectionStatus}
                freshnessStatus={data.freshnessStatus}
                primarySource={data.primarySource}
                lastEvaluatedAt={data.lastEvaluatedAt}
                titleOverride="Institutional Program Inventory & Yearly Intake"
            />

            {summary && (
                <div className="seats-intel-bar-v4">
                    <div className="sib-item">
                        <span className="sib-val">{summary.programCount}</span>
                        <span className="sib-lab">Programs</span>
                    </div>
                    <div className="sib-divider"></div>
                    <div className="sib-item">
                        <span className="sib-val">{summary.totalIntake}</span>
                        <span className="sib-lab">Yearly Seats</span>
                    </div>
                </div>
            )}

            <div className="seats-catalog-v4">
                {(data.items || []).map((item, idx) => (
                    <div key={idx} className="seat-row-v4">
                        <div className="sr-identity">
                            <h4 className="sr-title">{item.displayLabel}</h4>
                            <div className="sr-meta">
                                {item.degree && <span className="sr-pill s-highlight">{item.degree}</span>}
                                {item.specialization && <span className="sr-pill">{item.specialization}</span>}
                                <SourcePopover source={item.source} pageReference={item.pageReference}>
                                    <span className="sr-source-icon" title="View Source Verification">📄</span>
                                </SourcePopover>
                            </div>
                        </div>
                        <div className="sr-intake-v4">
                            <span className="sr-intake-num">{item.value}</span>
                            <span className="sr-intake-unit">INTAKE</span>
                        </div>
                    </div>
                ))}
            </div>

            {data.hasConflict && (
                <div className="truth-section-disclaimer">
                    ℹ️ Semantic conflicts in source documents resolved by deterministic engine.
                </div>
            )}
        </div>
    );
}
