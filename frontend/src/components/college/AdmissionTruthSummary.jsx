import React, { useState, useEffect } from 'react';
import { fetchEngineeringCutoffs, fetchEngineeringSeatMatrix } from '@/lib/api';
import GlassPanel from '../GlassPanel';
import './AdmissionTruthSummary.css';

/**
 * AdmissionTruthSummary.jsx
 * =========================
 * Compact summary of official 2025 engineering admission data availability.
 */
export default function AdmissionTruthSummary({ collegeId, searchName }) {
    const [status, setStatus] = useState({
        josaaCutoffs: { available: false, loading: true },
        csabCutoffs: { available: false, loading: true },
        josaaSeats: { available: false, loading: true }
    });

    useEffect(() => {
        if (!searchName && !collegeId) return;

        const checkAvailability = async () => {
            const name = searchName;
            
            // Lightweight probes: limit 1
            const probes = [
                // 1. JoSAA Cutoffs 2025
                fetchEngineeringCutoffs({ institutionId: collegeId, instituteName: name, counsellingYear: 2025, authority: 'JOSAA', limit: 1 })
                    .then(res => ({ key: 'josaaCutoffs', available: !!(res.items && res.items.length > 0) }))
                    .catch(() => ({ key: 'josaaCutoffs', available: false })),
                
                // 2. CSAB Cutoffs 2025
                fetchEngineeringCutoffs({ institutionId: collegeId, instituteName: name, counsellingYear: 2025, authority: 'CSAB', limit: 1 })
                    .then(res => ({ key: 'csabCutoffs', available: !!(res.items && res.items.length > 0) }))
                    .catch(() => ({ key: 'csabCutoffs', available: false })),
                
                // 3. JoSAA Seat Matrix 2025
                fetchEngineeringSeatMatrix({ institutionId: collegeId, instituteName: name, limit: 1 })
                    .then(res => ({ key: 'josaaSeats', available: !!(res.items && res.items.length > 0) }))
                    .catch(() => ({ key: 'josaaSeats', available: false }))
            ];

            const results = await Promise.all(probes);
            
            const nextStatus = { ...status };
            results.forEach(res => {
                nextStatus[res.key] = { available: res.available, loading: false };
            });
            
            setStatus(nextStatus);
        };

        checkAvailability();
    }, [searchName, collegeId]);

    const scrollToSection = (id) => {
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <GlassPanel className="admission-truth-summary fade-in">
            <div className="ats-header">
                <div className="ats-title-group">
                    <h3 className="ats-title">Admission Truth Summary</h3>
                    <p className="ats-subtitle">Official 2025 engineering admission data</p>
                </div>
                <div className="ats-trust-badge">
                    <span className="ats-badge-icon">🛡️</span>
                    Official Sources Only
                </div>
            </div>

            <div className="ats-grid">
                <div className={`ats-card ${status.josaaCutoffs.loading ? 'loading' : (status.josaaCutoffs.available ? 'available' : 'unavailable')}`}>
                    <div className="ats-card-main">
                        <span className="ats-card-label">JoSAA Cutoffs</span>
                        <span className="ats-card-status">
                            {status.josaaCutoffs.loading ? 'Checking...' : (status.josaaCutoffs.available ? 'Available' : 'Data Missing')}
                        </span>
                    </div>
                    {status.josaaCutoffs.available && (
                        <button onClick={() => scrollToSection('truth-gateway')} className="ats-jump-btn">View Cutoffs →</button>
                    )}
                </div>

                <div className={`ats-card ${status.csabCutoffs.loading ? 'loading' : (status.csabCutoffs.available ? 'available' : 'unavailable')}`}>
                    <div className="ats-card-main">
                        <span className="ats-card-label">CSAB Cutoffs</span>
                        <span className="ats-card-status">
                            {status.csabCutoffs.loading ? 'Checking...' : (status.csabCutoffs.available ? 'Available' : 'Data Missing')}
                        </span>
                    </div>
                </div>

                <div className={`ats-card ${status.josaaSeats.loading ? 'loading' : (status.josaaSeats.available ? 'available' : 'unavailable')}`}>
                    <div className="ats-card-main">
                        <span className="ats-card-label">Seat Matrix</span>
                        <span className="ats-card-status">
                            {status.josaaSeats.loading ? 'Checking...' : (status.josaaSeats.available ? 'Available' : 'Data Missing')}
                        </span>
                    </div>
                    {status.josaaSeats.available && (
                        <button onClick={() => scrollToSection('truth-campus')} className="ats-jump-btn">View Matrix →</button>
                    )}
                </div>
            </div>

            <div className="ats-footer">
                <span className="ats-info-icon">ℹ️</span>
                Data rehydrated from JoSAA and CSAB official evaluation engines.
            </div>
        </GlassPanel>
    );
}
