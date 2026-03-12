"use client";

import React, { useState, useEffect } from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import GlassPanel from './GlassPanel';

export default function IntelligenceTicker({ items }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const urgentItems = items?.filter(item => item.urgency >= 3) || [];

    useEffect(() => {
        if (urgentItems.length === 0) return;
        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % urgentItems.length);
        }, 5000);
        return () => clearInterval(interval);
    }, [urgentItems.length]);

    if (urgentItems.length === 0) return null;

    const currentItem = urgentItems[currentIndex];

    return (
        <div className="ticker-wrapper">
            <GlassPanel className="ticker-panel" variant="secondary">
                <div className="ticker-label">
                    <Sparkles size={14} className="sparkle-icon" />
                    <span>LATEST ALERTS</span>
                </div>
                
                <div className="ticker-content-area">
                    <div className="ticker-item" key={currentItem.id}>
                        <span className="ticker-category">[{currentItem.category}]</span>
                        <span className="ticker-text">{currentItem.title}</span>
                    </div>
                </div>

                <a href={currentItem.url} className="ticker-action">
                    <span className="action-text">Details</span>
                    <ArrowRight size={14} />
                </a>
            </GlassPanel>

            <style jsx>{`
                .ticker-wrapper {
                    margin-top: 40px;
                    max-width: 800px;
                    margin-left: auto;
                    margin-right: auto;
                }

                :global(.ticker-panel) {
                    display: flex;
                    align-items: center;
                    padding: 8px 16px 8px 12px;
                    gap: 20px;
                    border-radius: 100px;
                }

                .ticker-label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.65rem;
                    font-weight: 800;
                    letter-spacing: 0.1em;
                    color: var(--color-accent);
                    background: rgba(255, 255, 255, 0.5);
                    padding: 6px 12px;
                    border-radius: 100px;
                    white-space: nowrap;
                    flex-shrink: 0;
                }

                .sparkle-icon {
                    animation: shimmy 2s infinite ease-in-out;
                }

                @keyframes shimmy {
                    0%, 100% { transform: scale(1) rotate(0); }
                    50% { transform: scale(1.2) rotate(15deg); }
                }

                .ticker-content-area {
                    flex: 1;
                    overflow: hidden;
                    position: relative;
                }

                .ticker-item {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    animation: slideFadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
                }

                @keyframes slideFadeIn {
                    from { transform: translateY(10px); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }

                .ticker-category {
                    font-size: 0.7rem;
                    font-weight: 900;
                    color: #94a3b8;
                    font-family: var(--font-mono);
                }

                .ticker-text {
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: var(--color-ink);
                    white-space: nowrap;
                    text-overflow: ellipsis;
                    overflow: hidden;
                }

                .ticker-action {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    color: var(--color-accent);
                    font-size: 0.8rem;
                    font-weight: 700;
                    text-decoration: none;
                    flex-shrink: 0;
                    transition: all 0.2s;
                }

                .ticker-action:hover {
                    transform: translateX(3px);
                }

                @media (max-width: 640px) {
                    .action-text { display: none; }
                    .ticker-category { display: none; }
                }
            `}</style>
        </div>
    );
}
