import React from 'react';
import './TrustBadge.css';

const VerifiedIcon = () => (
    <svg viewBox="0 0 24 24" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
);

const UnverifiedIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
);

export default function TrustBadge({ source, lastUpdated, type = "data" }) {
    const isVerified = !!source;
    const dateStr = lastUpdated ? new Date(lastUpdated).toLocaleDateString() : 'Unknown';

    if (!isVerified) {
        return (
            <span className="trust-badge unverified">
                <UnverifiedIcon />
                <span>Unverified</span>
                <div className="trust-tooltip">Data source not confirmed</div>
            </span>
        );
    }

    return (
        <span className="trust-badge">
            <VerifiedIcon />
            <span>Verified</span>
            <div className="trust-tooltip">
                Source: {source} • Updated: {dateStr}
            </div>
        </span>
    );
}
