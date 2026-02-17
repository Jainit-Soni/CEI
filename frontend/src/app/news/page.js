"use client";

import React, { useState, useEffect } from 'react';
import NewsCard from '@/components/NewsCard';
import NewsTicker from '@/components/NewsTicker';
import Spinner from '@/components/Spinner';

const CATEGORIES = ["All", "Exam Alert", "Results", "Admissions", "Policy", "General"];

export default function NewsPage() {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("All");

    useEffect(() => {
        fetch('/api/news')
            .then(res => res.json())
            .then(data => {
                setNews(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load news:", err);
                setLoading(false);
            });
    }, []);

    const filteredNews = filter === "All"
        ? news
        : news.filter(item => item.category === filter);

    return (
        <div className="news-page">
            <NewsTicker />

            {/* Hero Section */}
            <div className="news-hero">
                <div className="container mx-auto px-4">
                    <h1 className="hero-title">Updates & <span className="text-gradient">Alerts</span></h1>
                    <p className="hero-subtitle">Stay ahead with the latest exam notifications, results, and policy changes.</p>
                </div>
            </div>

            {/* Content Area */}
            <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">

                {/* Left: Filters (Sticky) */}
                <aside className="filters-sidebar">
                    <div className="sticky-wrapper">
                        <h3 className="filter-title">Filter Feed</h3>
                        <div className="filter-list">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat}
                                    className={`filter-btn ${filter === cat ? 'active' : ''}`}
                                    onClick={() => setFilter(cat)}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                </aside>

                {/* Right: Timeline Feed */}
                <main className="feed-container">
                    {loading ? (
                        <div className="flex justify-center p-12"><Spinner /></div>
                    ) : filteredNews.length > 0 ? (
                        <div className="timeline">
                            {filteredNews.map((item, idx) => (
                                <div key={item.id} className="timeline-item">
                                    <div className="timeline-marker">
                                        <div className="marker-dot"></div>
                                        {idx !== filteredNews.length - 1 && <div className="marker-line"></div>}
                                    </div>
                                    <div className="timeline-content">
                                        <NewsCard item={item} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-slate-500">
                            No updates found in this category.
                        </div>
                    )}
                </main>
            </div>

            <style jsx>{`
                .news-page {
                    min-height: 100vh;
                    background: #0f172a;
                    color: white;
                }

                .news-hero {
                    background: radial-gradient(circle at 50% -20%, #1e293b 0%, #0f172a 100%);
                    padding: 60px 0 40px;
                    text-align: center;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }

                .hero-title {
                    font-family: var(--font-display);
                    font-size: 3rem;
                    margin-bottom: 12px;
                }

                .text-gradient {
                    background: linear-gradient(135deg, #ef4444, #f59e0b);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .hero-subtitle {
                    color: #94a3b8;
                    font-size: 1.1rem;
                    max-width: 600px;
                    margin: 0 auto;
                }

                /* Sidebar */
                .filters-sidebar {
                    width: 100%;
                    md:width: 250px;
                    flex-shrink: 0;
                }
                @media (min-width: 768px) {
                    .filters-sidebar { width: 250px; }
                    .sticky-wrapper { position: sticky; top: 100px; }
                }

                .filter-title {
                    font-size: 0.9rem;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    color: #64748b;
                    margin-bottom: 16px;
                    font-weight: 700;
                }

                .filter-list {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .filter-btn {
                    text-align: left;
                    padding: 10px 16px;
                    border-radius: 8px;
                    color: #cbd5e1;
                    transition: all 0.2s;
                    font-weight: 500;
                }
                .filter-btn:hover {
                    background: rgba(255,255,255,0.05);
                    color: white;
                }
                .filter-btn.active {
                    background: rgba(239, 68, 68, 0.1); /* Red tint */
                    color: #ef4444;
                    font-weight: 600;
                }

                /* Feed */
                .feed-container {
                    flex: 1;
                    max-width: 800px;
                }

                /* Timeline */
                .timeline {
                    position: relative;
                }

                .timeline-item {
                    display: flex;
                    gap: 20px;
                }

                .timeline-marker {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    padding-top: 24px;
                    width: 24px;
                    flex-shrink: 0;
                }

                .marker-dot {
                    width: 12px;
                    height: 12px;
                    background: #3b82f6;
                    border-radius: 50%;
                    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.2);
                }

                .marker-line {
                    flex: 1;
                    width: 2px;
                    background: rgba(255,255,255,0.1);
                    margin-top: 4px;
                    min-height: 40px;
                }

                .timeline-content {
                    flex: 1;
                    padding-bottom: 32px;
                }
            `}</style>
        </div>
    );
}
