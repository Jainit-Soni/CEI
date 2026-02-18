"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import Container from "@/components/Container";
import GlassPanel from "@/components/GlassPanel";
import Button from "@/components/Button";
import FancySelect from "@/components/FancySelect";
import EmptyState from "@/components/EmptyState";
import { CardSkeleton } from "@/components/Skeleton";
import { RevealOnScroll } from "@/lib/useIntersectionObserver";
import { fetchNews } from "@/lib/api";
import "../colleges/page.css";

export default function NewsPage() {
    const [news, setNews] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [query, setQuery] = useState("");
    const [filters, setFilters] = useState({
        category: "All",
    });
    const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                setError(null);
                const data = await fetchNews();
                setNews(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error("Failed to load news", err);
                setError("Failed to load news. Please try again.");
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const categoryOptions = useMemo(() => {
        const unique = new Set(news.map((item) => item.category).filter(Boolean));
        return ["All", ...Array.from(unique)];
    }, [news]);

    const filteredNews = useMemo(() => {
        const normalized = query.toLowerCase();
        return news.filter((item) => {
            const matchesQuery = `${item.title} ${item.summary}`.toLowerCase().includes(normalized);
            const matchesCategory = filters.category === "All" || item.category === filters.category;
            return matchesQuery && matchesCategory;
        });
    }, [news, query, filters]);

    const handleFilterChange = (id, value) => {
        setFilters((prev) => ({ ...prev, [id]: value }));
    };

    const clearFilters = () => {
        setQuery("");
        setFilters({ category: "All" });
    };

    const hasActiveFilters = query || filters.category !== "All";

    const renderContent = () => {
        if (isLoading) {
            return (
                <div className="results-grid">
                    <CardSkeleton count={6} />
                </div>
            );
        }

        if (error) {
            return (
                <div className="error-state">
                    <EmptyState
                        icon="⚠️"
                        title="Something went wrong"
                        description={error}
                        actionLabel="Try Again"
                        onAction={() => window.location.reload()}
                    />
                </div>
            );
        }

        if (filteredNews.length === 0) {
            return (
                <EmptyState
                    icon="📰"
                    title="No news found"
                    description={"Try adjusting your search criteria"}
                    actionLabel={hasActiveFilters ? "Clear Filters" : undefined}
                    onAction={hasActiveFilters ? clearFilters : undefined}
                />
            );
        }

        return (
            <div className="results-grid">
                {filteredNews.map((item, index) => (
                    <RevealOnScroll key={item.id} delay={index * 40}>
                        <div className="card-wrapper">
                            <Card
                                type="news"
                                title={item.title}
                                subtitle={item.summary}
                                tags={[item.category]}
                                meta={[`Date: ${new Date(item.date).toLocaleDateString()}`, item.source]}
                                href="#"
                            />
                        </div>
                    </RevealOnScroll>
                ))}
            </div>
        );
    };

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
                            <h1 className="list-hero-title">Latest Educational News</h1>
                            <p className="list-hero-subtitle">
                                Stay informed with the most critical updates on exams, admissions, and policy changes.
                            </p>
                        </RevealOnScroll>

                        <RevealOnScroll delay={100}>
                            <div className="list-stats">
                                <div className="list-stat">
                                    <span className="list-stat-value mono">{news.length || "--"}</span>
                                    <span className="list-stat-label">Updates</span>
                                </div>
                            </div>
                        </RevealOnScroll>
                    </div>
                </Container>
            </section>

            {/* Mobile Filter Toggle */}
            <div className="mobile-filter-toggle-container">
                <Button
                    variant="secondary"
                    className="w-full justify-between"
                    onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
                >
                    <div className="flex items-center gap-2">
                        <span>{isMobileFiltersOpen ? "Hide Filters" : "Filter News"}</span>
                    </div>
                    <span className="text-xs bg-rose-100 text-rose-700 font-bold px-3 py-1 rounded-full">
                        {filteredNews.length} Results
                    </span>
                </Button>
            </div>

            <section className={`list-filters-section ${isMobileFiltersOpen ? "mobile-open" : ""}`}>
                <Container>
                    <GlassPanel className="filters-panel" variant="strong">
                        {/* Mobile Header */}
                        <div className="mobile-filter-header">
                            <h3>Filters</h3>
                            <button className="filter-close-btn" onClick={() => setIsMobileFiltersOpen(false)}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
                            </button>
                        </div>

                        <div className="filter-search">
                            <svg className="filter-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                            <input
                                type="search"
                                className="filter-search-input"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Search headlines..."
                            />
                        </div>

                        <div className="filter-row">
                            <FancySelect
                                label="Category"
                                value={filters.category}
                                options={categoryOptions}
                                onChange={(val) => handleFilterChange("category", val)}
                            />
                        </div>

                        <div className="filter-meta">
                            <span className="filter-count">
                                Showing <strong>{filteredNews.length}</strong> updates
                            </span>
                            {hasActiveFilters && (
                                <Button variant="secondary" onClick={clearFilters}>Reset filters</Button>
                            )}
                        </div>

                        {/* Mobile Sticky Actions */}
                        <div className="mobile-filter-actions">
                            <Button variant="secondary" className="flex-1" onClick={clearFilters}>Clear All</Button>
                            <Button className="flex-1" onClick={() => setIsMobileFiltersOpen(false)}>Apply Filters</Button>
                        </div>
                    </GlassPanel>
                </Container>
            </section>

            <section className="list-results">
                <Container>
                    {renderContent()}
                </Container>
            </section>
        </div>
    );
}
