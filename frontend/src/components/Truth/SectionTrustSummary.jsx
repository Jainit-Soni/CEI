import React from 'react';
import TruthChip from './TruthChip';
import './SectionTrustSummary.css';

/**
 * SectionTrustSummary.jsx — Truth-first Section Header
 * ====================================================
 * Displays the high-level health of a data section.
 */
export default function SectionTrustSummary({ 
    status = 'evaluated', 
    freshnessStatus = 'fresh',
    primarySource,
    lastEvaluatedAt 
}) {
    return (
        <div className="section-trust-summary">
            <div className="sts-meta">
                <TruthChip status={status} />
                <span className={`sts-freshness ${freshnessStatus}`}>
                    {freshnessStatus === 'fresh' ? '● Data Fresh' : freshnessStatus === 'stale' ? '○ Data Stale' : '○ Status Unknown'}
                </span>
            </div>

            {primarySource && (
                <div className="sts-source-link">
                    Source: 
                    <a 
                        href={primarySource.url || '#'} 
                        target="_blank" 
                        rel="noopener noreferrer"
                    >
                        {primarySource.title} ↗
                    </a>
                </div>
            )}

            {lastEvaluatedAt && (
                <div className="sts-timestamp">
                    Evaluated {new Date(lastEvaluatedAt).toLocaleDateString('en-IN', {
                        month: 'short', year: 'numeric'
                    })}
                </div>
            )}
        </div>
    );
}
