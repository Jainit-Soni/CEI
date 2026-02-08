"use client";

import { useEffect, useState } from "react";
import { fetchCollege } from "@/lib/api";
import Container from "@/components/Container";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import { DetailSkeleton } from "@/components/Skeleton";
import GlassPanel from "@/components/GlassPanel";
import CollegeHero from "@/components/CollegeHero";
import CollegeTabs from "@/components/CollegeTabs";

export default function CollegeDetailClient({ id, initialData }) {
    const [college, setCollege] = useState(initialData);
    const [isLoading, setIsLoading] = useState(!initialData);
    const [error, setError] = useState(null);

    // Only fetch if no initialData provided (fallback)
    useEffect(() => {
        if (initialData) return;

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

    return (
        <div className="college-detail-page-v2">
            <Container>
                {/* 1. Back Nav */}
                <div style={{ padding: '0.5rem 0' }}>
                    <Button href="/colleges" variant="ghost" className="back-btn-simple">← Back to Colleges</Button>
                </div>

                {/* 2. Hero Section (Premium) */}
                <CollegeHero college={college} />

                {/* 3. Tabbed Content Area */}
                <CollegeTabs college={college} />
            </Container>
        </div>
    );
}
