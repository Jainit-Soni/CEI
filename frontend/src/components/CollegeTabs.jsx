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
import { fetchReviews as getReviews } from "@/lib/api";
import "./CollegeTabs.css";

const ROICalculator = dynamic(() => import("./ROICalculator"), {
    loading: () => <div className="p-8 text-center text-slate-500">Loading Calculator...</div>
});

const parseCurrency = (str) => {
    if (!str) return 0;
    let clean = str.toString().toLowerCase().replace(/,/g, '').replace(/₹/g, '').replace(/rs\.?/g, '').trim();
    let multiplier = 1;

    if (clean.includes('cr') || clean.includes('crore')) {
        multiplier = 10000000;
        clean = clean.replace(/crores?/g, '').replace(/cr/g, '');
    } else if (clean.includes('lakh') || clean.includes('lpa')) {
        multiplier = 100000;
        clean = clean.replace(/lakhs?/g, '').replace(/lpa/g, '');
    }

    const match = clean.match(/[\d\.]+/);
    if (!match) return 0;

    let val = parseFloat(match[0]);
    if (isNaN(val)) return 0;

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

    const sanitizeCurrency = (val) => {
        if (!val) return "N/A";
        // Convert to string and replace mangled UTF-8 bytes (E2 82 B9 interpreted as ISO-8859-1) or literal ₹
        return val.toString().replace(/[^\x20-\x7E₹]/g, '').replace(/₹/g, 'INR ').replace(/â‚¹/g, 'INR ').trim();
    };

    const avgPkg = sanitizeCurrency(college.placements?.averagePackage);
    const highPkg = sanitizeCurrency(college.placements?.highestPackage);

    const tabs = [
        { id: "overview", label: "Overview", icon: "🏢" },
        { id: "cutoffs", label: "Cutoffs", icon: "📊" },
        { id: "placements", label: "Placements", icon: "💼" },
        { id: "intelligence", label: "CEI Intelligence", icon: "🧠" },
        { id: "roi", label: "ROI Analysis", icon: "💰" },
        { id: "reviews", label: "Reviews", icon: "⭐" }
    ];

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
                        <div className="premium-tab-card">
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' }}>
                                <h3 className="tab-heading" style={{ margin: 0 }}>About {college.shortName || "Institute"}</h3>
                                {college.dataConfidenceLabel && (
                                    <DataConfidenceBadge
                                        label={college.dataConfidenceLabel}
                                        score={college.dataIntegrityScore}
                                    />
                                )}
                            </div>
                            <p className="overview-text">
                                {college.overview || `${college.name} is a premier institute located in ${college.location}. It offers a wide range of programs and has a strong reputation for academic excellence.`}
                            </p>

                            <div className="detail-meta-blocks">
                                <div className="meta-block">
                                    <strong>Campus Size</strong>
                                    {/* Use meta.campusSize if available, otherwise check if campus field looks like a size, else N/A */}
                                    <span>{college.meta?.campusSize || (college.campus && college.campus.includes("Acres") ? college.campus : "N/A")}</span>
                                </div>
                                <div className="meta-block">
                                    <strong>Ownership</strong>
                                    <span>{college.meta?.ownership || "Private"}</span>
                                </div>
                                <div className="meta-block">
                                    <strong>Estd. Year</strong>
                                    <span>{college.meta?.establishedYear || "—"}</span>
                                </div>
                            </div>
                        </div>

                        <div className="premium-tab-card">
                            <h3 className="tab-heading">Programs Offered</h3>
                            <ul className="program-list-compact">
                                {(college.courses || []).map((course, idx) => (
                                    <li key={idx}>
                                        <span className="prog-name">{course.name}</span>
                                        <span className="prog-dur">{course.duration}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}

                {activeTab === "cutoffs" && (
                    <div className="tab-pane fade-in">
                        <div className="premium-tab-card">
                            <div className="cutoff-header">
                                <h3 className="tab-heading" style={{ margin: 0 }}>Accepted Exams</h3>
                                <div className="exam-badges">
                                    {(college.acceptedExams || []).map(e => (
                                        <span key={e} className="exam-badge">
                                            {/* Clean exam name: remove year patterns like 2024, 2023 */}
                                            {e.replace(/\s*20\d\d\s*/, "").toUpperCase()}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            {college.pastCutoffs?.length > 0 ? (
                                <div className="cutoff-list">
                                    {college.pastCutoffs.map((cutoff, idx) => (
                                        <div key={idx} className="cutoff-row">
                                            <div className="cutoff-exam">{cutoff.examId.replace(/\s*20\d\d\s*/, "").toUpperCase()} {cutoff.year}</div>
                                            <div className="cutoff-data">
                                                {cutoff.cutoff.toLowerCase().includes("check official website") ? (
                                                    <a
                                                        href={college.officialUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="cutoff-link"
                                                        style={{ color: '#2563eb', textDecoration: 'underline', cursor: 'pointer' }}
                                                    >
                                                        Check Official Website ↗
                                                    </a>
                                                ) : (
                                                    cutoff.cutoff.split('|').map((c, i) => (
                                                        <span key={i} className="cutoff-chip">{c.trim()}</span>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-tab-state">
                                    Detailed cutoff data is being aggregated. Please check back soon.
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === "placements" && (
                    <div className="tab-pane fade-in">
                        {college.placements && college.isPremium ? (
                            <div className="premium-tab-card">
                                <h3 className="tab-heading">Placement Highlights 🚀</h3>
                                <div className="placement-grid-premium">
                                    <div className="placement-card highlight">
                                        <span className="p-label">Average Package</span>
                                        <span className="p-value">{avgPkg}</span>
                                    </div>
                                    <div className="placement-card">
                                        <span className="p-label">Highest Package</span>
                                        <span className="p-value">{highPkg}</span>
                                    </div>
                                </div>

                                <div className="recruiters-section">
                                    <h4 style={{ marginBottom: '16px', fontWeight: '600', color: '#334155' }}>Top Recruiters</h4>
                                    <div className="recruiters-cloud">
                                        {(college.topRecruiters || []).map((r, i) => (
                                            <span key={i} className="recruiter-tag">{r}</span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="premium-tab-card empty-tab-state">
                                Placement reports are yet to be officially verified for this institute.
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "intelligence" && (
                    <div className="tab-pane fade-in">
                        {/* Explainability Card — constitutional score breakdown */}
                        <div className="premium-tab-card" style={{ marginBottom: '16px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <h3 className="tab-heading" style={{ margin: 0 }}>Score Explainability</h3>
                                <Button href="/methodology" variant="ghost" size="sm">Methodology →</Button>
                            </div>
                            <ExplainabilityCard college={college} />
                            <DataSourcesPanel collegeId={college.id} />
                        </div>

                        {/* Intelligence Radar — vector visualization */}
                        <div className="premium-tab-card">
                            <h3 className="tab-heading" style={{ marginBottom: '12px' }}>Vector Visualization</h3>
                            <p className="overview-text" style={{ marginBottom: '16px' }}>
                                Radar visualization of {college.shortName || college.name}&#39;s 6 scoring vectors relative to the normalized peer strata.
                            </p>
                            <div style={{ width: '100%', height: '400px', minHeight: '300px' }}>
                                <IntelligenceRadar college={college} />
                            </div>
                        </div>

                        {/* Phase XIII: Improvement Simulator — sandbox hypothetical */}
                        <ImprovementSimulator college={college} />

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
