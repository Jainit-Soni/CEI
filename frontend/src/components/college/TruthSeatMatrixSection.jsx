import React, { useState, useEffect, useMemo } from 'react';
import { fetchEngineeringSeatMatrix } from '@/lib/api';
import SectionTrustSummary from '../Truth/SectionTrustSummary';
import GlassPanel from '../GlassPanel';
import './TruthSeatMatrixSection.css';

/**
 * TruthSeatMatrixSection.jsx
 * =========================
 * Official JoSAA Seat Matrix explorer for CEI.
 * Displays seat availability by program, quota, and pool.
 */
export default function TruthSeatMatrixSection({ collegeId, collegeName, seatSearchName, onStatusChange }) {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isTruncated, setIsTruncated] = useState(false);
    const [expandedPrograms, setExpandedPrograms] = useState(new Set());

    // GROUPING LOGIC: Program -> Rows
    const processedData = useMemo(() => {
        if (!data?.items || data.items.length === 0) return { byProgram: {}, programSummaries: {} };
        
        const byProgram = {};
        const programSummaries = {};
        
        data.items.forEach(item => {
            const programKey = item.programTitle || "Unknown Program";
            
            if (!byProgram[programKey]) {
                byProgram[programKey] = [];
            }
            byProgram[programKey].push(item);
            
            if (!programSummaries[programKey]) {
                programSummaries[programKey] = {
                    title: programKey,
                    totalSeats: 0,
                    quotas: new Set(),
                    pools: new Set()
                };
            }
            
            const summary = programSummaries[programKey];
            summary.totalSeats += (item.seatCapacity || 0);
            if (item.displayQuotaPoolLabel) {
                // Extracts quota from label e.g. "AI" from "AI • Gender-Neutral"
                const quota = item.displayQuotaPoolLabel.split(' • ')[0];
                summary.quotas.add(quota);
            }
            if (item.displaySeatPoolLabel) {
                summary.pools.add(item.displaySeatPoolLabel);
            }
        });
        
        // Finalize summaries
        Object.keys(programSummaries).forEach(key => {
            const s = programSummaries[key];
            s.quotas = Array.from(s.quotas);
            s.pools = Array.from(s.pools);
        });
        
        return { byProgram, programSummaries };
    }, [data?.items]);

    // Global Statistics
    const globalSummary = useMemo(() => {
        const { programSummaries } = processedData;
        const programs = Object.values(programSummaries);
        if (programs.length === 0) return null;

        return {
            totalPrograms: programs.length,
            totalCapacity: programs.reduce((sum, p) => sum + p.totalSeats, 0),
            authority: data?.items[0]?.authorityScope || "JoSAA"
        };
    }, [processedData]);

    // Effects
    useEffect(() => {
        if (!collegeName && !seatSearchName && !collegeId) {
            if (typeof onStatusChange === 'function') onStatusChange('unavailable');
            return;
        }

        const load = async () => {
            try {
                if (typeof onStatusChange === 'function') onStatusChange('loading');
                setIsLoading(true);
                setError(null);
                
                const params = {
                    institutionId: collegeId,
                    instituteName: seatSearchName || collegeName,
                    limit: 500
                };

                const result = await fetchEngineeringSeatMatrix(params);
                
                if (result.meta && result.meta.total > (result.items?.length || 0)) {
                    setIsTruncated(true);
                } else {
                    setIsTruncated(false);
                }

                if (!result.items || result.items.length === 0) {
                    setData({ sectionStatus: 'official_data_unavailable' });
                    if (typeof onStatusChange === 'function') onStatusChange('unavailable');
                } else {
                    setData({
                        ...result,
                        sectionStatus: 'available',
                        freshnessStatus: 'up_to_date',
                        primarySource: 'JoSAA official (Matrix)',
                        lastEvaluatedAt: new Date().toISOString()
                    });
                    if (typeof onStatusChange === 'function') onStatusChange('available');
                }
            } catch (err) {
                console.error("Failed to load seat matrix", err);
                setError("Unable to connect to the official Seat Matrix engine.");
                if (typeof onStatusChange === 'function') onStatusChange('unavailable');
            } finally {
                setIsLoading(false);
            }
        };

        load();
    }, [collegeName, seatSearchName]);

    // Initial expansion
    useEffect(() => {
        if (processedData.programSummaries && Object.keys(processedData.programSummaries).length > 0 && expandedPrograms.size === 0) {
            const firstProgram = Object.keys(processedData.programSummaries)[0];
            setExpandedPrograms(new Set([firstProgram]));
        }
    }, [processedData.programSummaries]);

    const toggleProgram = (key) => {
        const next = new Set(expandedPrograms);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        setExpandedPrograms(next);
    };

    if (isLoading) {
        return (
            <div className="truth-seats-loading">
                <span className="spinner"></span>
                Rehydrating Seat Matrix...
            </div>
        );
    }

    if (error) {
        return (
            <GlassPanel className="truth-seats-error">
                <div className="te-icon">⚠️</div>
                <div className="te-text">{error}</div>
            </GlassPanel>
        );
    }

    if (!data || data.sectionStatus === 'official_data_unavailable' || !data.items || data.items.length === 0) {
        return (
            <GlassPanel className="truth-seats-empty">
                <div className="te-icon">🪑</div>
                <h3 className="te-title">No Seat Matrix available</h3>
                <p className="te-desc">Official intake breakdown is not yet available for the upcoming session for this institution.</p>
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
                titleOverride="Official Seat Matrix & Intake Disaggregation"
            />

            {/* SEATS INTEL STRIP */}
            {globalSummary && (
                <div className="seats-intel-strip">
                    <div className="si-item">
                        <span className="si-label">AUTHORITY</span>
                        <span className="si-value text-indigo">{globalSummary.authority}</span>
                    </div>
                    <div className="si-item">
                        <span className="si-label">TOTAL INTAKE</span>
                        <span className="si-value">{globalSummary.totalCapacity}</span>
                    </div>
                    <div className="si-item">
                        <span className="si-label">CATALOGED PROGRAMS</span>
                        <span className="si-value">{globalSummary.totalPrograms}</span>
                    </div>
                </div>
            )}

            {/* PROGRAM LIST */}
            <div className="seats-list">
                {Object.entries(processedData.programSummaries).map(([title, summary]) => (
                    <div key={title} className={`seats-unit ${expandedPrograms.has(title) ? 'is-expanded' : ''}`}>
                        <div className="su-header" onClick={() => toggleProgram(title)}>
                            <div className="su-info">
                                <h3 className="su-title">{title}</h3>
                                <div className="su-meta">
                                    <span className="su-tag">{summary.quotas.join(' • ')}</span>
                                    <span className="su-tag">{summary.pools.length} Seat Pools</span>
                                </div>
                            </div>
                            <div className="su-intel">
                                <div className="su-metric">
                                    <span className="su-m-lab">PROGRAM TOTAL</span>
                                    <span className="su-m-val highlight">{summary.totalSeats}</span>
                                </div>
                                <div className="su-toggle">
                                    {expandedPrograms.has(title) ? '−' : '+'}
                                </div>
                            </div>
                        </div>

                        {expandedPrograms.has(title) && (
                            <div className="su-content">
                                <div className="su-table-scroller">
                                    <table className="seats-table">
                                        <thead>
                                            <tr>
                                                <th>Quota Scope</th>
                                                <th>Seat Pool</th>
                                                <th className="text-right">Capacity</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {processedData.byProgram[title].map((item, idx) => (
                                                <tr key={idx}>
                                                    <td className="s-quota">{item.quotaScopeLabel || "All India"}</td>
                                                    <td className="s-pool">
                                                        <span className={`pool-badge ${item.isFemaleOnlyPool ? 'female' : 'neutral'}`}>
                                                            {item.seatPoolLabel || "Gender-Neutral"}
                                                        </span>
                                                    </td>
                                                    <td className="s-cap text-right">{item.seatCapacity}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {isTruncated && (
                <div className="truth-section-warning">
                    ⚠️ Showing first 500 intake rows. This covers the full program disaggregation for this institute.
                </div>
            )}
        </div>
    );
}
