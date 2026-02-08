// No date usage found in previous view of ExamDetailClient.
// Proceeding to check GlassPanel.

import { useEffect, useState } from "react";
import { fetchExam } from "@/lib/api";
import Container from "@/components/Container";
import GlassPanel from "@/components/GlassPanel";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import { DetailSkeleton } from "@/components/Skeleton";

export default function ExamDetailClient({ id, initialData }) {
    const [exam, setExam] = useState(initialData);
    const [isLoading, setIsLoading] = useState(!initialData);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (initialData) return;

        const load = async () => {
            try {
                setError(null);
                const data = await fetchExam(id);
                setExam(data);
            } catch (err) {
                console.error("Failed to load exam", err);
                setError("Failed to load exam details.");
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [id, initialData]);

    if (isLoading) {
        return (
            <div className="detail-page">
                <Container>
                    <DetailSkeleton />
                </Container>
            </div>
        );
    }

    if (error || !exam) {
        return (
            <div className="detail-page">
                <Container>
                    <div className="detail-back-row">
                        <Button href="/exams" variant="ghost">← Back to Exams</Button>
                    </div>
                    <GlassPanel className="detail-error-panel" variant="strong">
                        <EmptyState
                            icon="⚠️"
                            title="Exam not found"
                            description={error || "The exam you're looking for doesn't exist."}
                            actionLabel="Browse Exams"
                            actionHref="/exams"
                        />
                    </GlassPanel>
                </Container>
            </div>
        );
    }

    const stats = [
        { label: "Difficulty", value: exam.difficulty || "—" },
        { label: "Marks", value: exam.totalMarks || "—" },
        { label: "Validity", value: exam.scoreValidity || "—" },
    ];

    return (
        <div className="detail-page">
            <section className="detail-hero">
                <Container>
                    <div className="detail-back-row">
                        <Button href="/exams" variant="ghost">← Back to Exams</Button>
                    </div>
                    <GlassPanel className="detail-hero-card" variant="strong" glow>
                        <div className="detail-hero-top">
                            <div>
                                <span className="detail-kicker">Exam profile</span>
                                <h1>{exam.name}</h1>
                                <p>{exam.type}</p>
                                {exam.conductingBody && (
                                    <p className="detail-conducting-body">Conducted by: {exam.conductingBody}</p>
                                )}
                            </div>
                            <div className="detail-actions">
                                <Button href={exam.officialUrl} variant="secondary">Official Website</Button>
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
                            <h2>Syllabus / Pattern</h2>
                            <div className="chip-row">
                                {(exam.syllabus && exam.syllabus.length > 0 ? exam.syllabus : exam.pattern || []).map((item) => (
                                    <span key={item} className="chip pill">{item}</span>
                                ))}
                            </div>
                        </GlassPanel>
                        <GlassPanel className="detail-panel" variant="strong">
                            <h2>Important Dates</h2>
                            {exam.dates ? (
                                <ul className="dates-list">
                                    {exam.dates.registration && <li><strong>Registration:</strong> {exam.dates.registration}</li>}
                                    {exam.dates.examWindow && <li><strong>Exam Window:</strong> {exam.dates.examWindow}</li>}
                                    {exam.dates.result && <li><strong>Result:</strong> {exam.dates.result}</li>}
                                </ul>
                            ) : (
                                <p>Date information coming soon.</p>
                            )}
                        </GlassPanel>
                    </div>
                </Container>
            </section>

            <section className="detail-section">
                <Container>
                    <div className="detail-grid">
                        <GlassPanel className="detail-panel" variant="strong">
                            <h2>Accepted by</h2>
                            <ul>
                                {(exam.acceptedCollegesResolved || exam.acceptedColleges || exam.collegesAccepting || []).map((college) => (
                                    <li key={college}>{college}</li>
                                ))}
                            </ul>
                        </GlassPanel>
                        {exam.pastPapers && exam.pastPapers.length > 0 && (
                            <GlassPanel className="detail-panel" variant="strong">
                                <h2>Past Papers</h2>
                                <ul>
                                    {exam.pastPapers.map((paper) => (
                                        <li key={paper.url}>
                                            <a href={paper.url} target="_blank" rel="noopener noreferrer">{paper.label}</a>
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
