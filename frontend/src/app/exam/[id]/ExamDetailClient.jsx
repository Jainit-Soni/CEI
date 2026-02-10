"use client";

// No date usage found in previous view of ExamDetailClient.
// Proceeding to check GlassPanel.

import { useEffect, useState } from "react";
import { fetchExam } from "@/lib/api";
import Container from "@/components/Container";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import { DetailSkeleton } from "@/components/Skeleton";
import ExamHero from "@/components/ExamHero";
import ExamTabs from "@/components/ExamTabs";

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
            <div className="exam-detail-page-v2">
                <Container>
                    <DetailSkeleton />
                </Container>
            </div>
        );
    }

    if (error || !exam) {
        return (
            <div className="exam-detail-page-v2">
                <Container>
                    <div style={{ padding: '0.5rem 0' }}>
                        <Button href="/exams" variant="ghost">← Back to Exams</Button>
                    </div>
                    <EmptyState
                        icon="⚠️"
                        title="Exam not found"
                        description={error || "The exam you're looking for doesn't exist."}
                        actionLabel="Browse Exams"
                        actionHref="/exams"
                    />
                </Container>
            </div>
        );
    }

    return (
        <div className="exam-detail-page-v2">
            <Container>
                {/* 1. Back Nav */}
                <div style={{ padding: '0.5rem 0' }}>
                    <Button href="/exams" variant="ghost" className="back-btn-simple">← Back to Exams</Button>
                </div>

                {/* 2. Hero Section */}
                <ExamHero exam={exam} />

                {/* 3. Tabs Section */}
                <ExamTabs exam={exam} />

            </Container>
        </div>
    );
}

