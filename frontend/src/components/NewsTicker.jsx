"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function NewsTicker() {
    const [breakingNews, setBreakingNews] = useState([]);

    useEffect(() => {
        fetch('/api/news')
            .then(res => res.json())
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
                    background: #0f172a;
                    border-bottom: 1px solid rgba(239, 68, 68, 0.3);
                    height: 40px;
                    display: flex;
                    align-items: center;
                    position: relative;
                    overflow: hidden;
                    z-index: 50;
                }

                .ticker-label {
                    background: #ef4444;
                    color: white;
                    font-weight: 800;
                    font-size: 0.75rem;
                    padding: 0 16px;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    letter-spacing: 1px;
                    position: relative;
                    z-index: 2;
                    box-shadow: 4px 0 10px rgba(0,0,0,0.5);
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
                    animation: ticker-scroll 30s linear infinite;
                    white-space: nowrap;
                    padding-left: 20px;
                }
                
                /* Pause on hover */
                .ticker-content:hover .ticker-track {
                    animation-play-state: paused;
                }

                .ticker-item {
                    display: flex;
                    align-items: center;
                    margin-right: 40px;
                }

                .dot {
                    width: 6px;
                    height: 6px;
                    background: #ef4444;
                    border-radius: 50%;
                    margin-right: 10px;
                }

                .ticker-link {
                    color: #cbd5e1;
                    font-size: 0.9rem;
                    font-weight: 500;
                    text-decoration: none;
                    transition: color 0.2s;
                }
                .ticker-link:hover {
                    color: white;
                    text-decoration: underline;
                }

                @keyframes ticker-scroll {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-50%); }
                }
            `}</style>
        </div>
    );
}
