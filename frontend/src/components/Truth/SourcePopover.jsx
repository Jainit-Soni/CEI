import React, { useState } from 'react';
import './SourcePopover.css';

/**
 * SourcePopover.jsx — CEI Truth Provenance Popover
 * ==============================================
 * Lightweight hover/tap card showing exact source document data.
 */
export default function SourcePopover({ source, pageReference, children }) {
    const [isOpen, setIsOpen] = useState(false);

    if (!source) return children;

    const typeLabels = {
        primary_authority: 'Authority Portal',
        official_institute: 'Institute Website',
        statutory_body: 'Statutory Body',
        normalized_derived: 'Normalized Data'
    };

    return (
        <div 
            className="source-popover-wrapper"
            onMouseEnter={() => setIsOpen(true)}
            onMouseLeave={() => setIsOpen(false)}
        >
            <div className="source-trigger">
                {children}
            </div>

            {isOpen && (
                <div className="source-card">
                    <div className="sc-header">
                        <span className="sc-type-badge">
                            {typeLabels[source.type] || 'Source'}
                        </span>
                        {source.url && (
                            <a 
                                href={source.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="sc-link-icon"
                            >
                                ↗
                            </a>
                        )}
                    </div>
                    
                    <div className="sc-body">
                        <h4 className="sc-title">{source.title}</h4>
                        {pageReference && (
                            <div className="sc-detail">
                                <span className="sc-label">Location:</span>
                                <span className="sc-value">{pageReference}</span>
                            </div>
                        )}
                        {source.lastEvaluatedAt && (
                            <div className="sc-detail">
                                <span className="sc-label">CEI Indexed:</span>
                                <span className="sc-value">
                                    {new Date(source.lastEvaluatedAt).toLocaleDateString('en-IN', {
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric'
                                    })}
                                </span>
                            </div>
                        )}
                    </div>
                    
                    <div className="sc-footer">
                        Official source linked via SourceRegistry
                    </div>
                </div>
            )}
        </div>
    );
}
