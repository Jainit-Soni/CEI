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
            <div className="detail-page-loading">
                <Container>
                    <DetailSkeleton />
                </Container>
            </div>
        );
    }

    if (error || !college) {
        return (
            <div className="detail-page-error">
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
        <div className="college-profile-v3">
            {/* 1. Cinematic Hero (Full Width) */}
            <CollegeHero college={college} />

            <Container>
                {/* 2. Tabbed Content Area */}
                <div className="profile-content-wrapper">
                    <CollegeTabs college={college} />
                </div>
            </Container>
        </div>
    );
}
