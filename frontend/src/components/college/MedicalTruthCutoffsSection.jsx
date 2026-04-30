import React, { useState, useEffect, useMemo } from 'react';
import { fetchMedicalCutoffs } from '@/lib/api';
import SectionTrustSummary from '../Truth/SectionTrustSummary';
import GlassPanel from '../GlassPanel';
import MedicalPredictorWidget from './MedicalPredictorWidget';
import './TruthCutoffsSection.css'; // Reuse styles

/**
 * MedicalTruthCutoffsSection.jsx
 * ==============================
 * Specialized explorer for MCC/Medical Admission Thresholds.
 */
export default function MedicalTruthCutoffsSection({ entityId }) {
    const [allItems, setAllItems] = useState([]);
    const [meta, setMeta] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedQuotas, setExpandedQuotas] = useState(new Set());

    // Derive initial quota/category from data if available
    const initialConfig = useMemo(() => {
        if (allItems.length === 0) return { quota: 'All India', category: 'OPEN' };
        return { quota: allItems[0].quota, category: allItems[0].category };
    }, [allItems]);

    // GROUPING: Quota -> Round -> Items
    const processedData = useMemo(() => {
        if (!allItems || allItems.length === 0) return { hierarchical: {}, quotas: [] };
        
        const hierarchical = {};
        const quotas = new Set();
        
        allItems.forEach(item => {
            const quota = item.quota || 'Unknown Quota';
            const round = item.round || 'Unknown Round';
            
            quotas.add(quota);
            
            if (!hierarchical[quota]) {
                hierarchical[quota] = {};
            }
            if (!hierarchical[quota][round]) {
                hierarchical[quota][round] = [];
            }
            hierarchical[quota][round].push(item);
        });
        
        return { hierarchical, quotas: Array.from(quotas) };
    }, [allItems]);

    useEffect(() => {
        const load = async () => {
            if (!entityId) return;
            try {
                setIsLoading(true);
                setError(null);
                const result = await fetchMedicalCutoffs({ entityId });
                setAllItems(result.items || []);
                setMeta(result.meta);
            } catch (err) {
                console.error("Failed to load medical cutoffs", err);
                setError("Connection to Medical Truth Engine failed.");
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [entityId]);

    // Default open first quota
    useEffect(() => {
        if (processedData.quotas.length > 0 && expandedQuotas.size === 0) {
            setExpandedQuotas(new Set([processedData.quotas[0]]));
        }
    }, [processedData.quotas]);

    const toggleQuota = (quota) => {
        const next = new Set(expandedQuotas);
        if (next.has(quota)) next.delete(quota);
        else next.add(quota);
        setExpandedQuotas(next);
    };

    if (isLoading) return <div className="truth-section-loading"><span className="spinner"></span> Analyzing Thresholds...</div>;
    if (error) return <GlassPanel className="truth-error-state"><div className="te-icon">⚠️</div><div className="te-text">{error}</div></GlassPanel>;
    if (allItems.length === 0) return <GlassPanel className="truth-empty-state"><div className="te-icon">🚫</div><h3 className="te-title">Official data unavailable</h3><p className="te-desc">No MCC cutoff data found for this entity.</p></GlassPanel>;

    return (
        <div className="truth-cutoffs-section fade-in">
            <SectionTrustSummary 
                status="available"
                freshnessStatus="up_to_date"
                primarySource="MCC Official (Result)"
                lastEvaluatedAt={new Date().toISOString()}
                titleOverride="Medical Admission Thresholds (NEET-UG)"
            />

            <div className="mb-10">
                <MedicalPredictorWidget 
                    targetCollegeId={entityId} 
                    initialQuota={initialConfig.quota}
                    initialCategory={initialConfig.category}
                />
            </div>

            <div className="cutoffs-list-v4">
                {processedData.quotas.map(quota => (
                    <div key={quota} className={`cutoff-unit-v4 ${expandedQuotas.has(quota) ? 'is-expanded' : ''}`}>
                        <div className="cu-header-v4" onClick={() => toggleQuota(quota)}>
                            <div className="cu-info-v4">
                                <h3 className="cu-title-v4">{quota}</h3>
                                <div className="cu-meta-v4">
                                    <span className="cu-tag">{Object.keys(processedData.hierarchical[quota]).length} Rounds Evaluated</span>
                                </div>
                            </div>
                            <div className="cu-toggle-v4">{expandedQuotas.has(quota) ? 'Close' : 'Inspect'}</div>
                        </div>

                        {expandedQuotas.has(quota) && (
                            <div className="cu-content-v4 p-4">
                                {Object.entries(processedData.hierarchical[quota]).map(([round, items]) => (
                                    <div key={round} className="round-group-v4 mb-6">
                                        <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-3">Round: {round}</h4>
                                        <div className="rg-table-scroller-v4">
                                            <table className="light-cutoff-table-v4">
                                                <thead>
                                                    <tr>
                                                        <th>Category</th>
                                                        <th className="text-right">Closing Rank</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {items.map((item, idx) => (
                                                        <tr key={idx}>
                                                            <td className="c-cat-v4 font-bold text-slate-700">{item.category}</td>
                                                            <td className="c-rank-v4 c-closing-v4 text-right">{item.closing_rank.toLocaleString()}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
