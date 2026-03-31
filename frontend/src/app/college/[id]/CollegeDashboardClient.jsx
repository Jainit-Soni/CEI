"use client";

import { useEffect, useState } from "react";
import { fetchCollege, fetchReviews, fetchBenchmarks } from "@/lib/api";
import Link from "next/link";
import { ArrowLeft, MapPin, ExternalLink, ShieldCheck, Award, MessageSquare, AlertTriangle, ArrowRightLeft, CheckCircle2 } from "lucide-react";
import { useComparator } from "@/hooks/useComparator";
import Container from "@/components/Container";
import Button from "@/components/Button";
import EmptyState from "@/components/EmptyState";
import { DetailSkeleton } from "@/components/Skeleton";

// We keep the internal narrative components to render content without their old wrappers
import NarrativeFoundation from "@/components/NarrativeFoundation";
import NarrativeGeography from "@/components/NarrativeGeography";

import NarrativeBranches from "@/components/NarrativeBranches";
import NarrativeCampus from "@/components/NarrativeCampus";
import NarrativeGateway from "@/components/NarrativeGateway";
import NarrativeIntel from "@/components/NarrativeIntel.jsx";
import NarrativePedigree from "@/components/NarrativePedigree";
import NarrativeVault from "@/components/NarrativeVault";
import NarrativeEdge from "@/components/NarrativeEdge";
import NarrativeSentiment from "@/components/NarrativeSentiment";
import ROICalculator from "@/components/ROICalculator";
import TruthPlacementsSection from "@/components/college/TruthPlacementsSection";
import GlassPanel from "@/components/GlassPanel";
import ReviewModal from "@/components/ReviewModal";
import ReviewList from "@/components/ReviewList";
import ReportDataModal from "@/components/ReportDataModal";

import { useAuth } from "@/lib/AuthContext";
import "./CollegeDashboard.css";

