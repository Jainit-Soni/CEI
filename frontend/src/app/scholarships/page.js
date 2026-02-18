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
import { fetchScholarships } from "@/lib/api";
// Shared CSS to ensure perfect harmonization
import "../colleges/page.css";

export default function ScholarshipsPage() {
    const [scholarships, setScholarships] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    // Removed query state as per user request
    const [filters, setFilters] = useState({
        category: "All",
        provider: "All",
    });
    const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);

    useEffect(() => {
        const load = async () => {
            try {
                setError(null);
                const data = await fetchScholarships();
                setScholarships(Array.isArray(data) ? data : []);
            } catch (err) {
                console.error("Failed to load scholarships", err);
                setError("Failed to load scholarships. Please try again.");
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, []);

    const categoryOptions = useMemo(() => {
        const unique = new Set(scholarships.map((s) => s.category).filter(Boolean));
        return ["All", ...Array.from(unique)];
    }, [scholarships]);

    const providerOptions = useMemo(() => {
        const unique = new Set(scholarships.map((s) => s.provider).filter(Boolean));
        return ["All", ...Array.from(unique)];
    }, [scholarships]);

    const filteredScholarships = useMemo(() => {
        return scholarships.filter((s) => {
            const matchesCategory = filters.category === "All" || s.category === filters.category;
            const matchesProvider = filters.provider === "All" || s.provider === filters.provider;
            return matchesCategory && matchesProvider;
        });
    }, [scholarships, filters]);

    const handleFilterChange = (id, value) => {
        setFilters((prev) => ({ ...prev, [id]: value }));
    };

    const clearFilters = () => {
        setFilters({ category: "All", provider: "All" });
    };

    const hasActiveFilters = filters.category !== "All" || filters.provider !== "All";

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

        if (filteredScholarships.length === 0) {
            return (
                <EmptyState
                    icon="🎓"
                    title="No scholarships found"
                    description={hasActiveFilters
                        ? "Try adjusting your filters"
                        : "No scholarships available at the moment"}
                    actionLabel={hasActiveFilters ? "Clear Filters" : undefined}
                    onAction={hasActiveFilters ? clearFilters : undefined}
                />
            );
        }

        return (
            <div className="results-grid">
                {filteredScholarships.map((scholarship, index) => (
                    <RevealOnScroll key={scholarship.id} delay={index * 40}>
                        <div className="card-wrapper">
                            <Card
                                type="scholarship"
                                title={scholarship.name}
                                subtitle={scholarship.provider}
                                tags={[scholarship.category, scholarship.amount]}
                                meta={`Deadline: ${scholarship.deadline}`}
                                href={`/scholarship/${scholarship.id}`}
                            />
                        </div>
                    </RevealOnScroll>
                ))}
            </div>
        );
    };

    return (
        <div className="list-page">
            <section className="list-hero list-hero--scholarships">
                <div className="list-hero-bg" aria-hidden="true">
                    <div className="hero-orb hero-orb--1" />
                    <div className="hero-orb hero-orb--2" />
                </div>

                <Container>
                    <div className="list-hero-content">
                        <RevealOnScroll>
                            <span className="list-hero-kicker">Financial Aid</span>
                            <h1 className="list-hero-title">Scholarships, Grants & Aid</h1>
                            <p className="list-hero-subtitle">
                                Discover funding opportunities to support your education journey, filtered for your needs.
                            </p>
                        </RevealOnScroll>

                        {/* Stats */}
                        <RevealOnScroll delay={100}>
                            <div className="list-stats">
                                <div className="list-stat">
                                    <span className="list-stat-value mono">{scholarships.length || "--"}</span>
                                    <span className="list-stat-label">Grants</span>
                                </div>
                                <div className="list-stat">
                                    <span className="list-stat-value mono">₹{scholarships.reduce((acc, curr) => acc + (parseInt(curr.amount?.replace(/[^0-9]/g, '')) || 0), 0).toLocaleString()}</span>
                                    <span className="list-stat-label">Total Value</span>
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
                        <span>{isMobileFiltersOpen ? "Hide Filters" : "Filter Scholarships"}</span>
                    </div>
                    <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-3 py-1 rounded-full">
                        {filteredScholarships.length} Results
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

                        {/* Removed Search Input as requested */}

                        <div className="filter-row">
                            <FancySelect
                                label="Category"
                                value={filters.category}
                                options={categoryOptions}
                                onChange={(val) => handleFilterChange("category", val)}
                            />
                            <FancySelect
                                label="Provider"
                                value={filters.provider}
                                options={providerOptions}
                                onChange={(val) => handleFilterChange("provider", val)}
                            />
                        </div>

                        <div className="filter-meta">
                            <span className="filter-count">
                                Showing <strong>{filteredScholarships.length}</strong> matches
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
