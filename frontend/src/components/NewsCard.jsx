"use client";

import React from 'react';
import { Calendar, ArrowRight, ShieldCheck, Clock, Download, ExternalLink, Info, Star } from 'lucide-react';
import { format, differenceInHours } from 'date-fns';
import GlassPanel from './GlassPanel';

export default function NewsCard({ item }) {
    if (!item) return null;

    const publishDate = new Date(item.date);
    const hoursSincePublish = differenceInHours(new Date(), publishDate);
    const isVeryRecent = hoursSincePublish < 24;
    const formattedDate = format(publishDate, 'MMMM dd, HH:mm');

    const getStatusLabel = () => {
        if (item.category === 'Results') return { label: 'Result Declared', type: 'success' };
        if (item.category === 'Admit Cards') return { label: 'Admit Card Out', type: 'warning' };
        if (item.urgency === 5) return { label: 'Critical Update', type: 'error' };
        if (isVeryRecent) return { label: 'Just Posted', type: 'info' };
        return null;
    };

    const status = getStatusLabel();

    return (
        <div className="news-card-wrapper transition-all duration-300 hover:-translate-y-1">
            <GlassPanel className="news-card-panel" variant="primary">
                {status && (
                    <div className={`status-badge status-badge--${status.type}`}>
                        {status.label}
                    </div>
                )}
                
                <div className="card-header">
                    <span className="category-kicker">{item.category}</span>
                    <span className="time-meta">
                        <Clock size={12} />
                        {formattedDate}
                    </span>
                </div>

                <div className="card-content">
                    <h3 className="card-headline">{item.title}</h3>
                    <p className="card-summary">{item.summary}</p>
                </div>

                <div className="card-footer">
                    <div className="source-meta">
                        <div className={item.isOfficial ? "official-source" : "expert-source"}>
                            {item.isOfficial ? <ShieldCheck size={14} /> : <Star size={14} />}
                            <span>{item.authority || (item.isOfficial ? "Official Portal" : "Expert Analysis")}</span>
                        </div>
                    </div>
                    
                    <a href={item.url} className="action-button" target="_blank" rel="noopener noreferrer">
                        <span>{item.actionLabel || "View Update"}</span>
                        <ArrowRight size={16} />
                    </a>
                </div>
            </GlassPanel>

            <style jsx>{`
                .news-card-wrapper {
                    height: 100%;
                }

                :global(.news-card-panel) {
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    position: relative;
                }

                .status-badge {
                    position: absolute;
                    top: -10px;
                    right: 20px;
                    padding: 4px 12px;
                    border-radius: 100px;
                    font-size: 0.7rem;
                    font-weight: 700;
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
                    z-index: 5;
                }

                .status-badge--success { background: #dcfce7; color: #166534; }
                .status-badge--warning { background: #fef9c3; color: #854d0e; }
                .status-badge--error { background: #fee2e2; color: #991b1b; }
                .status-badge--info { background: #e0f2fe; color: #075985; }

                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                }

                .category-kicker {
                    font-size: 0.65rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    color: var(--color-accent);
                }

                .time-meta {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    font-size: 0.7rem;
                    color: var(--color-ink-secondary);
                    font-weight: 600;
                }

                .card-content {
                    flex: 1;
                    margin-bottom: 24px;
                }

                .card-headline {
                    font-family: var(--font-display);
                    font-size: 1.2rem;
                    font-weight: 700;
                    line-height: 1.3;
                    color: var(--color-ink);
                    margin: 0 0 12px 0;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .card-summary {
                    font-size: 0.9rem;
                    line-height: 1.6;
                    color: var(--color-ink-secondary);
                    display: -webkit-box;
                    -webkit-line-clamp: 3;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                .card-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-top: 20px;
                    border-top: 1px solid rgba(0, 0, 0, 0.03);
                }

                .source-meta {
                    font-size: 0.75rem;
                    font-weight: 700;
                }

                .official-source {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    color: #10b981;
                }

                .expert-source {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    color: var(--color-accent);
                }

                .action-button {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.8rem;
                    font-weight: 800;
                    color: var(--color-accent);
                    text-decoration: none;
                    transition: all 0.2s;
                }

                .action-button:hover {
                    gap: 12px;
                }
            `}</style>
        </div>
    );
}
