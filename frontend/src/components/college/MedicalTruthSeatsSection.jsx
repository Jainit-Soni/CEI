import React, { useState, useEffect, useMemo } from 'react';
import { fetchMedicalSeatMatrix } from '@/lib/api';
import SectionTrustSummary from '../Truth/SectionTrustSummary';
import GlassPanel from '../GlassPanel';
import './TruthSeatMatrixSection.css'; // Reuse styles

/**
 * MedicalTruthSeatsSection.jsx
 * ============================
 * Explorer for MCC Medical Seat Matrix.
 */
export default function MedicalTruthSeatsSection({ entityId, onStatusChange }) {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const load = async () => {
            if (!entityId) {
                if (onStatusChange) onStatusChange('unavailable');
                return;
            }
            try {
                if (onStatusChange) onStatusChange('loading');
                setIsLoading(true);
                setError(null);
                const result = await fetchMedicalSeatMatrix({ entityId });
                setData(result);
                if (onStatusChange) onStatusChange(result.items?.length > 0 ? 'available' : 'unavailable');
            } catch (err) {
                console.error("Failed to load medical seats", err);
                setError("Connection to Medical Truth Engine failed.");
                if (onStatusChange) onStatusChange('unavailable');
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [entityId]);


    // Grouping: Quota -> Category -> Seats
    const processedData = useMemo(() => {
        if (!data?.items || data.items.length === 0) return { quotas: {} };
        
        const quotas = {};
        data.items.forEach(item => {
            if (!quotas[item.quota]) quotas[item.quota] = [];
            quotas[item.quota].push(item);
        });
        return { quotas };
    }, [data]);

    const totalSeats = useMemo(() => {
        if (!data?.items) return 0;
        return data.items.reduce((sum, item) => sum + (item.seat_count || 0), 0);
    }, [data]);

    if (isLoading) return <div className="truth-seats-loading"><span className="spinner"></span> Quantifying Capacity...</div>;
    if (error) return <GlassPanel className="truth-seats-error"><div className="te-icon">⚠️</div><div className="te-text">{error}</div></GlassPanel>;
    if (!data?.items || data.items.length === 0) return <GlassPanel className="truth-seats-empty"><div className="te-icon">🪑</div><h3 className="te-title">No Seat Matrix found</h3><p className="te-desc">Official intake breakdown not available for this entity.</p></GlassPanel>;

    return (
        <div className="truth-seats-section fade-in">
            <SectionTrustSummary 
                status="available"
                freshnessStatus="up_to_date"
                primarySource="MCC Official (Seat Matrix)"
                lastEvaluatedAt={new Date().toISOString()}
                titleOverride="Official Seat Matrix & Reservation Logic"
            />

            <div className="seats-intel-strip">
                <div className="si-item">
                    <span className="si-label">INTAKE VOLUME</span>
                    <span className="si-value">{totalSeats} Seats</span>
                </div>
                <div className="si-item">
                    <span className="si-label">QUOTAS</span>
                    <span className="si-value">{Object.keys(processedData.quotas).length} Active</span>
                </div>
            </div>

            <div className="seats-list mt-6">
                {Object.entries(processedData.quotas).map(([quota, items]) => (
                    <div key={quota} className="seats-unit is-expanded mb-6">
                        <div className="su-header bg-slate-50/50">
                            <div className="su-info">
                                <h3 className="su-title text-indigo-700">{quota}</h3>
                            </div>
                        </div>
                        <div className="su-content">
                            <div className="su-table-scroller">
                                <table className="seats-table">
                                    <thead>
                                        <tr>
                                            <th>Category / Reservation</th>
                                            <th className="text-right">Capacity</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, idx) => (
                                            <tr key={idx}>
                                                <td className="s-quota font-medium">{item.category}</td>
                                                <td className="s-cap text-right font-bold text-slate-900">{item.seat_count}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
