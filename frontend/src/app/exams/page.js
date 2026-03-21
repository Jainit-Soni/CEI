"use client";

import { useState, useEffect, useMemo } from "react";
import { fetchExams } from "@/lib/api";
import { useScores } from "@/lib/ScoreContext";
import Container from "@/components/Container";
import EmptyState from "@/components/EmptyState";
import FavoriteButton from "@/components/FavoriteButton";
import Card from "@/components/Card";
import { CardSkeleton } from "@/components/Skeleton";
import { RevealOnScroll } from "@/lib/useIntersectionObserver";
import "../colleges/page.css"; // Harmonized styles

export default function ExamsPage() {
  const { scores } = useScores();
  const [exams, setExams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const sortedExams = useMemo(() => {
    // Default Sort: Popularity (Accepted Count)
    return [...exams].sort((a, b) => {
      const countA = a.acceptedCount ?? (a.acceptedColleges || a.collegesAccepting || []).length;
      const countB = b.acceptedCount ?? (b.acceptedColleges || b.collegesAccepting || []).length;

      // If counts differ, sort by count descending
      if (countB !== countA) return countB - countA;

      // Fallback to name
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [exams]);

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

    if (sortedExams.length === 0) {
      return (
        <EmptyState
          icon="🔍"
          title="No exams found"
          description={"No exams available at the moment"}
        />
      );
    }

    const getStatusLabel = (dates) => {
      if (!dates) return null;
      const registration = dates.registration || "";
      const examWindow = dates.examWindow || "";
      const result = dates.result || "";

      if (result.toLowerCase().includes("declared")) return { label: "Results Declared", type: "success" };
      if (examWindow.toLowerCase().includes("upcoming")) return { label: "Exam Upcoming", type: "warning" };
      if (registration.toLowerCase().includes("august") || registration.toLowerCase().includes("expected")) return { label: "Registering Soon", type: "info" };
      if (registration.toLowerCase().includes("completed") || examWindow.toLowerCase().includes("completed")) return { label: "Cycle Ended", type: "muted" };
      
      return null;
    };

    return (
      <div className="results-grid">
        {sortedExams.map((exam, index) => {
          const status = getStatusLabel(exam.dates);
          const examKey = (exam.shortName || exam.name || "").toUpperCase();
          const userScore = scores[examKey];

          return (
            <RevealOnScroll key={exam.id} delay={index * 40}>
              <div className="card-wrapper">
                <FavoriteButton type="exams" id={exam.id} item={exam} size="sm" className="card-favorite" />
                {status && (
                  <div className={`status-badge status-badge--${status.type}`}>
                    {status.label}
                  </div>
                )}
                <Card
                  type="exam"
                  title={exam.shortName || exam.name}
                  subtitle={exam.type}
                  tags={exam.pattern && exam.pattern.length > 0 ? [exam.pattern[0].split(':')[0]] : [exam.category]}
                  meta={[
                    exam.stats?.fee ? `Fee: ${exam.stats.fee.split('(')[0].trim()}` : null,
                    exam.dates?.examWindow ? `Exam: ${exam.dates.examWindow}` : null
                  ].filter(Boolean)}
                  href={`/exam/${exam.id}`}
                  userScore={userScore}
                  data={exam}
                />
              </div>
            </RevealOnScroll>
          );
        })}
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

            {/* Stats */}
            <RevealOnScroll delay={100}>
              <div className="list-stats">
                <div className="list-stat">
                  <span className="list-stat-value mono">
                    {isLoading ? <div className="h-8 w-16 bg-white/20 animate-pulse rounded-md inline-block" /> : (exams.length || "--")}
                  </span>
                  <span className="list-stat-label">Total Exams</span>
                </div>
              </div>
            </RevealOnScroll>
          </div>
        </Container>
      </section>

      {/* Filter Section Removed Entirely as per user request to mirror Scholarships */}

      <section className="list-results pt-12">
        <Container>
          {renderContent()}
        </Container>
      </section>
    </div>
  );
}
