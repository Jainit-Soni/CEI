"use client";

import { useEffect, useMemo, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Card from "@/components/Card";
import Container from "@/components/Container";
import GlassPanel from "@/components/GlassPanel";
import Button from "@/components/Button";
import FancySelect from "@/components/FancySelect";
import EmptyState from "@/components/EmptyState";
import SearchWithSuggestions from "@/components/SearchWithSuggestions";
import { Heart, Search } from "lucide-react";
import { CardSkeleton } from "@/components/Skeleton";
import Pagination from "@/components/Pagination";
import FavoriteButton from "@/components/FavoriteButton";
import { RevealOnScroll } from "@/lib/useIntersectionObserver";
import { fetchColleges, fetchFilters, suggest, fetchStateStats } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";
import dynamic from "next/dynamic";

// Performance: Heavy map loaded lazily
const IndiaMap = dynamic(() => import("@/components/IndiaMap"), {
    ssr: false,
    loading: () => (
        <div className="india-map-loading skeleton" style={{ borderRadius: '24px', minHeight: '500px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
            <p style={{ color: '#fff', opacity: 0.5, letterSpacing: '2px', textTransform: 'uppercase', fontSize: '0.85rem' }}>Initializing Cartography...</p>
        </div>
    )
});
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

const SORT_OPTIONS = ["Highest Placement", "Most Popular", "Top Tier", "Name A-Z", "Name Z-A", "Most Exams"];

const DEFAULT_SORT_TOKEN = "placement";

const SORT_LABEL_TO_TOKEN = {
    "Highest Placement": "placement",
    "Most Popular": "popularity",
    "Top Tier": "tier",
    "Name A-Z": "name_asc",
    "Name Z-A": "name_desc",
    "Most Exams": "exams",
};

const SORT_TOKEN_TO_LABEL = Object.fromEntries(
    Object.entries(SORT_LABEL_TO_TOKEN).map(([label, token]) => [token, label])
);

function coerceSortToken(raw) {
    if (!raw) return DEFAULT_SORT_TOKEN;
    const v = String(raw).trim();

    // New stable tokens
    if (SORT_TOKEN_TO_LABEL[v]) return v;

    // Legacy: URL stored UI label (e.g., "Highest Placement")
    if (SORT_LABEL_TO_TOKEN[v]) return SORT_LABEL_TO_TOKEN[v];

    // Legacy: URL stored backend-ish sortBy (e.g., "placement", "popularity", "tier", "name")
    if (v === "placement") return "placement";
    if (v === "popularity") return "popularity";
    if (v === "tier") return "tier";
    if (v === "exams") return "exams";
    if (v === "name") return "name_asc";

    return DEFAULT_SORT_TOKEN;
}

function buildApiSortParams(sortToken) {
    switch (sortToken) {
        case "name_asc":
            return { sortBy: "name", order: "asc" };
        case "name_desc":
            return { sortBy: "name", order: "desc" };
        case "tier":
            return { sortBy: "tier", order: "desc" };
        case "exams":
            return { sortBy: "exams", order: "desc" };
        case "popularity":
            return { sortBy: "popularity", order: "desc" };
        case "placement":
        default:
            return { sortBy: "placement", order: "desc" };
    }
}

function normalizeDidYouMeanSuggestions(raw) {
    if (!Array.isArray(raw)) return [];
    return raw
        .map((item) => {
            if (!item) return null;
            if (typeof item === "string") return item.trim() || null;
            if (typeof item === "object") {
                const label =
                    item.text ||
                    item.name ||
                    item.shortName ||
                    item.fullName ||
                    item.title;
                return label ? String(label).trim() : null;
            }
            return null;
        })
        .filter(Boolean)
        .slice(0, 8);
}

function CollegesContent({ initialData }) {
    const searchParams = useSearchParams();
    const stateFilter = searchParams.get("state");

    const [colleges, setColleges] = useState(initialData?.data || []);
    const [filterOptions, setFilterOptions] = useState({
        districts: ["All"],
        courses: ["All"],
        tiers: ["All"],
        bands: ["All"],
        coreOptions: ["All", "Core Only"]
    });
    // Deployment Hardening: If we have searchParams, we MUST wait for the effect to sync them
    const hasUrlParams = searchParams.toString().length > 0;
    const [isLoading, setIsLoading] = useState(hasUrlParams); 
    const [error, setError] = useState(null);
    const [query, setQuery] = useState("");
    const [sortToken, setSortToken] = useState(DEFAULT_SORT_TOKEN);
    const [filters, setFilters] = useState({
        state: "All",
        district: "All",
        course: "All",
        tier: "All",
        band: "All",
        coverage: "All",
        isCore: "All"
    });

    const router = useRouter();
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState(initialData?.pagination || null);
    const [suggestions, setSuggestions] = useState([]);
    const [mapStatsData, setMapStatsData] = useState({ states: [] });
    const [isInitialized, setIsInitialized] = useState(false);
    const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState(false);
    const ITEMS_PER_PAGE = 18;

    // Lock body scroll when mobile filters are open
    useEffect(() => {
        if (!isMobileFiltersOpen) return;
        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [isMobileFiltersOpen]);

    // Initialize state from URL params
    useEffect(() => {
        const q = searchParams.get("q") || "";
        const state = searchParams.get("state") || "All";
        const district = searchParams.get("district") || "All";
        const course = searchParams.get("course") || "All";
        const tier = searchParams.get("tier") || "All";
        const band = searchParams.get("band") || "All";
        const sort = searchParams.get("sort") || searchParams.get("sortBy") || DEFAULT_SORT_TOKEN;
        const p = parseInt(searchParams.get("page")) || 1;

        const coverage = searchParams.get("coverage") || "All";
        const isCore = searchParams.get("isCore") || "All";

        setQuery(q);
        setFilters({ state, district, course, tier, band, coverage, isCore });
        setSortToken(coerceSortToken(sort));
        setPage(p);
        setIsInitialized(true);
    }, [searchParams]);

    // Sync state to URL
    useEffect(() => {
        if (!isInitialized) return;

        const params = new URLSearchParams();
        if (query) params.set("q", query);

        if (filters.state !== "All") {
            params.set("state", filters.state);
        }

        if (filters.district !== "All") params.set("district", filters.district);
        if (filters.course !== "All") params.set("course", filters.course);
        if (filters.tier !== "All") params.set("tier", filters.tier);
        if (filters.band !== "All") params.set("band", filters.band);
        if (filters.coverage !== "All") params.set("coverage", filters.coverage);
        if (filters.isCore !== "All") params.set("isCore", filters.isCore);
        if (sortToken !== DEFAULT_SORT_TOKEN) params.set("sort", sortToken);
        if (page > 1) params.set("page", page.toString());

        router.replace(`?${params.toString()}`, { scroll: false });
    }, [query, filters, sortToken, page, router, isInitialized]);

    // Load filter options based on active filters (Debounced)
    useEffect(() => {
        const timer = setTimeout(() => {
            const loadFilters = async () => {
                try {
                    const params = {};
                    if (filters.state !== "All") params.state = filters.state;
                    if (filters.district !== "All") params.district = filters.district;
                    if (filters.course !== "All") params.course = filters.course;
                    if (filters.tier !== "All") params.tier = filters.tier;
                    if (filters.band !== "All") params.band = filters.band;
                    if (query) params.q = query;

                    const data = await fetchFilters(params);
                    setFilterOptions({
                        states: ["All", ...(data?.states || [])],
                        districts: ["All", ...(data?.districts || [])],
                        courses: ["All", ...(data?.courses || [])],
                        tiers: ["All", ...(data?.tiers || [])],
                        bands: ["All", ...(data?.bands || [])]
                    });
                } catch (err) {
                    console.error("Failed to load filters", err);
                }
            };
            loadFilters();
        }, 400); // 400ms debounce

        return () => clearTimeout(timer);
    }, [filters.state, filters.district, filters.course, filters.tier, filters.band, query]);

    const { user } = useAuth();

    useEffect(() => {
        const load = async () => {
            if (!isInitialized) return;

            setIsLoading(true);
            setError(null);
            try {
                const params = { page, limit: ITEMS_PER_PAGE };
                Object.assign(params, buildApiSortParams(sortToken));

                if (query) params.q = query;
                if (filters.state !== "All") params.state = filters.state;
                if (filters.district !== "All") params.district = filters.district;
                if (filters.course !== "All") params.course = filters.course;
                if (filters.tier !== "All") params.tier = filters.tier;
                if (filters.band !== "All") params.band = filters.band;
                if (filters.coverage !== "All") params.coverage = filters.coverage;
                if (filters.isCore === "Core Only") params.isCore = "true";
                if (user?.uid) params.uid = user.uid;
                
                // Force fresh scores by bypassing cache
                params._t = Date.now();

                const response = await fetchColleges(params);

                console.log(`[CEI][UI][catalog] Data received:`, {
                    count: response.data?.length,
                    total: response.pagination?.totalCount,
                    params
                });

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

                if (query) {
                    try {
                        const suggs = await suggest({ q: query });
                        setSuggestions(normalizeDidYouMeanSuggestions(suggs));
                    } catch (e) {}
                }
            } finally {
                setIsLoading(false);
            }
        };

        // Debounce search query changes specifically
        const delay = query ? 500 : 0;
        const timer = setTimeout(load, delay);
        return () => clearTimeout(timer);
    }, [page, query, sortToken, filters.state, filters.district, filters.course, filters.tier, filters.band, filters.isCore, stateFilter, isInitialized, user?.uid]);

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

    const handleFilterChange = useCallback((id, value) => {
        setFilters((prev) => {
            const newFilters = { ...prev, [id]: value };
            // Auto-reset district if state changes to avoid mismatched filters
            if (id === "state") {
                newFilters.district = "All";
            }
            return newFilters;
        });
        setPage(1);
    }, []);

    const handleSortChange = useCallback((value) => {
        setSortToken(coerceSortToken(value));
        setPage(1);
    }, []);

    const handleSearchChange = useCallback((value) => {
        setQuery(value);
        setPage(1);
    }, []);

    const clearFilters = useCallback(() => {
        setQuery("");
        setSortToken(DEFAULT_SORT_TOKEN);
        setFilters({ 
            state: "All", 
            district: "All", 
            course: "All", 
            tier: "All", 
            band: "All", 
            coverage: "All", 
            isCore: "All" 
        });
        setPage(1);
        setError(null);
        setSuggestions([]);
        setIsMobileFiltersOpen(false); // Close mobile panel
        router.push("/colleges");
    }, [router]);

    const hasActiveFilters =
        query ||
        sortToken !== DEFAULT_SORT_TOKEN ||
        filters.state !== "All" ||
        filters.district !== "All" ||
        filters.course !== "All" ||
        filters.tier !== "All" ||
        filters.band !== "All" ||
        filters.coverage !== "All" ||
        filters.isCore !== "All";

    const mentorMode = searchParams.get("mentor") === "true";
    const userRank = parseInt(searchParams.get("rank"));

    const formatPremiumText = (str) => {
        if (!str) return str;
        const clean = str.replace(/['"]/g, '').trim();
        return clean.split(/([\s,/-]+)/).map(part => {
            const upper = part.toUpperCase();
            if (/^[A-Z]{2,}$/i.test(part)) {
                const smallWords = ['OF', 'AND', 'THE', 'FOR', 'WITH', 'IN', 'ON', 'OR', 'AT', 'TO', 'BY', 'AM'];
                if (smallWords.includes(upper)) return part.toLowerCase();
                const acronyms = ['IIT', 'NIT', 'AIIMS', 'IIIT', 'IIM', 'BITS', 'VIT', 'MIT', 'UP', 'MP', 'HP', 'AP', 'TS', 'TN', 'KL', 'KA', 'MH', 'GJ', 'RJ', 'PB', 'HR', 'UK', 'JK', 'SNJB', 'B.TECH', 'B.E', 'M.TECH', 'MBA', 'PH.D'];
                if (acronyms.includes(upper)) return upper;
                return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
            }
            return part;
        }).join('');
    };

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
                                {stateName ? `Colleges in ${stateName} ` : "State Catalog"}
                            </span>
                            <h1 className="list-hero-title">
                                {stateName ? `${stateName} Colleges` : "Colleges, organized for clarity"}
                            </h1>
                            <p className="list-hero-subtitle">
                                {stateName
                                    ? `Explore ${displayColleges.length} colleges in ${stateName} with evaluated data on programs, exams, and rankings.`
                                    : "Explore colleges with structured programs, exams, and tiers in a clean interface."}
                            </p>
                        </RevealOnScroll>

                        <RevealOnScroll delay={100}>
                            <div className="list-stats">
                                <div className="list-stat">
                                    <span className="list-stat-value mono">
                                        {(pagination?.totalCount !== undefined) ? pagination.totalCount.toLocaleString() : (displayColleges.length ? displayColleges.length.toLocaleString() : "0")}
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

            {/* Mobile Filter Toggle */}
            <div className="mobile-filter-toggle-container">
                <Button
                    variant="secondary"
                    className="w-full justify-between"
                    onClick={() => setIsMobileFiltersOpen(!isMobileFiltersOpen)}
                >
                    <div className="flex items-center gap-2">
                        <span>{isMobileFiltersOpen ? "Hide Filters" : "Filter Colleges"}</span>
                    </div>
                    <span className="text-xs bg-blue-100 text-blue-700 font-bold px-3 py-1 rounded-full">
                        {pagination?.totalCount || displayColleges.length} Results
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
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>

                        <div className="filter-search-wrapper">
                            <SearchWithSuggestions
                                placeholder="Search by institution name..."
                                onSearch={(q) => { setQuery(q); setPage(1); }}
                                onChange={(q) => { setQuery(q); setPage(1); }}
                                initialValue={query}
                                hideScopes={true}
                                defaultScope="Colleges"
                                className="colleges-main-search"
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
                            <FancySelect
                                label="CEI Band"
                                value={filters.band}
                                options={filterOptions.bands}
                                onChange={(val) => handleFilterChange("band", val)}
                            />
                            <FancySelect
                                label="Core Registry"
                                value={filters.isCore}
                                options={filterOptions.coreOptions}
                                onChange={(val) => handleFilterChange("isCore", val)}
                            />
                        </div>

                        <div className="filter-meta">
                            <span className="filter-count">
                                <strong>{(pagination?.totalCount !== undefined) ? pagination.totalCount : displayColleges.length}</strong> Colleges Found Matching
                            </span>
                            {hasActiveFilters && (
                                <Button variant="secondary" onClick={clearFilters}>
                                    Reset filters
                                </Button>
                            )}
                        </div>

                        {/* Mobile Sticky Actions */}
                        <div className="mobile-filter-actions">
                            <Button
                                variant="secondary"
                                className="flex-1"
                                onClick={clearFilters}
                            >
                                Clear All
                            </Button>
                            <Button
                                className="flex-1"
                                onClick={() => {
                                    setIsMobileFiltersOpen(false);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                            >
                                Apply Filters
                            </Button>
                        </div>
                    </GlassPanel>
                </Container>
            </section>

            <section className="list-results">
                <Container>
                    {isLoading ? (
                        <div className="results-grid">
                            <CardSkeleton count={6} />
                        </div>
                    ) : error ? (
                        <div className="error-state">
                            <EmptyState
                                icon="⚠️"
                                title="Something went wrong"
                                description={error}
                                actionLabel="Try Again"
                                onAction={() => window.location.reload()}
                            />
                        </div>
                    ) : displayColleges.length === 0 ? (
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
                            {!error && suggestions.length > 0 && (
                                <div className="mt-4 text-center">
                                    <p className="text-gray-600 mb-2">Did you mean?</p>
                                    <div className="flex gap-2 justify-center flex-wrap">
                                        {suggestions.map((s, i) => (
                                            <button
                                                key={i}
                                                onClick={() => {
                                                    setQuery(s);
                                                    setPage(1);
                                                }}
                                                className="text-blue-600 hover:underline bg-blue-50 px-3 py-1 rounded-full text-sm"
                                            >
                                                {s}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {/* Mobile Sticky Actions */}
                            <div className="mobile-filter-actions">
                                <button
                                    className="filter-btn-reset"
                                    onClick={clearFilters}
                                >
                                    Clear All
                                </button>
                                <button className="filter-btn-apply" onClick={() => {
                                    setIsMobileFiltersOpen(false);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}>
                                    Apply Filters
                                </button>
                            </div>
                        </EmptyState>
                    ) : (
                        <>
                            <div className="results-grid">
                                {displayColleges.map((college, index) => (
                                    <RevealOnScroll key={college.id || `college-${index}`} delay={index * 30}>
                                        <div className="card-wrapper" style={{ contentVisibility: 'auto', containIntrinsicSize: '0 400px' }}>
                                            <Card
                                                type="college"
                                                title={formatPremiumText(college.name)}
                                                subtitle={formatPremiumText(college.location || (college.city ? `${college.city}${college.state ? ', ' + college.state : ''}` : college.state))}
                                                badge={getMatchStatus(college)}
                                                tags={[]}
                                                meta={[
                                                    college.type || 'College',
                                                    college.ownership || 'Private',
                                                    college.rankingTier || 'Tier 3',
                                                ].slice(0, 3)}
                                                href={`/college/${college.id}`}
                                                data={college}
                                                trust={{
                                                    level: college.trustLevel || 'evaluated',
                                                    score: college.ceiScore
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
                                    onPageChange={(p) => {
                                        setPage(p);
                                        window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                />
                            )}
                        </>
                    )}
                </Container>
            </section>
        </div>
    );
}

export default function CollegesClient({ initialData }) {
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
            <CollegesContent initialData={initialData} />
        </Suspense>
    );
}
