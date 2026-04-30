"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import GlassPanel from "./GlassPanel";
import dynamic from "next/dynamic";
import ReviewList from "./ReviewList";
import Button from "./Button";
import ReviewModal from "./ReviewModal";
import ReportDataModal from "./ReportDataModal";
import IntelligenceRadar from "./IntelligenceRadar";
import PremiumReviews from "./PremiumReviews";
import ExplainabilityCard from "./ExplainabilityCard";
import DataConfidenceBadge from "./DataConfidenceBadge";
import DataSourcesPanel from "./DataSourcesPanel";
import ImprovementSimulator from "./ImprovementSimulator";
import Nexus3DCore from "./Nexus3DCore";
import TruthSeatsSection from "./college/TruthSeatsSection";
import TruthCutoffsSection from "./college/TruthCutoffsSection";
import TruthFeesSection from "./college/TruthFeesSection";
import TruthPlacementsSection from "./college/TruthPlacementsSection";
import { fetchReviews as getReviews } from "@/lib/api";
import "./CollegeTabs.css";

const ROICalculator = dynamic(() => import("./ROICalculator"), {
    loading: () => <div className="p-8 text-center text-slate-500">Loading Calculator...</div>
});

const CollegeRadarChart = dynamic(() => import("./CollegeRadarChart"), {
    loading: () => <div className="p-8 text-center text-slate-500">Loading Intelligence Map...</div>
});

const parseCurrency = (str) => {
    if (!str || typeof str !== 'string') return 0;
    
    // Normalize string
    let clean = str.toLowerCase().replace(/,/g, '').replace(/₹/g, '').replace(/rs\.?/g, '').trim();
    let multiplier = 1;

    // Detect multipliers
    if (clean.includes('cr') || clean.includes('crore')) {
        multiplier = 10000000;
        clean = clean.replace(/crores?/g, '').replace(/cr/g, '');
    } else if (clean.includes('lakh') || clean.includes('lpa')) {
        multiplier = 100000;
        clean = clean.replace(/lakhs?/g, '').replace(/lpa/g, '');
    } else if (clean.includes('k')) {
        multiplier = 1000;
        clean = clean.replace(/k/g, '');
    }

    // Handle ranges (e.g., "15-25")
    const ranges = clean.match(/[\d\.]+/g);
    if (!ranges || ranges.length === 0) return 0;

    // If it's a range, take the average
    let val = 0;
    if (ranges.length >= 2) {
        val = (parseFloat(ranges[0]) + parseFloat(ranges[1])) / 2;
    } else {
        val = parseFloat(ranges[0]);
    }

    if (isNaN(val)) return 0;

    // Intelligent heuristic for unit-less numbers (if < 500, assume Lakhs for salaries)
    if (multiplier === 1 && val > 0 && val < 500) {
        multiplier = 100000;
    }

    return val * multiplier;
};

