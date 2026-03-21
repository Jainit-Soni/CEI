import React from 'react';
import GlassPanel from './GlassPanel';
import { ShieldCheck, AlertTriangle, Info, TrendingUp } from 'lucide-react';

const ShortlistHealth = ({ health }) => {
    if (!health || health.balanceLabel === 'Empty') return null;

    const { distribution, balanceLabel, issues, suggestions, healthScore } = health;
    
    const getStatusColor = () => {
        if (healthScore >= 80) return '#10b981'; // Green
        if (healthScore >= 50) return '#f59e0b'; // Amber
        return '#ef4444'; // Red
    };

    return (
        <GlassPanel className="bento-card health-module shortlist-health-panel">
            <div className="card-glint" />
            <div className="health-content">
                <div className="health-header">
                    <div className="status-indicator">
                        <div className="pulse-dot" style={{ backgroundColor: getStatusColor() }} />
                        <span className="balance-label" style={{ color: getStatusColor() }}>
                            {balanceLabel} Strategy
                        </span>
                    </div>
                    <div className="health-score-module">
                        <span className="score-val" style={{ color: getStatusColor() }}>{healthScore}</span>
                        <span className="score-desc">Health Score</span>
                    </div>
                </div>

                <div className="distribution-container">
                    <div className="distribution-bar">
                        <div className="bar-segment dream" style={{ width: `${(distribution.dream / health.distribution.count) * 100}%` }}>
                            <span className="segment-label">Dream</span>
                        </div>
                        <div className="bar-segment target" style={{ width: `${(distribution.target / health.distribution.count) * 100}%` }}>
                            <span className="segment-label">Target</span>
                        </div>
                        <div className="bar-segment safe" style={{ width: `${(distribution.safe / health.distribution.count) * 100}%` }}>
                            <span className="segment-label">Safe</span>
                        </div>
                    </div>
                    <div className="distribution-legend">
                        <div className="legend-item"><div className="dot dream" /> Dream ({distribution.dream})</div>
                        <div className="legend-item"><div className="dot target" /> Target ({distribution.target})</div>
                        <div className="legend-item"><div className="dot safe" /> Safe ({distribution.safe})</div>
                    </div>
                </div>

                <div className="health-details">
                    {issues.length > 0 && (
                        <div className="health-issues">
                            {issues.slice(0, 1).map((issue, idx) => (
                                <div key={idx} className="health-item issue">
                                    <AlertTriangle size={14} className="shrink-0" />
                                    <span>{issue}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    
                    {suggestions.length > 0 && (
                        <div className="health-suggestions">
                            {suggestions.slice(0, 1).map((sug, idx) => (
                                <div key={idx} className="health-item suggestion">
                                    <TrendingUp size={14} className="shrink-0" />
                                    <span>{sug}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <style jsx>{`
                .shortlist-health-panel {
                    padding: 0;
                    overflow: hidden;
                }
                .health-content {
                    padding: 2rem;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }
                .health-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .status-indicator {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                }
                .pulse-dot {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    box-shadow: 0 0 15px currentColor;
                    animation: pulse-glow 2s infinite;
                }
                @keyframes pulse-glow {
                    0% { transform: scale(1); opacity: 0.8; }
                    50% { transform: scale(1.2); opacity: 1; }
                    100% { transform: scale(1); opacity: 0.8; }
                }
                .balance-label {
                    font-weight: 800;
                    font-size: 0.9rem;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .health-score-module {
                    text-align: right;
                }
                .score-val {
                    display: block;
                    font-size: 2rem;
                    font-weight: 900;
                    line-height: 1;
                }
                .score-desc {
                    font-size: 0.7rem;
                    color: var(--color-text-tertiary);
                    font-weight: 700;
                    text-transform: uppercase;
                }
                .distribution-container {
                    background: rgba(255, 255, 255, 0.4);
                    padding: 1.25rem;
                    border-radius: 20px;
                    border: 1px solid rgba(255, 255, 255, 0.5);
                }
                .distribution-bar {
                    height: 10px;
                    display: flex;
                    border-radius: 5px;
                    overflow: hidden;
                    background: rgba(0,0,0,0.05);
                    margin-bottom: 1rem;
                }
                .bar-segment {
                    transition: width 0.8s cubic-bezier(0.19, 1, 0.22, 1);
                }
                .bar-segment.dream { background: #6366f1; }
                .bar-segment.target { background: #8b5cf6; }
                .bar-segment.safe { background: #10b981; }
                .segment-label { display: none; }
                
                .distribution-legend {
                    display: flex;
                    gap: 1rem;
                }
                .legend-item {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.75rem;
                    font-weight: 600;
                    color: var(--color-text-secondary);
                }
                .dot { width: 6px; height: 6px; border-radius: 50%; }
                .dot.dream { background: #6366f1; }
                .dot.target { background: #8b5cf6; }
                .dot.safe { background: #10b981; }
                
                .health-details {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }
                .health-item {
                    display: flex;
                    gap: 0.75rem;
                    font-size: 0.85rem;
                    font-weight: 500;
                    line-height: 1.4;
                    padding: 0.75rem;
                    border-radius: 12px;
                    background: rgba(255, 255, 255, 0.3);
                }
                .health-item.issue { color: #ef4444; background: rgba(239, 68, 68, 0.05); }
                .health-item.suggestion { color: var(--color-primary); background: rgba(99, 102, 241, 0.05); }
            `}</style>
        </GlassPanel>
    );
};

export default ShortlistHealth;
