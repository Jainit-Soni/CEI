import React from 'react';
import './TruthChip.css';

/**
 * TruthChip.jsx — CEI Truth Status Badge
 * =====================================
 * Evaluated | Stale | Under Verification | Conflict | Unavailable
 */
export default function TruthChip({ status = 'evaluated' }) {
    const configs = {
        evaluated: { 
            label: 'Official Evaluated', 
            icon: '🛡️', 
            className: 'tc-evaluated' 
        },
        available: {
            label: 'Indexed Data',
            icon: '✅',
            className: 'tc-evaluated'
        },
        stale: { 
            label: 'Outdated Data', 
            icon: '🕒', 
            className: 'tc-stale' 
        },
        under_verification: { 
            label: 'Under Verification', 
            icon: '🔍', 
            className: 'tc-pending' 
        },
        conflict: { 
            label: 'Data Conflict', 
            icon: '⚠️', 
            className: 'tc-conflict' 
        },
        official_data_unavailable: { 
            label: 'Official Data Unavailable', 
            icon: '🚫', 
            className: 'tc-unavailable' 
        }
    };

    const cfg = configs[status] || configs.official_data_unavailable;

    return (
        <span className={`truth-chip ${cfg.className}`}>
            <span className="tc-icon">{cfg.icon}</span>
            <span className="tc-label">{cfg.label}</span>
        </span>
    );
}
