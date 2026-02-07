"use client";

import { useEffect, useMemo, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Card from "@/components/Card";
import Container from "@/components/Container";
import GlassPanel from "@/components/GlassPanel";
import Button from "@/components/Button";
import FancySelect from "@/components/FancySelect";
import EmptyState from "@/components/EmptyState";
import { CardSkeleton } from "@/components/Skeleton";
import Pagination from "@/components/Pagination";
import FavoriteButton from "@/components/FavoriteButton";
import { RevealOnScroll } from "@/lib/useIntersectionObserver";
import { fetchColleges, fetchFilters, suggest } from "@/lib/api";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import "./page.css";

const getDistrict = (college) =>
    college?.meta?.district || college?.location?.split(",")[0]?.trim() || "Unknown";

const getState = (college) => {
    if (!college?.location) return null;
    const parts = college.location.split(",").map((p) => p.trim());
    return parts[parts.length - 1];
};

// Calculate popularity score based on exams count and ranking
const getPopularityScore = (college) => {
    const examsCount = (college.acceptedExams || []).length;
    const tierScore = college.rankingTier?.toLowerCase().includes("tier 1") ? 3 :
        college.rankingTier?.toLowerCase().includes("tier 2") ? 2 :
            college.rankingTier?.toLowerCase().includes("tier 3") ? 1 : 0;
    return examsCount + (tierScore * 2);
};

const SORT_OPTIONS = ["Most Popular", "Relevance", "Name A-Z", "Name Z-A", "Top Tier", "Most Exams"];

function CollegesContent() {
    const searchParams = useSearchParams();
    const stateFilter = searchParams.get("state");

    const [colleges, setColleges] = useState([]);
    const [filterOptions, setFilterOptions] = useState({
        districts: ["All"],
        courses: ["All"],
        tiers: ["All"]
    });
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [query, setQuery] = useState("");
    const [sortBy, setSortBy] = useState("Most Popular");
    const [filters, setFilters] = useState({
        district: "All",
        course: "All",
        tier: "All",
    });

    const router = useRouter();
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const ITEMS_PER_PAGE = 18;

    // Initialize state from URL params
    useEffect(() => {
        const q = searchParams.get("q") || "";
        const district = searchParams.get("district") || "All";
        const course = searchParams.get("course") || "All";
        const tier = searchParams.get("tier") || "All";
        const sort = searchParams.get("sortBy") || "Most Popular";
        const p = parseInt(searchParams.get("page")) || 1;

        setQuery(q);
        setFilters({ district, course, tier });
        setSortBy(sort);
        setPage(p);
    }, [searchParams]);

    // Sync state to URL
    useEffect(() => {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (filters.district !== "All") params.set("district", filters.district);
        if (filters.course !== "All") params.set("course", filters.course);
        if (filters.tier !== "All") params.set("tier", filters.tier);
        if (sortBy !== "Most Popular") params.set("sortBy", sortBy);
        if (page > 1) params.set("page", page.toString());
        if (stateFilter) params.set("state", stateFilter);

        router.replace(`?${params.toString()}`, { scroll: false });
    }, [query, filters, sortBy, page, stateFilter, router]);

    // Load filter options once
    useEffect(() => {
        const loadFilters = async () => {
            try {
                const data = await fetchFilters();
                setFilterOptions({
                    districts: ["All", ...data.districts],
                    courses: ["All", ...data.courses],
                    tiers: ["All", ...data.tiers]
                });
            } catch (err) {
                console.error("Failed to load filters", err);
            }
        };
        loadFilters();
    }, []);

    useEffect(() => {
        const load = async () => {
            setIsLoading(true);
            try {
                const params = { page, limit: ITEMS_PER_PAGE };

                if (sortBy === "Name A-Z") {
                    params.sortBy = "name";
                    params.order = "asc";
                } else if (sortBy === "Name Z-A") {
                    params.sortBy = "name";
                    params.order = "desc";
                } else if (sortBy === "Top Tier") {
                    params.sortBy = "tier";
                    params.order = "desc";
                } else if (sortBy === "Most Exams") {
                    params.sortBy = "exams";
                    params.order = "desc";
                }

                if (query) params.q = query;
                if (filters.district !== "All") params.district = filters.district;

                const response = await fetchColleges(params);

                if (response.data && response.pagination) {
                    setColleges(response.data);
                    setPagination(response.pagination);
                } else {
                    const data = Array.isArray(response) ? response : [];
                    setColleges(data);
                    setPagination({
                        page: 1,
                        totalPages: 1,
                        totalCount: data.length,
                        hasNext: false,
                        hasPrev: false,
                    });
                }
                setSuggestions([]);
            } catch (err) {
                console.error("Failed to load colleges", err);
                setError("Failed to load colleges. Please try again.");

                // If search failed or empty, try suggestions
                if (query) {
                    try {
                        const suggs = await suggest({ q: query });
                        setSuggestions(suggs);
                    } catch (e) {
                        // ignore suggestion error
                    }
                }
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [page, query, sortBy, filters.district]);



    // Apply client-side filters and sorting
    const displayColleges = useMemo(() => {
        let filtered = colleges.filter((college) => {
            const matchesCourse =
                filters.course === "All" ||
                (college.courses || []).some((course) => course?.name === filters.course);
            const matchesTier =
                filters.tier === "All" ||
                (college.rankingTier || college.ranking) === filters.tier;
            return matchesCourse && matchesTier;
        });

        // Sort by popularity if selected
        if (sortBy === "Most Popular") {
            filtered = [...filtered].sort((a, b) => getPopularityScore(b) - getPopularityScore(a));
        }

        return filtered;
    }, [colleges, filters.course, filters.tier, sortBy]);

    const stateName = useMemo(() => {
        if (!stateFilter) return null;
        // Just format the state filter for display
        return stateFilter.split('-').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }, [stateFilter]);

    const handleFilterChange = useCallback((id, value) => {
        setFilters((prev) => ({ ...prev, [id]: value }));
        setPage(1);
    }, []);

    const handleSortChange = useCallback((value) => {
        setSortBy(value);
        setPage(1);
    }, []);

    const handleSearchChange = useCallback((e) => {
        setQuery(e.target.value);
        setPage(1);
    }, []);

    const clearFilters = useCallback(() => {
        setQuery("");
        setSortBy("Most Popular");
        setFilters({ district: "All", course: "All", tier: "All" });
        setPage(1);
    }, []);

    const hasActiveFilters =
        query ||
        sortBy !== "Most Popular" ||
        filters.district !== "All" ||
        filters.course !== "All" ||
        filters.tier !== "All";

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

        if (displayColleges.length === 0) {
            return (
                <EmptyState
                    icon="🏫"
                    title="No colleges found"
                    description={
                        hasActiveFilters
                            ? "Try adjusting your search or filters"
                            : "No colleges available at the moment"
                    }
                    actionLabel={hasActiveFilters ? "Clear Filters" : undefined}
                    onAction={hasActiveFilters ? clearFilters : undefined}
                >
                    {suggestions.length > 0 && (
                        <div className="mt-4 text-center">
                            <p className="text-gray-600 mb-2">Did you mean?</p>
                            <div className="flex gap-2 justify-center flex-wrap">
                                {suggestions.map((s, i) => (
                                    <button
                                        key={i}
                                        onClick={() => {
                                            setQuery(s.text || s);
                                            setPage(1);
                                        }}
                                        className="text-blue-600 hover:underline bg-blue-50 px-3 py-1 rounded-full text-sm"
                                    >
                                        {s.text || s}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </EmptyState>
            );
        }

        return (
            <>
                <div className="results-grid">
                    {displayColleges.map((college, index) => (
                        <RevealOnScroll key={college.id} delay={index * 30}>
                            <div className="card-wrapper">
                                <FavoriteButton
                                    type="colleges"
                                    id={college.id}
                                    item={college}
                                    size="sm"
                                    className="card-favorite"
                                />
                                <Card
                                    type="college"
                                    title={college.shortName || college.name}
                                    subtitle={college.location}
                                    tags={(college.acceptedExams || [])
                                        .slice(0, 3)
                                        .map((exam) => exam.toUpperCase())}
                                    meta={[
                                        college.rankingTier || college.ranking,
                                        college.meta?.ownership,
                                    ].filter(Boolean)}
                                    href={`/college/${college.id}`}
                                />
                            </div>
                        </RevealOnScroll>
                    ))}
                </div>
                {!stateFilter && pagination && pagination.totalPages > 1 && (
                    <Pagination
                        page={pagination.page}
                        totalPages={pagination.totalPages}
                        hasNext={pagination.hasNext}
                        hasPrev={pagination.hasPrev}
                        onPageChange={setPage}
                    />
                )}
            </>
        );
    };

    return (
        <div className="list-page">
            <section className="list-hero list-hero--colleges">
                <div className="list-hero-bg" aria-hidden="true">
                    <div className="hero-orb hero-orb--1" />
                    <div className="hero-orb hero-orb--2" />
                </div>

                <Container>
                    <div className="list-hero-content">
                        <RevealOnScroll>
                            <span className="list-hero-kicker">
                                {stateName ? `Colleges in ${stateName}` : "State Catalog"}
                            </span>
                            <h1 className="list-hero-title">
                                {stateName ? `${stateName} Colleges` : "Colleges, organized for clarity"}
                            </h1>
                            <p className="list-hero-subtitle">
                                {stateName
                                    ? `Explore ${displayColleges.length} colleges in ${stateName} with verified data on programs, exams, and rankings.`
                                    : "Explore colleges with structured programs, exams, and tiers in a clean interface."}
                            </p>
                        </RevealOnScroll>

                        <RevealOnScroll delay={100}>
                            <div className="list-stats">
                                <div className="list-stat">
                                    <span className="list-stat-value mono">
                                        {displayColleges.length || "--"}
                                    </span>
                                    <span className="list-stat-label">
                                        {stateName ? "Colleges" : "Districts"}
                                    </span>
                                </div>

                                {!stateName && (
                                    <div className="list-stat">
                                        <span className="list-stat-value mono">
                                            {pagination?.totalCount || colleges.length || "--"}
                                        </span>
                                        <span className="list-stat-label">Colleges</span>
                                    </div>
                                )}
                            </div>
                        </RevealOnScroll>
                    </div>
                </Container>
            </section>

            <section className="list-filters-section">
                <Container>
                    <GlassPanel className="filters-panel" variant="strong">
                        <div className="filter-search">
                            <svg
                                className="filter-search-icon"
                                width="18"
                                height="18"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                aria-hidden="true"
                            >
                                <circle cx="11" cy="11" r="8" />
                                <path d="m21 21-4.35-4.35" />
                            </svg>
                            <input
                                type="search"
                                className="filter-search-input"
                                value={query}
                                onChange={handleSearchChange}
                                placeholder="Search by college, district, or program"
                            />
                        </div>

                        <div className="filter-row">
                            <FancySelect
                                label="District"
                                value={filters.district}
                                options={filterOptions.districts}
                                onChange={(val) => handleFilterChange("district", val)}
                            />
                            <FancySelect
                                label="Course"
                                value={filters.course}
                                options={filterOptions.courses}
                                onChange={(val) => handleFilterChange("course", val)}
                            />
                            <FancySelect
                                label="Tier"
                                value={filters.tier}
                                options={filterOptions.tiers}
                                onChange={(val) => handleFilterChange("tier", val)}
                            />
                            <FancySelect
                                label="Sort"
                                value={sortBy}
                                options={SORT_OPTIONS}
                                onChange={handleSortChange}
                                searchable={false}
                            />
                        </div>

                        <div className="filter-meta">
                            <span className="filter-count">
                                Showing <strong>{displayColleges.length}</strong> of{" "}
                                <strong>{pagination?.totalCount || colleges.length}</strong>{" "}
                                colleges
                                {!stateFilter && pagination && pagination.totalPages > 1 && (
                                    <>
                                        {" "}
                                        • Page {pagination.page} of {pagination.totalPages}
                                    </>
                                )}
                            </span>
                            {hasActiveFilters && (
                                <Button variant="secondary" onClick={clearFilters}>
                                    Reset filters
                                </Button>
                            )}
                        </div>
                    </GlassPanel>
                </Container>
            </section>

            <section className="list-results">
                <Container>{renderContent()}</Container>
            </section>
        </div>
    );
}

export default function CollegesClient() {
    return (
        <Suspense fallback={
            <div className="list-page">
                <Container>
                    <div className="results-grid">
                        <CardSkeleton count={6} />
                    </div>
                </Container>
            </div>
        }>
            <CollegesContent />
        </Suspense>
    );
}