export default function CollegeDashboardClient({ id, initialData }) {
    const { user } = useAuth();
    const { pinCollege, isPinned, unpinCollege } = useComparator();
    const [college, setCollege] = useState(initialData);
    const [isLoading, setIsLoading] = useState(!initialData);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState("overview");

    // Review, Report & Benchmark States
    const [reviews, setReviews] = useState([]);
    const [isReviewLoading, setIsReviewLoading] = useState(false);
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [benchmarks, setBenchmarks] = useState(null);

    const tabs = [
        { id: "overview", label: "Overview" },
        { id: "courses", label: "Courses Offered" },
        { id: "seats", label: "Seats/Intake" },
        { id: "cutoffs", label: "Cut Offs" },
        { id: "placements", label: "Placements" },
        { id: "roi", label: "ROI" },
        { id: "audit", label: "Truth Audit" },
        { id: "report", label: "Report Data" }
    ];

    useEffect(() => {
        const load = async () => {
            try {
                if (initialData && !user) {
                    setCollege(initialData);
                    // Also fetch benchmarks if initial data exists
                    if (id) loadBenchmarks(id);
                    setIsLoading(false);
                    return;
                }
                setIsLoading(true);
                const data = await fetchCollege(id, user?.uid);
                if (!data) setError("College intelligence not found.");
                else {
                    setCollege(data);
                    loadBenchmarks(id);
                }
            } catch (err) {
                setError("Connection to engine failed.");
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [id, initialData, user?.uid]);

    const loadBenchmarks = async (collegeId) => {
        try {
            const data = await fetchBenchmarks(collegeId);
            setBenchmarks(data);
        } catch (err) {
            console.error("Failed to load benchmarks:", err);
        }
    };

    // Load reviews when tab changes
    useEffect(() => {
        if (activeTab === "reviews" && college?.id) {
            loadReviews();
        }
    }, [activeTab, college?.id]);

    const loadReviews = async () => {
        setIsReviewLoading(true);
        try {
            const data = await fetchReviews(college.id);
            setReviews(data.reviews || []);
        } catch (err) {
            console.error("Failed to load reviews:", err);
        } finally {
            setIsReviewLoading(false);
        }
    };

    if (isLoading) {
        return <div className="detail-page-loading pt-20"><Container><DetailSkeleton /></Container></div>;
    }

    if (error || !college) {
        return (
            <div className="dashboard-root pt-32">
                <Container>
                    <Link href="/colleges" className="dash-back mb-8 inline-flex"><ArrowLeft size={16}/> Back</Link>
                    <GlassPanel className="p-10">
                        <EmptyState icon="🏫" title="College not found" description={error || "Doesn't exist."} actionLabel="Browse Colleges" actionHref="/colleges" />
                    </GlassPanel>
                </Container>
            </div>
        );
    }

    // Derive best location string
    const locationString = college.location || [college.address?.city || college.city || college.district, college.state].filter(Boolean).join(", ") || 'Details Unavailable';

    return (
        <div className="dashboard-root" style={{ paddingTop: '120px' }}>
            <Container className="dashboard-container w-full">
                
                {/* TOP COMMAND BAR */}
                <div className="dash-cmd-bar flex justify-between items-center">
                    <Link href="/colleges" className="dash-back">
                        <ArrowLeft size={16} /> Back to Search
                    </Link>
                    
                    <button 
                        onClick={() => isPinned(college.id) ? unpinCollege(college.id) : pinCollege(college.id)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all font-bold text-xs uppercase tracking-widest ${
                            isPinned(college.id) 
                            ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' 
                            : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                        }`}
                    >
                        {isPinned(college.id) ? (
                            <><CheckCircle2 size={14} /> Pinned to Hub</>
                        ) : (
                            <><ArrowRightLeft size={14} /> Pin to Compare</>
                        )}
                    </button>
                </div>

                {/* BENTO BOX HERO GRID */}
                <div className="bento-grid">
                    {/* Identity Tile */}
                    <div className="bento-tile bento-identity">
                        <div className="college-brand">
                            <div className="logo-box">
                                {college.logo ? <img src={college.logo} alt={college.name} /> : <div className="logo-placeholder">🏛️</div>}
                            </div>
                            <div className="brand-text">
                                <h1>{college.name}</h1>
                                <div className="brand-meta">
                                    {locationString && (
                                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${college.name} ${locationString}`)}`}
                                           target="_blank" rel="noopener noreferrer" className="bento-maps-btn">
                                            <MapPin size={14} /> {locationString} <ExternalLink size={12} />
                                        </a>
                                    )}
                                    {college.university && college.university !== 'NOT APPLICABLE' && (
                                        <span className="text-sm font-bold opacity-60 uppercase tracking-wider">{college.university}</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="bento-signals">
                            {college.competitivenessBand && (
                                <span className="b-sig band"><Award size={14} /> {college.competitivenessBand} Tier</span>
                            )}
                            {college.type && <span className="b-sig">{college.type}</span>}
                        </div>
                    </div>

                    {/* CEI Score Tile */}
                    <div className="bento-tile bento-score">
                        <div className="sb-ring">
                            <div className="sb-val">{college.ceiScore ? Number(college.ceiScore).toFixed(2) : '-'}</div>
                        </div>
                        <div className="sb-label">Official CEI Score</div>
                        <p className="text-xs opacity-90 mt-2 font-medium px-4 leading-relaxed">Calculated via indexed institutional parameters & outcomes.</p>
                    </div>
                </div>



                {/* SEGMENTED TAB NAVIGATION */}
                <div className="dash-tabs-wrapper">
                    <div className="dash-tabs">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                className={`d-tab ${activeTab === tab.id ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.id)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* CONTENT VIEWPORT */}
                <div className="dash-viewport">
                    {activeTab === "overview" && (
                        <div className="animate-fade-in space-y-12">
                            <NarrativeFoundation college={college} />
                            <NarrativeGeography college={college} />

                        </div>
                    )}
                    {activeTab === "courses" && (
                        <div className="animate-fade-in">
                            <NarrativeBranches college={college} />
                        </div>
                    )}
                    {activeTab === "seats" && (
                        <div className="animate-fade-in">
                            <NarrativeCampus college={college} />
                        </div>
                    )}
                    {activeTab === "cutoffs" && (
                        <div className="animate-fade-in">
                            <NarrativeGateway collegeId={college.id} />
                        </div>
                    )}
                    {activeTab === "placements" && (
                        <div className="animate-fade-in space-y-12">
                            <TruthPlacementsSection collegeId={college.id} />
                            <NarrativeEdge college={college} />
                        </div>
                    )}
                    {activeTab === "roi" && (
                        <div className="animate-fade-in space-y-12">
                            <NarrativeVault collegeId={college.id} />
                            <ROICalculator 
                                title={`ROI Simulation: ${college.shortName || college.name}`}
                                initialData={{
                                    tuition: Number(String(college.fees?.[0]?.amount).replace(/\D/g, '')) || 800000,
                                    avgPackage: Number(String(college.placements?.[0]?.value).replace(/\D/g, '')) * 100000 || 1200000
                                }}
                            />
                        </div>
                    )}
                    {activeTab === "audit" && (
                        <div className="animate-fade-in">
                            <div className="mb-8">
                                <h3 className="text-2xl font-black text-slate-800 tracking-tight">Truth-Graded Audit</h3>
                                <p className="text-slate-500 font-medium">Algorithmic synthesis of official institutional filings.</p>
                            </div>
                            
                            <NarrativeSentiment college={college} benchmarks={benchmarks} />
                        </div>
                    )}
                    {activeTab === "report" && (
                        <div className="animate-fade-in py-12">
                            <GlassPanel className="p-8 text-center max-w-2xl mx-auto border-dashed border-2 border-red-100">
                                <AlertTriangle size={48} className="mx-auto mb-4 text-red-500 opacity-60" />
                                <h3 className="text-xl font-bold mb-4">Report Discrepancy</h3>
                                <p className="opacity-70 mb-6 font-medium">
                                    Found incorrect data? Submitting a report triggers an <strong>Engine Re-Scan</strong>. 
                                    High-accuracy reports boost your community trust score.
                                </p>
                                <Button className="bg-red-500 hover:bg-red-600 shadow-lg shadow-red-100" onClick={() => setIsReportModalOpen(true)}>
                                    Open Analytics Ticket
                                </Button>
                            </GlassPanel>
                        </div>
                    )}
                </div>

                {/* MODALS */}
                <ReviewModal 
                    isOpen={isReviewModalOpen} 
                    onClose={() => setIsReviewModalOpen(false)} 
                    collegeId={college.id}
                    onReviewSubmitted={loadReviews}
                />
                <ReportDataModal 
                    college={college}
                    isOpen={isReportModalOpen}
                    onClose={() => setIsReportModalOpen(false)}
                />

            </Container>
        </div>
    );
}
