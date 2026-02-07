"use client";

import { useEffect, useState } from "react";
import { fetchCollege } from "@/lib/api";
import Container from "@/components/Container";
import GlassPanel from "@/components/GlassPanel";
import Button from "@/components/Button";
import FavoriteButton from "@/components/FavoriteButton";
import EmptyState from "@/components/EmptyState";
import { DetailSkeleton } from "@/components/Skeleton";

const getDistrict = (college) =>
    college?.meta?.district || college?.location?.split(",")[0]?.trim() || "Unknown";

export default function CollegeDetailClient({ id }) {
    const [college, setCollege] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const load = async () => {
            try {
                setError(null);
                const data = await fetchCollege(id);
                setCollege(data);
            } catch (err) {
                console.error("Failed to load college", err);
                setError("Failed to load college details.");
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [id]);

    if (isLoading) {
        return (
            <div className="detail-page">
                <Container>
                    <DetailSkeleton />
                </Container>
            </div>
        );
    }

    if (error || !college) {
        return (
            <div className="detail-page">
                <Container>
                    <div className="detail-back-row">
                        <Button href="/colleges" variant="ghost">← Back to Colleges</Button>
                    </div>
                    <GlassPanel className="detail-error-panel" variant="strong">
                        <EmptyState
                            icon="🏫"
                            title="College not found"
                            description={error || "The college you're looking for doesn't exist."}
                            actionLabel="Browse Colleges"
                            actionHref="/colleges"
                        />
                    </GlassPanel>
                </Container>
            </div>
        );
    }

    const stats = [
        { label: "Tier", value: college.rankingTier || college.ranking || "—" },
        { label: "District", value: getDistrict(college) },
        { label: "Ownership", value: college.meta?.ownership || "—" },
    ];

    return (
        <div className="detail-page">
            <section className="detail-hero">
                <Container>
                    <div className="detail-back-row">
                        <Button href="/colleges" variant="ghost">← Back to Colleges</Button>
                    </div>
                    <GlassPanel className="detail-hero-card" variant="strong" glow>
                        <div className="detail-hero-top">
                            <div className="detail-hero-info">
                                <span className="detail-kicker">College profile</span>
                                <h1>{college.name}</h1>
                                <p>{college.location}</p>
                                {(college.meta?.establishedYear || college.meta?.naacGrade) && (
                                    <p className="detail-meta-line">
                                        {college.meta?.establishedYear && <span>Est. {college.meta.establishedYear}</span>}
                                        {college.meta?.naacGrade && <span className="naac-badge">NAAC {college.meta.naacGrade}</span>}
                                    </p>
                                )}
                            </div>
                            <div className="detail-actions">
                                <FavoriteButton type="colleges" id={college.id} item={college} size="lg" />
                                <Button href={college.officialUrl} variant="secondary">Official Website</Button>
                            </div>
                        </div>
                        <div className="detail-stats">
                            {stats.map((stat) => (
                                <div key={stat.label} className="detail-stat">
                                    <span className="detail-stat-value mono">{stat.value}</span>
                                    <span className="detail-stat-label">{stat.label}</span>
                                </div>
                            ))}
                        </div>
                    </GlassPanel>
                </Container>
            </section>

            <section className="detail-section">
                <Container>
                    <div className="detail-grid">
                        <GlassPanel className="detail-panel" variant="strong">
                            <h2>Overview</h2>
                            <p>{college.overview || "Structured profile coming soon."}</p>
                            <div className="detail-meta">
                                <span>Campus: {college.campus || "—"}</span>
                                <span>Tuition: {college.tuition || "—"}</span>
                            </div>
                        </GlassPanel>
                        <GlassPanel className="detail-panel" variant="strong">
                            <h2>Accepted exams</h2>
                            <div className="chip-row">
                                {(college.acceptedExams || []).map((exam) => (
                                    <span key={exam} className="chip pill">{exam.toUpperCase()}</span>
                                ))}
                            </div>
                            <h3>Top recruiters</h3>
                            <ul>
                                {(college.topRecruiters || []).slice(0, 6).map((rec) => (
                                    <li key={rec}>{rec}</li>
                                ))}
                            </ul>
                        </GlassPanel>
                    </div>
                </Container>
            </section>

            <section className="detail-section">
                <Container>
                    <div className="detail-grid">
                        {college.placements && (
                            <GlassPanel className="detail-panel" variant="strong">
                                <h2>Placement Highlights</h2>
                                <div className="placement-grid">
                                    <div className="placement-stat-box highlight">
                                        <span className="label">Average Package</span>
                                        <span className="value">{college.placements.averagePackage}</span>
                                    </div>
                                    {college.placements.medianPackage && (
                                        <div className="placement-stat-box">
                                            <span className="label">Median Package</span>
                                            <span className="value">{college.placements.medianPackage}</span>
                                        </div>
                                    )}
                                    <div className="placement-stat-box">
                                        <span className="label">Highest Package</span>
                                        <span className="value">{college.placements.highestPackage}</span>
                                    </div>
                                </div>
                            </GlassPanel>
                        )}
                        <GlassPanel className="detail-panel" variant="strong">
                            <h2>Programs</h2>
                            <ul className="program-list">
                                {(college.courses || []).map((course) => (
                                    <li key={course.name}>
                                        <strong>{course.name}</strong>
                                        <span>{course.duration}</span>
                                    </li>
                                ))}
                            </ul>
                        </GlassPanel>
                        {college.pastCutoffs && college.pastCutoffs.length > 0 && (
                            <GlassPanel className="detail-panel" variant="strong">
                                <h2>Past Cutoffs</h2>
                                <ul className="cutoff-list">
                                    {college.pastCutoffs.map((cutoff, idx) => (
                                        <li key={idx}>
                                            <strong>{cutoff.examId?.toUpperCase()} ({cutoff.year}):</strong> {cutoff.cutoff}
                                        </li>
                                    ))}
                                </ul>
                            </GlassPanel>
                        )}
                    </div>
                </Container>
            </section>
        </div>
    );
}
