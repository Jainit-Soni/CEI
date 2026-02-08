"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/Card";
import Container from "@/components/Container";
import GlassPanel from "@/components/GlassPanel";
import Button from "@/components/Button";
import FancySelect from "@/components/FancySelect";
import EmptyState from "@/components/EmptyState";
import { CardSkeleton } from "@/components/Skeleton";
import FavoriteButton from "@/components/FavoriteButton";
import { RevealOnScroll } from "@/lib/useIntersectionObserver";
import { fetchExams } from "@/lib/api";
import "../colleges/page.css";
import "./page.css";

export default function ExamsPage() {
  const [exams, setExams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState({
    type: "All",
    section: "All",
  });

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        const examData = await fetchExams();
        // Handle both direct array and paginated response
        const data = Array.isArray(examData) ? examData : (examData.data || []);
        setExams(data);
      } catch (err) {
        console.error("Failed to load exams", err);
        setError("Failed to load exams. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  const typeOptions = useMemo(() => {
    const unique = new Set(exams.map((exam) => exam.type).filter(Boolean));
    return ["All", ...Array.from(unique)];
  }, [exams]);

  const sectionOptions = useMemo(() => {
    const unique = new Set(
      exams.flatMap((exam) => exam.syllabus || exam.pattern || [])
    );
    return ["All", ...Array.from(unique)];
  }, [exams]);

  const filteredExams = useMemo(() => {
    const normalized = query.toLowerCase();
    return exams.filter((exam) => {
      const matchesQuery = `${exam.name} ${exam.shortName} ${exam.type}`
        .toLowerCase()
        .includes(normalized);
      const matchesType = filters.type === "All" || exam.type === filters.type;
      const matchesSection =
        filters.section === "All" || (exam.syllabus || []).includes(filters.section);
      return matchesQuery && matchesType && matchesSection;
    });
  }, [exams, query, filters]);

  const sortedExams = useMemo(() => {
    const score = (exam) => {
      const accepted =
        exam.acceptedCount ??
        (exam.acceptedColleges || exam.collegesAccepting || []).length;
      const sections = (exam.syllabus || exam.pattern || []).length;
      return accepted * 5 + sections;
    };

    return [...filteredExams].sort((a, b) => {
      const diff = score(b) - score(a);
      if (diff !== 0) return diff;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [filteredExams]);

  const handleFilterChange = (id, value) => {
    setFilters((prev) => ({ ...prev, [id]: value }));
  };

  const clearFilters = () => {
    setQuery("");
    setFilters({ type: "All", section: "All" });
  };

  const hasActiveFilters = query || filters.type !== "All" || filters.section !== "All";

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

    if (filteredExams.length === 0) {
      return (
        <EmptyState
          icon="🔍"
          title="No exams found"
          description={hasActiveFilters
            ? "Try adjusting your search or filters"
            : "No exams available at the moment"}
          actionLabel={hasActiveFilters ? "Clear Filters" : undefined}
          onAction={hasActiveFilters ? clearFilters : undefined}
        />
      );
    }

    return (
      <div className="results-grid">
        {sortedExams.map((exam, index) => (
          <RevealOnScroll key={exam.id} delay={index * 40}>
            <div className="card-wrapper">
              <FavoriteButton type="exams" id={exam.id} item={exam} size="sm" className="card-favorite" />
              <Card
                type="exam"
                title={exam.shortName || exam.name}
                subtitle={exam.type}
                tags={(exam.syllabus || []).slice(0, 4)}
                meta={`Accepted by ${exam.acceptedCount ?? (exam.acceptedColleges || exam.collegesAccepting || []).length} colleges`}
                href={`/exam/${exam.id}`}
              />
            </div>
          </RevealOnScroll>
        ))}
      </div>
    );
  };

  return (
    <div className="list-page">
      <section className="list-hero list-hero--exams">
        <div className="list-hero-bg" aria-hidden="true">
          <div className="hero-orb hero-orb--1" />
          <div className="hero-orb hero-orb--2" />
        </div>

        <Container>
          <div className="list-hero-content">
            <RevealOnScroll>
              <span className="list-hero-kicker">Exam Clarity</span>
              <h1 className="list-hero-title">Exams, filtered for fast comparison</h1>
              <p className="list-hero-subtitle">
                Match exam patterns and syllabi with programs in a clean, glass-first layout.
              </p>
            </RevealOnScroll>

            <RevealOnScroll delay={100}>
              <div className="list-stats">
                <div className="list-stat">
                  <span className="list-stat-value mono">{typeOptions.length - 1 || "--"}</span>
                  <span className="list-stat-label">Exam types</span>
                </div>

                <div className="list-stat">
                  <span className="list-stat-value mono">{exams.length || "--"}</span>
                  <span className="list-stat-label">Exams</span>
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
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by exam name or type"
              />
            </div>

            <div className="filter-row">
              <FancySelect
                label="Type"
                value={filters.type}
                options={typeOptions}
                onChange={(val) => handleFilterChange("type", val)}
              />
              <FancySelect
                label="Section"
                value={filters.section}
                options={sectionOptions}
                onChange={(val) => handleFilterChange("section", val)}
              />
            </div>

            <div className="filter-meta">
              <span className="filter-count">
                Showing <strong>{filteredExams.length}</strong> matches
              </span>
              {hasActiveFilters && (
                <Button variant="secondary" onClick={clearFilters}>Reset filters</Button>
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

