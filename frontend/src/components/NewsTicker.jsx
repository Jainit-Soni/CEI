"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { fetchNews } from '@/lib/api';

export default function NewsTicker() {
    const [breakingNews, setBreakingNews] = useState([]);

    useEffect(() => {
        fetchNews()
            .then(data => {
                // Filter for urgent items only
                const urgentItems = data.filter(item => item.urgent);
                setBreakingNews(urgentItems);
            })
            .catch(err => console.error("Ticker fetch error", err));
    }, []);

    if (breakingNews.length === 0) return null;

    return (
        <div className="news-ticker-container">
            <div className="ticker-label">BREAKING</div>
            <div className="ticker-content">
                <div className="ticker-track">
                    {breakingNews.map((item, idx) => (
                        <div key={item.id} className="ticker-item">
                            <span className="dot"></span>
                            <Link href={item.url || "/news"} className="ticker-link">
                                {item.title}
                            </Link>
                        </div>
                    ))}
                    {/* Duplicate for seamless looop */}
                    {breakingNews.map((item, idx) => (
                        <div key={`dup-${item.id}`} className="ticker-item">
                            <span className="dot"></span>
                            <Link href={item.url || "/news"} className="ticker-link">
                                {item.title}
                            </Link>
                        </div>
                    ))}
                </div>
            </div>

            <style jsx>{`
                .news-ticker-container {
                    background: rgba(255, 255, 255, 0.8);
                    backdrop-filter: blur(12px);
                    border-bottom: 1px solid rgba(79, 70, 229, 0.1);
                    height: 44px;
                    display: flex;
                    align-items: center;
                    position: relative;
                    overflow: hidden;
                    z-index: 50;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.02);
                }

                .ticker-label {
                    background: var(--color-accent, #4f46e5);
                    color: white;
                    font-weight: 900;
                    font-size: 0.7rem;
                    padding: 0 16px;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    letter-spacing: 2px;
                    position: relative;
                    z-index: 10;
                    box-shadow: 8px 0 20px rgba(79, 70, 229, 0.2);
                    text-transform: uppercase;
                }

                .ticker-content {
                    flex: 1;
                    overflow: hidden;
                    position: relative;
                    height: 100%;
                    display: flex;
                    align-items: center;
                }

                .ticker-track {
                    display: flex;
                    animation: ticker-scroll 45s linear infinite;
                    white-space: nowrap;
                    padding-left: 30px;
                }
                
                .ticker-content:hover .ticker-track {
                    animation-play-state: paused;
                }

                .ticker-item {
                    display: flex;
                    align-items: center;
                    margin-right: 50px;
                }

                .dot {
                    width: 6px;
                    height: 6px;
                    background: var(--color-accent, #4f46e5);
                    border-radius: 50%;
                    margin-right: 12px;
                    opacity: 0.5;
                }

                .ticker-link {
                    color: var(--color-slate-700, #334155);
                    font-size: 0.85rem;
                    font-weight: 700;
                    text-decoration: none;
                    transition: all 0.2s;
                    letter-spacing: -0.01em;
                }
                .ticker-link:hover {
                    color: var(--color-accent);
                    text-decoration: none;
                    transform: translateY(-1px);
                }

                @keyframes ticker-scroll {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
            `}</style>
        </div>
    );
}
