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
import { fetchColleges, fetchFilters, suggest, fetchStateStats } from "@/lib/api";
import { useRouter } from "next/navigation";
import Link from "next/link";
import IndiaMap from "@/components/IndiaMap";
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
        state: "All",
        district: "All",
        course: "All",
        tier: "All",
    });

    const router = useRouter();
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const [mapStatsData, setMapStatsData] = useState({ states: [] });
    const [viewMode, setViewMode] = useState("list"); // 'list' only
    const ITEMS_PER_PAGE = 18;

    // Initialize state from URL params
    useEffect(() => {
        const q = searchParams.get("q") || "";
        const state = searchParams.get("state") || "All";
        const district = searchParams.get("district") || "All";
        const course = searchParams.get("course") || "All";
        const tier = searchParams.get("tier") || "All";
        const sort = searchParams.get("sortBy") || "Most Popular";
        const p = parseInt(searchParams.get("page")) || 1;

        setQuery(q);
        setFilters({ state, district, course, tier });
        setSortBy(sort);
        setPage(p);
    }, [searchParams]);

    // Sync state to URL
    useEffect(() => {
        const params = new URLSearchParams();
        if (query) params.set("q", query);
        if (filters.state !== "All") params.set("state", filters.state);
        if (filters.district !== "All") params.set("district", filters.district);
        if (filters.course !== "All") params.set("course", filters.course);
        if (filters.tier !== "All") params.set("tier", filters.tier);
        if (sortBy !== "Most Popular") params.set("sortBy", sortBy);
        if (page > 1) params.set("page", page.toString());
        // If stateFilter exists but we haven't set a state yet, we should respect it
        // However, if we've explicitly set filters.state to "All", we should NOT re-add it
        if (stateFilter && filters.state === "All" && !params.has("state")) {
            // Only add if we aren't explicitly clearing it
        }

        router.replace(`?${params.toString()}`, { scroll: false });
    }, [query, filters, sortBy, page, stateFilter, router]);

    // Load filter options based on active filters
    useEffect(() => {
        const loadFilters = async () => {
            try {
                const params = {};
                if (filters.state !== "All") params.state = filters.state;
                if (filters.district !== "All") params.district = filters.district;
                if (filters.course !== "All") params.course = filters.course;
                if (filters.tier !== "All") params.tier = filters.tier;
                if (query) params.q = query;

                const data = await fetchFilters(params);
                setFilterOptions({
                    states: ["All", ...(data?.states || [])],
                    districts: ["All", ...(data?.districts || [])],
                    courses: ["All", ...(data?.courses || [])],
                    tiers: ["All", ...(data?.tiers || [])]
                });
            } catch (err) {
                console.error("Failed to load filters", err);
            }
        };
        loadFilters();
    }, [filters.state, filters.district, filters.course, filters.tier, query]);

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
                if (filters.course !== "All") params.course = filters.course;
                if (filters.tier !== "All") params.tier = filters.tier;

                const activeState = filters.state !== "All" ? filters.state : stateFilter;
                if (activeState) params.state = activeState;

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
    }, [page, query, sortBy, filters.state, filters.district, filters.course, filters.tier, stateFilter]);

    // Map stats removed as per user request



    // No more client-side filtering needed!
    const displayColleges = colleges;

    const stateName = useMemo(() => {
        if (!stateFilter) return null;
        // Just format the state filter for display
        return stateFilter.split('-').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    }, [stateFilter]);

    // Compute stats for map based on API data instead of filtered list
    const stateStats = useMemo(() => {
        const stats = {};
        if (!mapStatsData?.states) return stats;

        mapStatsData.states.forEach(state => {
            // Normalize state name keys
            const key = state.name.toLowerCase().replace(/\s+/g, "");
            stats[key] = {
                count: state.count,
                topColleges: state.topColleges || []
            };
        });
        return stats;
    }, [mapStatsData]);

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
        setFilters({ state: "All", district: "All", course: "All", tier: "All" });
        setPage(1);
        router.push("/colleges");
    }, [router]);

    const hasActiveFilters =
        query ||
        sortBy !== "Most Popular" ||
        filters.state !== "All" ||
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

        const mentorMode = searchParams.get("mentor") === "true";
        const userRank = parseInt(searchParams.get("rank"));

        const getMatchStatus = (college) => {
            if (!mentorMode || !userRank) return null;

            // Look for cutoff data in pastCutoffs
            // For simplicity, we find the first available cutoff value
            let cutoffVal = null;
            if (college.pastCutoffs && college.pastCutoffs.length > 0) {
                const firstCutoff = college.pastCutoffs[0].cutoff;
                // Parse rank from "Branch: Rank | Branch: Rank" format
                const match = firstCutoff.match(/:\s*(\d+)/);
                if (match) cutoffVal = parseInt(match[1]);
            }

            if (!cutoffVal) return null;

            if (userRank <= cutoffVal * 0.8) return { text: "Safe 🛡️", color: "#10b981" };
            if (userRank <= cutoffVal * 1.2) return { text: "Match 🎯", color: "#f59e0b" };
            return { text: "Dream ✨", color: "#6366f1" };
        };

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
                                    badge={getMatchStatus(college)}
                                    tags={(college.acceptedExams || [])
                                        .slice(0, 3)
                                        .map((exam) => exam.toUpperCase())}
                                    meta={[
                                        college.rankingTier || college.ranking,
                                        college.meta?.ownership,
                                    ].filter(Boolean)}
                                    href={`/college/${college.id}`}
                                    trust={{
                                        source: college.source || "Official Website",
                                        lastUpdated: college.lastUpdated || new Date().toISOString()
                                    }}
                                />
                            </div>
                        </RevealOnScroll>
                    ))}
                </div>
                {pagination && pagination.totalPages > 1 && (
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
                                        {pagination?.totalCount || displayColleges.length || "--"}
                                    </span>
                                    <span className="list-stat-label">
                                        Colleges
                                    </span>
                                </div>
                            </div>
                        </RevealOnScroll>
                    </div>
                </Container>
            </section>

            <section className="list-filters-section">
                <Container>
                    <GlassPanel className="filters-panel" variant="strong">
                        <div className="filter-search">
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
                                label="State"
                                value={filters.state}
                                options={filterOptions.states}
                                onChange={(val) => handleFilterChange("state", val)}
                            />
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
                        </div>

                        <div className="filter-meta">
                            <span className="filter-count">
                                Showing <strong>{displayColleges.length}</strong> {pagination?.totalCount > displayColleges.length ? `of ${pagination.totalCount}` : ""} Results
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
                <Container>
                    {renderContent()}
                </Container>
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
