"use client";

import { useEffect, useState } from "react";
import Card from "@/components/Card";
import Container from "@/components/Container";
import EmptyState from "@/components/EmptyState";
import { CardSkeleton } from "@/components/Skeleton";
import { RevealOnScroll } from "@/lib/useIntersectionObserver";
import { fetchNews } from "@/lib/api";
import "../colleges/page.css";

export default function NewsPage() {
    const [news, setNews] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

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

        if (news.length === 0) {
            return (
                <EmptyState
                    icon="📰"
                    title="No news found"
                    description={"Check back later for updates."}
                />
            );
        }

        return (
            <div className="results-grid">
                {news.map((item, index) => (
                    <RevealOnScroll key={item.id} delay={index * 40}>
                        <div className="card-wrapper">
                            <Card
                                type="news"
                                title={item.title}
                                subtitle={item.summary}
                                tags={[item.category]}
                                meta={[`Date: ${new Date(item.date).toLocaleDateString()}`, item.source]}
                                // Fix: Use real link if available, fallback to #
                                href={item.url || item.link || "#"}
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

            {/* Removed Filter Section Entirely as per user request */}

            <section className="list-results pt-12">
                <Container>
                    {renderContent()}
                </Container>
            </section>
        </div>
    );
}
