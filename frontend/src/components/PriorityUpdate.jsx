"use client";

import React from 'react';
import { ShieldCheck, ArrowRight, Bookmark, Clock, Share2 } from 'lucide-react';
import { format } from 'date-fns';
import GlassPanel from './GlassPanel';

export default function PriorityUpdate({ item }) {
    if (!item) return null;

    const publishDate = new Date(item.date);
    const formattedDate = format(publishDate, 'MMMM dd, yyyy • HH:mm');

    return (
        <div className="priority-section-wrapper">
            <GlassPanel className="priority-panel" variant="strong">
                <div className="panel-side-accent" />
                
                <div className="panel-inner">
                    <div className="panel-header">
                        <div className="update-status">
                            <span className="pulse-dot" />
                            <span className="mono text-[10px] tracking-widest uppercase font-black text-blue-600">
                                PERSISTENT SIGNAL ACTIVE
                            </span>
                        </div>
                        <div className="panel-actions">
                            <button className="icon-btn"><Bookmark size={16} /></button>
                            <button className="icon-btn"><Share2 size={16} /></button>
                        </div>
                    </div>

                    <div className="panel-body">
                        <div className="category-kicker-row">
                            <span className="category-tag">{item.category}</span>
                            <span className="timestamp">{formattedDate}</span>
                        </div>
                        
                        <h2 className="title-text">{item.title}</h2>
                        <p className="summary-text">{item.summary}</p>
                        
                        <div className="source-verification">
                            <div className="verify-badge">
                                <ShieldCheck size={14} className="text-emerald-500" />
                                <span>{item.authority} • Verified Node</span>
                            </div>
                        </div>
                    </div>

                    <div className="panel-footer">
                        <a href={item.url} className="primary-action-btn" target="_blank" rel="noopener noreferrer">
                            <span>{item.actionLabel || "Open Official Notice"}</span>
                            <ArrowRight size={18} />
                        </a>
                    </div>
                </div>
            </GlassPanel>

            <style jsx>{`
                .priority-section-wrapper {
                    margin-bottom: 64px;
                }

                :global(.priority-panel) {
                    position: relative;
                    padding: 0;
                    overflow: hidden;
                    border-radius: 32px;
                }

                .panel-side-accent {
                    position: absolute;
                    top: 0;
                    left: 0;
                    bottom: 0;
                    width: 6px;
                    background: linear-gradient(to bottom, var(--color-accent), #db2777);
                }

                .panel-inner {
                    padding: 40px;
                }

                .panel-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 32px;
                }

                .update-status {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .pulse-dot {
                    width: 8px;
                    height: 8px;
                    background: #2563eb;
                    border-radius: 50%;
                    box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
                    animation: pulse 2s infinite;
                }

                @keyframes pulse {
                    0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.4); }
                    70% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(37, 99, 235, 0); }
                    100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
                }

                .panel-actions {
                    display: flex;
                    gap: 8px;
                }

                .icon-btn {
                    width: 36px;
                    height: 36px;
                    border-radius: 50%;
                    background: rgba(255, 255, 255, 0.5);
                    border: 1px solid rgba(0, 0, 0, 0.05);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: var(--color-ink-muted);
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .icon-btn:hover {
                    background: white;
                    color: var(--color-accent);
                    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
                }

                .category-kicker-row {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    margin-bottom: 20px;
                }

                .category-tag {
                    color: white;
                    background: var(--color-accent);
                    font-size: 0.7rem;
                    font-weight: 800;
                    padding: 4px 12px;
                    border-radius: 6px;
                    letter-spacing: 0.05em;
                }

                .timestamp {
                    color: var(--color-ink-secondary);
                    font-size: 0.8rem;
                    font-weight: 600;
                }

                .title-text {
                    font-family: var(--font-display);
                    font-size: clamp(1.8rem, 3vw, 2.4rem);
                    font-weight: 800;
                    color: var(--color-ink);
                    margin: 0 0 20px 0;
                    line-height: 1.2;
                }

                .summary-text {
                    font-size: 1.1rem;
                    line-height: 1.6;
                    color: var(--color-ink-secondary);
                    margin-bottom: 32px;
                    max-width: 800px;
                }

                .source-verification {
                    margin-bottom: 40px;
                }

                .verify-badge {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.8rem;
                    font-weight: 700;
                    color: #059669;
                    padding: 6px 16px;
                    background: #ecfdf5;
                    border-radius: 100px;
                    width: fit-content;
                }

                .primary-action-btn {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    background: var(--color-ink);
                    color: white;
                    padding: 16px 32px;
                    border-radius: 16px;
                    font-weight: 700;
                    text-decoration: none;
                    width: fit-content;
                    box-shadow: 0 10px 20px -5px rgba(0, 0, 0, 0.1);
                    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }

                .primary-action-btn:hover {
                    transform: translateY(-4px);
                    background: var(--color-accent);
                    box-shadow: 0 20px 25px -5px rgba(99, 102, 241, 0.2);
                }

                @media (max-width: 768px) {
                    .panel-inner { padding: 32px 24px; }
                    .primary-action-btn { width: 100%; justify-content: center; }
                    .title-text { font-size: 1.6rem; }
                }
            `}</style>
        </div>
    );
}
