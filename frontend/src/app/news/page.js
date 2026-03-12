"use client";

import { useEffect, useState, useMemo } from "react";
import Container from "@/components/Container";
import GlassPanel from "@/components/GlassPanel";
import EmptyState from "@/components/EmptyState";
import { CardSkeleton } from "@/components/Skeleton";
import { RevealOnScroll } from "@/lib/useIntersectionObserver";
import { fetchNews } from "@/lib/api";
import NewsCard from "@/components/NewsCard";
import IntelligenceTicker from "@/components/IntelligenceTicker";
import PriorityUpdate from "@/components/PriorityUpdate";
import { Search, RefreshCw, Layers, Bell, CheckCircle, HelpCircle } from "lucide-react";
import "../colleges/page.css";

export default function NewsPage() {
    const [news, setNews] = useState([]);
    const [activeTab, setActiveTab] = useState("All");
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [query, setQuery] = useState("");
    const [lastUpdate, setLastUpdate] = useState(null);
    const [hasMounted, setHasMounted] = useState(false);

    useEffect(() => {
        setHasMounted(true);
        const load = async () => {
            try {
                setIsLoading(true);
                const data = await fetchNews();
                setNews(Array.isArray(data) ? data : []);
                setLastUpdate(new Date());
            } catch (err) {
                console.error("Portal sync failure", err);
                setError("Portal synchronization interrupted. Official sources might be under maintenance.");
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const categories = [
        "All", "Exams", "Results", "Admit Cards", "Merit Lists", "Admissions", "Scholarships", "Notifications"
    ];

    const filteredNews = useMemo(() => {
        return news.filter(item => {
            const matchesTab = activeTab === "All" || item.category === activeTab;
            const matchesSearch = item.title.toLowerCase().includes(query.toLowerCase()) || 
                                 item.summary.toLowerCase().includes(query.toLowerCase());
            return matchesTab && matchesSearch;
        });
    }, [news, activeTab, query]);

    const prioritySignal = useMemo(() => {
        if (!news.length) return null;
        return news
            .filter(item => item.urgency === 5)
            .sort((a, b) => new Date(b.date) - new Date(a.date))[0] || 
            news.find(item => item.isOfficial);
    }, [news]);

    const displaySignals = filteredNews.filter(item => item.id !== prioritySignal?.id);

    // Stats for the hero section
    const stats = useMemo(() => {
        if (!news.length) return { updates: 0, results: 0, admitCards: 0, new: 0 };
        return {
            updates: news.length,
            results: news.filter(n => n.category === 'Results').length,
            admitCards: news.filter(n => n.category === 'Admit Cards').length,
            new: news.filter(n => {
                const h = (new Date() - new Date(n.date)) / (1000 * 60 * 60);
                return h < 24;
            }).length
        };
    }, [news]);

    return (
        <div className="list-page">
            <section className="list-hero list-hero--news">
                <div className="list-hero-bg" aria-hidden="true">
                    <div className="hero-orb hero-orb--1" />
                    <div className="hero-orb hero-orb--2" />
                </div>

                <Container>
                    <div className="list-hero-content">
                        <RevealOnScroll>
                            <span className="list-hero-kicker">Live Updates</span>
                            <h1 className="list-hero-title">Real academic updates, organized for clarity</h1>
                            <p className="list-hero-subtitle">
                                Stay ahead of the curve with verified signals from official education portals, filtered for immediate action.
                            </p>
                        </RevealOnScroll>

                        <RevealOnScroll delay={100}>
                            <div className="list-stats">
                                <div className="list-stat">
                                    <span className="list-stat-value mono">
                                        {isLoading ? "--" : stats.updates}
                                    </span>
                                    <span className="list-stat-label">Total Signals</span>
                                </div>
                                <div className="list-stat">
                                    <span className="list-stat-value mono">
                                        {isLoading ? "--" : stats.results}
                                    </span>
                                    <span className="list-stat-label">Results Live</span>
                                </div>
                                <div className="list-stat">
                                    <span className="list-stat-value mono">
                                        {isLoading ? "--" : stats.admitCards}
                                    </span>
                                    <span className="list-stat-label">Admit Cards</span>
                                </div>
                            </div>
                        </RevealOnScroll>

                        <RevealOnScroll delay={200}>
                            <IntelligenceTicker items={news} />
                        </RevealOnScroll>
                    </div>
                </Container>
            </section>

            <section className="priority-highlight-section pt-12">
                <Container>
                    {prioritySignal && (
                        <RevealOnScroll>
                            <PriorityUpdate item={prioritySignal} />
                        </RevealOnScroll>
                    )}
                </Container>
            </section>

            <section className="list-filters-section">
                <Container>
                    <GlassPanel className="filters-panel" variant="strong">
                        <div className="filter-search">
                            <Search size={18} className="filter-search-icon" />
                            <input
                                type="search"
                                className="filter-search-input"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search updates by keyword..."
                            />
                        </div>

                        <div className="category-tabs-row">
                            <div className="tabs-scroll">
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        className={`category-tab ${activeTab === cat ? 'active' : ''}`}
                                        onClick={() => setActiveTab(cat)}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="filter-meta">
                            <div className="sync-status">
                                <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                                <span className="text-[0.75rem] font-semibold text-slate-500 italic">
                                    {hasMounted && lastUpdate 
                                        ? `Last synced: ${lastUpdate.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}` 
                                        : 'Connecting to nodes...'}
                                </span>
                            </div>
                            <span className="filter-count">
                                Tracking <strong>{filteredNews.length}</strong> active intelligence signals
                            </span>
                        </div>
                    </GlassPanel>
                </Container>
            </section>

            <section className="list-results">
                <Container>
                    {isLoading ? (
                        <div className="results-grid">
                            <CardSkeleton count={9} />
                        </div>
                    ) : error ? (
                        <EmptyState icon="⚠️" title="Signal Link Interrupted" description={error} />
                    ) : (
                        <div className="results-grid">
                            {displaySignals.map((item, index) => (
                                <RevealOnScroll key={`${item.id}-${index}`} delay={index * 30}>
                                    <NewsCard item={item} />
                                </RevealOnScroll>
                            ))}
                        </div>
                    )}
                </Container>
            </section>

            <style jsx>{`
                .list-hero--news .hero-orb--1 {
                    background: radial-gradient(circle, rgba(99, 102, 241, 0.25) 0%, transparent 70%);
                }
                .list-hero--news .hero-orb--2 {
                    background: radial-gradient(circle, rgba(236, 72, 153, 0.15) 0%, transparent 70%);
                }

                .category-tabs-row {
                    border-top: 1px solid rgba(0, 0, 0, 0.03);
                    padding-top: 20px;
                    margin-top: 4px;
                }

                .tabs-scroll {
                    display: flex;
                    gap: 8px;
                    overflow-x: auto;
                    scrollbar-width: none;
                }
                .tabs-scroll::-webkit-scrollbar { display: none; }

                .category-tab {
                    padding: 10px 20px;
                    border-radius: 12px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: var(--color-ink-muted);
                    background: rgba(255, 255, 255, 0.4);
                    border: 1px solid rgba(0, 0, 0, 0.05);
                    cursor: pointer;
                    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    white-space: nowrap;
                }

                .category-tab:hover {
                    background: white;
                    color: var(--color-accent);
                    border-color: rgba(99, 102, 241, 0.2);
                }

                .category-tab.active {
                    background: var(--color-ink);
                    color: white;
                    border-color: var(--color-ink);
                    transform: scale(1.05);
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
                }

                .sync-status {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: #64748b;
                }

                .filter-meta {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding-top: 16px;
                    border-top: 1px solid rgba(0, 0, 0, 0.03);
                }

                .results-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
                    gap: 32px;
                }

                @media (max-width: 768px) {
                    .results-grid { grid-template-columns: 1fr; }
                    .filter-meta { flex-direction: column; gap: 12px; align-items: flex-start; }
                }
            `}</style>
        </div>
    );
}
