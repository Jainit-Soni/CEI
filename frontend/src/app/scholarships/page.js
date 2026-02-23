"use client";

import { useEffect, useState } from "react";
import Card from "@/components/Card";
import Container from "@/components/Container";
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

        if (scholarships.length === 0) {
            return (
                <EmptyState
                    icon="🎓"
                    title="No scholarships found"
                    description={"No scholarships available at the moment"}
                />
            );
        }

        return (
            <div className="results-grid">
                {scholarships.map((scholarship, index) => (
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
                                Discover funding opportunities to support your education journey.
                            </p>
                        </RevealOnScroll>

                        {/* Stats */}
                        <RevealOnScroll delay={100}>
                            {(() => {
                                const totalAmt = scholarships.reduce((acc, curr) => acc + (parseInt(curr.amount?.toString().replace(/[^0-9]/g, '')) || 0), 0);
                                const formattedAmt = totalAmt >= 10000000 ? `₹${(totalAmt / 10000000).toFixed(2)} Cr` : `₹${totalAmt.toLocaleString()}`;
                                return (
                                    <div className="list-stats">
                                        <div className="list-stat">
                                            <span className="list-stat-value mono">{scholarships.length || "--"}</span>
                                            <span className="list-stat-label">Grants</span>
                                        </div>
                                        <div className="list-stat">
                                            <span className="list-stat-value mono">{formattedAmt}</span>
                                            <span className="list-stat-label">Total Value</span>
                                        </div>
                                    </div>
                                );
                            })()}
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
