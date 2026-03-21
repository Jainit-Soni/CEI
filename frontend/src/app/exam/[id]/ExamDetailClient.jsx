"use client";

import { useEffect, useState } from "react";
import { fetchExam } from "@/lib/api";
import EmptyState from "@/components/EmptyState";
import { DetailSkeleton } from "@/components/Skeleton";
import ExamTabs from "@/components/ExamTabs";
import ExamPrestigeHero from "@/components/ExamPrestigeHero";
import "./page.css"; // We'll keep the dashboard-root styles here

/**
 * ExamDetailClient - Structural Refactoring
 * Ensures a single dashboard-root and dashboard-container for consistent spacing.
 */
export default function ExamDetailClient({ id, initialData }) {
    const [exam, setExam] = useState(initialData);
    const [isLoading, setIsLoading] = useState(!initialData);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (initialData) return;
        const load = async () => {
            try {
                const data = await fetchExam(id);
                setExam(data);
            } catch (err) {
                setError("Failed to load exam details.");
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [id, initialData]);

    if (isLoading) return <div className="dashboard-root"><DetailSkeleton /></div>;

    if (error || !exam) {
        return (
            <div className="dashboard-root">
                <div className="dashboard-container">
                    <EmptyState
                        icon="⚠️"
                        title="Exam not found"
                        description={error || "The exam you're looking for doesn't exist."}
                        actionLabel="Browse Exams"
                        actionHref="/exams"
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-root">
            <div className="dashboard-container">
                {/* Single shell for all components to ensure correct padding/margin */}
                <ExamPrestigeHero exam={exam} />
                <ExamTabs exam={exam} />
            </div>
        </div>
    );
}
