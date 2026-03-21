import React from 'react';
import { Shield, Target, Sparkles, TrendingUp, AlertCircle, MapPin, BadgeDollarSign } from 'lucide-react';

const FitBadge = ({ fit, compact = false }) => {
    if (!fit) return null;

    const { admissionClassification, fitLabel, fitScore, reasons = [], tradeoffs = [], warnings = [] } = fit;

    const classConfig = {
        "Safe": { color: "#10b981", icon: <Shield size={compact ? 12 : 14} /> },
        "Target": { color: "#f59e0b", icon: <Target size={compact ? 12 : 14} /> },
        "Dream": { color: "#6366f1", icon: <Sparkles size={compact ? 12 : 14} /> },
        "Unknown": { color: "#9ca3af", icon: null }
    };

    const fitConfig = {
        "Strong Fit": { bg: "#ecfdf5", text: "#065f46" },
        "Conditional Fit": { bg: "#fffbeb", text: "#92400e" },
        "Weak Fit": { bg: "#fef2f2", text: "#991b1b" }
    };

    const config = classConfig[admissionClassification] || classConfig["Unknown"];
    const fitStyle = fitConfig[fitLabel] || { bg: "#f3f4f6", text: "#4b5563" };

    if (compact) {
        return (
            <div className="fit-badge-compact" style={{ color: config.color }}>
                {config.icon}
                <span>{admissionClassification}</span>
                <style jsx>{`
                    .fit-badge-compact {
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                        font-size: 0.7rem;
                        font-weight: 800;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div className="fit-badge-container">
            <div className="fit-main-row">
                <div className="admission-pill" style={{ backgroundColor: config.color }}>
                    {config.icon}
                    <span>{admissionClassification}</span>
                </div>
                <div className="fit-label-pill" style={{ backgroundColor: fitStyle.bg, color: fitStyle.text }}>
                    {fitLabel} ({fitScore}%)
                </div>
            </div>

            {reasons.length > 0 && (
                <div className="fit-reasons">
                    {reasons.slice(0, 2).map((r, i) => (
                        <div key={i} className="reason-item">
                            <TrendingUp size={10} />
                            <span>{r}</span>
                        </div>
                    ))}
                </div>
            )}

            {warnings.length > 0 && (
                <div className="fit-warnings">
                    {warnings.slice(0, 1).map((w, i) => (
                        <div key={i} className="warning-item">
                            <AlertCircle size={10} />
                            <span>{w}</span>
                        </div>
                    ))}
                </div>
            )}

            <style jsx>{`
                .fit-badge-container {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-top: 8px;
                }
                .fit-main-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .admission-pill {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 4px 10px;
                    border-radius: 100px;
                    color: white;
                    font-size: 0.7rem;
                    font-weight: 800;
                    text-transform: uppercase;
                }
                .fit-label-pill {
                    padding: 4px 10px;
                    border-radius: 100px;
                    font-size: 0.7rem;
                    font-weight: 700;
                }
                .fit-reasons, .fit-warnings {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    padding-left: 4px;
                }
                .reason-item, .warning-item {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.75rem;
                    font-weight: 500;
                }
                .reason-item { color: #059669; }
                .warning-item { color: #dc2626; }
            `}</style>
        </div>
    );
};

export default FitBadge;