export default function CollegeTabs({ college }) {
    const [activeTab, setActiveTab] = useState("overview");
    const [reviewsData, setReviewsData] = useState({ reviews: [], avgRating: 0, totalReviews: 0 });
    const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [showAllPrograms, setShowAllPrograms] = useState(false);

    const sanitizeCurrency = (val) => {
        if (!val) return "N/A";
        // Convert to string and replace mangled UTF-8 bytes (E2 82 B9 interpreted as ISO-8859-1) or literal ₹
        return val.toString().replace(/[^\x20-\x7E₹]/g, '').replace(/₹/g, 'INR ').replace(/â‚¹/g, 'INR ').trim();
    };

    const avgPkg = sanitizeCurrency(college.placements?.averagePackage);
    const highPkg = sanitizeCurrency(college.placements?.highestPackage);

    const rawTabs = [
        { id: "overview", label: "Overview", icon: "🏢" },
        { id: "seats", label: "Seats / Intake", icon: "🪑" },
        { id: "cutoffs", label: "Cutoffs", icon: "📊" },
        { id: "fees", label: "Fees", icon: "💰" },
        { id: "placements", label: "Placements", icon: "💼" },
        { id: "intelligence", label: "CEI Intelligence", icon: "🧠" },
        { id: "roi", label: "ROI Analysis", icon: "🧮" },
        { id: "reviews", label: "Reviews", icon: "⭐" }
    ];

    // Filter tabs based on backend-provided visibility map
    const availableSections = college.availableSections || {
        overview: "show",
        seats: "show",
        cutoffs: "show",
        intelligence: "show",
        reviews: "show"
    };

    const tabs = rawTabs.filter(tab => availableSections[tab.id] === "show");

    const fetchReviews = async () => {
        try {
            const data = await getReviews(college.id);
            setReviewsData(data);
        } catch (error) {
            console.error("Failed to fetch reviews", error);
        }
    };

    useEffect(() => {
        if (activeTab === "reviews") {
            fetchReviews();
        }
    }, [activeTab, college.id]);

    const resolvedCollegeId = college.institution_id || college.id || college._id;

    return (
        <div className="college-tabs-container">
            {/* Sticky Tab Navigation */}
            <div className="tabs-sticky-wrapper">
                <div className="tabs-nav">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            className={`tab-item ${activeTab === tab.id ? "active" : ""}`}
                            onClick={() => setActiveTab(tab.id)}
                        >
                            <span className="tab-icon">{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                    {/* Report trigger — persistent, visible on every tab */}
                    <button
                        className="tab-report-trigger"
                        onClick={() => setIsReportModalOpen(true)}
                        title="Report incorrect data about this college"
                    >
                        ⚑ Report Data
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            <div className="tab-content-area">

                {activeTab === "overview" && (
                    <div className="tab-pane fade-in">
                        <div className="overview-layout">
                            {/* Primary Intel Block */}
                                <div className="intel-content">
                                    <div className="overview-grid-v7">
                                        <div className="overview-main-v7">
                                            <h3 className="tab-heading">Institutional Identity</h3>
                                            <p className="tab-description-v7">
                                                {college.name} serves as a key node in the {college.state} higher education matrix. 
                                                Classified as a {college.ownership || college.type} institution, it maintains active evaluated data layers for intake and admissions.
                                            </p>

                                            <div className="foundation-grid-v7">
                                                <div className="foundation-box-v7">
                                                    <span className="fb-label">Established Authority</span>
                                                    <span className="fb-value">{college.university || 'Independent / Autonomous'}</span>
                                                </div>
                                                <div className="foundation-box-v7">
                                                    <span className="fb-label">Regional Presence</span>
                                                    <span className="fb-value">{college.city}, {college.state}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="program-inventory-v7">
                                            <div className="pi-header-v7">
                                                <h3 className="tab-heading">Program Inventory</h3>
                                                <div className="pi-count-v7">{college.courses?.length || 0} Modules</div>
                                            </div>
                                            
                                            <div className="program-grid">
                                                {(college.courses || []).slice(0, showAllPrograms ? undefined : 8).map((course, idx) => (
                                                    <div key={idx} className="program-mini-card">
                                                        <div className="pmc-name">{course.courseName || course.name || course.programName}</div>
                                                        <div className="pmc-footer mb-2">
                                                            {course.degree && <span className="pmc-tag">{course.degree}</span>}
                                                            {(course.durationYears || course.duration) && <span className="pmc-tag">{course.durationYears || course.duration}</span>}
                                                        </div>
                                                        {course.seatMatrix && (
                                                            <div className="mt-2 text-xs border-t border-slate-700/50 pt-2 flex flex-wrap gap-2 font-medium">
                                                                {course.seatMatrix.open > 0 && <span className="text-emerald-400">GEN: {course.seatMatrix.open}</span>}
                                                                {course.seatMatrix.sc > 0 && <span className="text-blue-400">SC: {course.seatMatrix.sc}</span>}
                                                                {course.seatMatrix.st > 0 && <span className="text-violet-400">ST: {course.seatMatrix.st}</span>}
                                                                {course.seatMatrix.obc > 0 && <span className="text-orange-400">OBC: {course.seatMatrix.obc}</span>}
                                                                {course.seatMatrix.ews > 0 && <span className="text-rose-400">EWS: {course.seatMatrix.ews}</span>}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                            {college.courses?.length > 8 && (
                                                <button
                                                    className="intel-action-btn mt-6"
                                                    onClick={() => setShowAllPrograms(!showAllPrograms)}
                                                >
                                                    {showAllPrograms ? "Show Less" : `View all ${college.courses.length} programs`}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                        </div>

                        {/* Performance Radar */}
                        <div className="premium-tab-card radar-intel-card">
                            <div className="intel-header mb-8">
                                <div className="intel-header-info">
                                    <h3 className="tab-heading">Performance Vector</h3>
                                    <p className="tab-subheading">AI-synthesized footprint based on national validation and institutional tier.</p>
                                </div>
                            </div>
                            <div className="radar-container">
                                <CollegeRadarChart college={college} />
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === "seats" && (
                    <div className="tab-pane fade-in">
                        <div className="premium-tab-card">
                            <h3 className="tab-heading">Seats & Intake</h3>
                            <p className="overview-text mb-6">
                                Evaluated intake and program-wise seat availability from official regulatory sources.
                            </p>
                            <TruthSeatsSection collegeId={resolvedCollegeId} />
                        </div>
                    </div>
                )}

                {activeTab === "cutoffs" && (
                    <div className="tab-pane fade-in">
                        <div className="premium-tab-card">
                            <h3 className="tab-heading">Cutoffs & Thresholds</h3>
                            <p className="overview-text mb-6">
                                Evaluated admission thresholds including opening/closing ranks across all categories, quotas, and rounds.
                            </p>
                            <TruthCutoffsSection collegeId={resolvedCollegeId} />
                        </div>
                    </div>
                )}

                {activeTab === "placements" && (
                    <div className="tab-pane fade-in">
                        <div className="premium-tab-card">
                            <h3 className="tab-heading">Placement Records</h3>
                            <p className="overview-text mb-6">
                                Evaluated institutional placement outcomes including salary packages and employment rates.
                            </p>
                            <TruthPlacementsSection collegeId={resolvedCollegeId} />
                        </div>
                    </div>
                )}

                {activeTab === "fees" && (
                    <div className="tab-pane fade-in">
                        <div className="premium-tab-card">
                            <h3 className="tab-heading">Fee Structure</h3>
                            <p className="overview-text mb-6">
                                Official institutional fee breakdown evaluated from regulatory orders and institute disclosures.
                            </p>
                            <TruthFeesSection collegeId={resolvedCollegeId} />
                        </div>
                    </div>
                )}

                {activeTab === "intelligence" && (
                    <div className="tab-pane fade-in">
                        {/* Explainability Card — constitutional score breakdown */}
                        <div className="premium-tab-card" style={{ marginBottom: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h3 className="tab-heading" style={{ margin: 0 }}>CEI Intelligence Core</h3>
                                <Button href="/methodology" variant="ghost" size="sm">Methodology →</Button>
                            </div>
                            <ExplainabilityCard college={college} />
                        </div>

                        <div className="premium-tab-card">
                            <h3 className="tab-heading" style={{ marginBottom: '4px' }}>Nexus Intelligence Engine</h3>
                            <p className="overview-text mb-8" style={{ fontSize: '0.85rem' }}>
                                A real-world 3D volumetric projection of {college.shortName}'s score factors.
                            </p>
                            <Nexus3DCore college={college} />
                        </div>
                    </div>
                )}

                {activeTab === "roi" && (
                    <div className="tab-pane fade-in">
                        <ROICalculator
                            title={`ROI Analysis Breakdown for ${college.shortName || college.name}`}
                            initialData={{
                                tuition: parseCurrency(college.tuition) || 150000,
                                avgPackage: parseCurrency(college.placements?.averagePackage) || 600000,
                                duration: 4
                            }}
                        />
                    </div>
                )}

                {/* New Reviews Tab */}
                {activeTab === "reviews" && (
                    <div className="tab-pane fade-in">
                        <div className="premium-tab-card">
                            <div className="review-header">
                                <div>
                                    <h3 className="tab-heading mb-1">Student Reviews</h3>
                                    <div className="review-stats">
                                        <span className="rating-badge">{reviewsData.avgRating} ★</span>
                                        <span className="review-count">({reviewsData.totalReviews} reviews)</span>
                                    </div>
                                </div>
                                <Button onClick={() => setIsReviewModalOpen(true)}>Write a Review</Button>
                            </div>

                            <ReviewList reviews={reviewsData.reviews} />
                        </div>
                    </div>
                )}

            </div>

            <ReviewModal
                isOpen={isReviewModalOpen}
                onClose={() => setIsReviewModalOpen(false)}
                collegeId={college.id}
                onReviewSubmitted={fetchReviews}
            />

            <ReportDataModal
                isOpen={isReportModalOpen}
                onClose={() => setIsReportModalOpen(false)}
                college={college}
            />
        </div>
    );
}
