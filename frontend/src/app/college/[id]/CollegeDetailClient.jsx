"use client";

import { useEffect, useState } from "react";
import { fetchCollege } from "@/lib/api";
import Container from "@/components/Container";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import { DetailSkeleton } from "@/components/Skeleton";
import GlassPanel from "@/components/GlassPanel";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import PrestigeDetailLayout from "@/components/PrestigeDetailLayout";
import TacticalHUD from "@/components/TacticalHUD";
import PrestigeHero from "@/components/PrestigeHero";
import NarrativeOverview from "@/components/NarrativeOverview";
import NarrativeFoundation from "@/components/NarrativeFoundation";
import NarrativeIntel from "@/components/NarrativeIntel.jsx";
import NarrativeCampus from "@/components/NarrativeCampus";
import NarrativePedigree from "@/components/NarrativePedigree";
import NarrativeGeography from "@/components/NarrativeGeography";
import NarrativeBranches from "@/components/NarrativeBranches";
import NarrativeVault from "@/components/NarrativeVault";
import NarrativeEdge from "@/components/NarrativeEdge";
import NarrativeSentiment from "@/components/NarrativeSentiment";
import NarrativeGateway from "@/components/NarrativeGateway";
import PrestigeIntelligenceTabs from "@/components/PrestigeIntelligenceTabs";
import IntelligenceRadar from "@/components/IntelligenceRadar";
import ROICalculator from "@/components/ROICalculator";
import TruthPlacementsSection from "@/components/college/TruthPlacementsSection";
import AdmissionTruthSummary from "@/components/college/AdmissionTruthSummary";

import { useAuth } from "@/lib/AuthContext";

export default function CollegeDetailClient({ id, initialData }) {
    const { user } = useAuth();
    const [college, setCollege] = useState(initialData);
    const [isLoading, setIsLoading] = useState(!initialData);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState("overview");

    const tabs = [
        { id: "overview", label: "Overview" },
        { id: "courses", label: "Courses Offered" },
        { id: "seats", label: "Seats/Intake" },
        { id: "cutoffs", label: "Cut offs" },
        { id: "ceiscore", label: "CEI Score" },
        { id: "placements", label: "Placements" },
        { id: "roi", label: "ROI" },
        { id: "reviews", label: "Reviews" },
        { id: "report", label: "Report" }
    ];

    // Load data with personality injection
    useEffect(() => {
        const load = async () => {
            console.log(`[CEI][UI][detail] Mounting detail for: ${id}`);
            try {
                if (initialData && !user) {
                    console.log(`[CEI][UI][detail] Using hydrated initialData`);
                    setCollege(initialData);
                    setIsLoading(false);
                    return;
                }

                setIsLoading(true);
                setError(null);
                const data = await fetchCollege(id, user?.uid);
                
                if (!data) {
                    console.warn(`[CEI][UI][detail] No data returned for ${id}`);
                    setError("College intelligence not found in current sector.");
                } else {
                    console.log(`[CEI][UI][detail] Data resolved: ${data.name}`);
                    setCollege(data);
                }
            } catch (err) {
                console.error("[CEI][UI][detail] Load failed:", err);
                setError("Strategic connection to CEI data engine failed.");
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [id, initialData, user?.uid]);

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
        <PrestigeDetailLayout college={college}>
            {/* 0. Tactical Intelligence HUD */}
            <TacticalHUD college={college} />

            {/* 1. Cinematic Aura (Hero) - PERSISTENT */}
            <PrestigeHero college={college} />

            {/* 2. Tactical Intelligence Matrix (Tabs) */}
            <PrestigeIntelligenceTabs 
                tabs={tabs} 
                activeTab={activeTab} 
                onTabChange={setActiveTab} 
            />

            {/* 3. Dynamic Tab Viewport */}
            <div className="prestige-tab-viewport">
                {activeTab === "overview" && (
                    <div className="tab-pane fade-in">
                        <NarrativeOverview college={college} />
                        <NarrativeFoundation college={college} />
                        <NarrativeGeography college={college} />
                        <div className="prestige-section">
                            <div className="section-container">
                                <IntelligenceRadar college={college} />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "courses" && (
                    <div className="tab-pane fade-in">
                        <NarrativeBranches college={college} />
                    </div>
                )}

                {activeTab === "seats" && (
                    <div className="tab-pane fade-in">
                        <Container>
                            <AdmissionTruthSummary 
                                collegeId={college.id} 
                                searchName={college.coreMetadata?.canonicalName || college.name} 
                            />
                        </Container>
                        <NarrativeCampus college={college} />
                    </div>
                )}

                {activeTab === "cutoffs" && (
                    <div className="tab-pane fade-in">
                        <Container>
                            <AdmissionTruthSummary 
                                collegeId={college.id} 
                                searchName={college.coreMetadata?.canonicalName || college.name} 
                            />
                        </Container>
                        <NarrativeGateway 
                            collegeId={college.id} 
                            collegeName={college.name}
                            cutoffSearchName={college.coreMetadata?.canonicalName || college.name}
                        />
                    </div>
                )}

                {activeTab === "ceiscore" && (
                    <div className="tab-pane fade-in">
                        <NarrativeIntel college={college} />
                        <NarrativePedigree college={college} />
                    </div>
                )}

                {activeTab === "placements" && (
                    <div className="tab-pane fade-in">
                        <div className="prestige-section">
                            <Container>
                                <TruthPlacementsSection collegeId={college.id} />
                            </Container>
                        </div>
                        <NarrativeEdge college={college} />
                    </div>
                )}

                {activeTab === "roi" && (
                    <div className="tab-pane fade-in">
                        <NarrativeVault collegeId={college.id} />
                        
                        <div className="prestige-section">
                            <Container>
                                <ROICalculator 
                                    title={`Financial ROI Simulation: ${college.name}`}
                                    initialData={{
                                        tuition: college.fees?.[0]?.amount || 800000,
                                        avgPackage: (college.placements?.[0]?.value * 100000) || 1200000
                                    }}
                                />
                            </Container>
                        </div>
                    </div>
                )}

                {activeTab === "reviews" && (
                    <div className="tab-pane fade-in">
                        <NarrativeSentiment college={college} />
                    </div>
                )}

                {activeTab === "report" && (
                    <div className="tab-pane fade-in">
                        <div className="prestige-section">
                            <Container>
                                <GlassPanel variant="strong" className="report-alert-panel">
                                    <h3 className="prestige-heading">Report Data Discrepancy</h3>
                                    <p className="prestige-body-text">
                                        Help us maintain the integrity of CEI Intelligence. If you've found an inaccuracy in cutoffs, fees, or placements, please flag it for our technical auditors.
                                    </p>
                                    <Button className="mt-6">Open Audit Ticket</Button>
                                </GlassPanel>
                            </Container>
                        </div>
                    </div>
                )}
            </div>
        </PrestigeDetailLayout>
    );
}
