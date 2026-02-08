"use client";

import { useState } from "react";
import GlassPanel from "./GlassPanel";
import ROICalculator from "./ROICalculator";
import "./CollegeTabs.css";

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

    const tabs = [
        { id: "overview", label: "Overview", icon: "🏢" },
        { id: "cutoffs", label: "Cutoffs", icon: "📊" },
        { id: "placements", label: "Placements", icon: "💼" },
        { id: "roi", label: "ROI Analysis", icon: "💰" }
    ];

    return (
        <div className="college-tabs-container">
            {/* Tab Navigation */}
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
            </div>

            {/* Tab Content */}
            <div className="tab-content-area">

                {activeTab === "overview" && (
                    <div className="tab-pane fade-in">
                        <div className="overview-grid">
                            <GlassPanel className="ov-panel" variant="soft">
                                <h3>About {college.shortName || "Institute"}</h3>
                                <p className="overview-text">
                                    {college.overview || `${college.name} is a premier institute located in ${college.location}. It offers a wide range of programs and has a strong reputation for academic excellence.`}
                                </p>

                                <div className="detail-meta-blocks">
                                    <div className="meta-block">
                                        <strong>Campus Size</strong>
                                        <span>{college.campus || "N/A"}</span>
                                    </div>
                                    <div className="meta-block">
                                        <strong>ownership</strong>
                                        <span>{college.meta?.ownership || "Private"}</span>
                                    </div>
                                    <div className="meta-block">
                                        <strong>Estd. Year</strong>
                                        <span>{college.meta?.establishedYear || "—"}</span>
                                    </div>
                                </div>
                            </GlassPanel>

                            <GlassPanel className="ov-panel" variant="soft">
                                <h3>Programs Offered</h3>
                                <ul className="program-list-compact">
                                    {(college.courses || []).map((course, idx) => (
                                        <li key={idx}>
                                            <span className="prog-name">{course.name}</span>
                                            <span className="prog-dur">{course.duration}</span>
                                        </li>
                                    ))}
                                </ul>
                            </GlassPanel>
                        </div>
                    </div>
                )}

                {activeTab === "cutoffs" && (
                    <div className="tab-pane fade-in">
                        <GlassPanel variant="soft">
                            <div className="cutoff-header">
                                <h3>Accepted Exams & Cutoffs</h3>
                                <div className="exam-badges">
                                    {(college.acceptedExams || []).map(e => (
                                        <span key={e} className="exam-badge">{e.toUpperCase()}</span>
                                    ))}
                                </div>
                            </div>

                            {college.pastCutoffs?.length > 0 ? (
                                <div className="cutoff-list">
                                    {college.pastCutoffs.map((cutoff, idx) => (
                                        <div key={idx} className="cutoff-row">
                                            <div className="cutoff-exam">{cutoff.examId.toUpperCase()} {cutoff.year}</div>
                                            <div className="cutoff-data">
                                                {cutoff.cutoff.split('|').map((c, i) => (
                                                    <span key={i} className="cutoff-chip">{c.trim()}</span>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="empty-tab-state">
                                    Detailed cutoff data is being aggregated. Please check back soon.
                                </div>
                            )}
                        </GlassPanel>
                    </div>
                )}

                {activeTab === "placements" && (
                    <div className="tab-pane fade-in">
                        {college.placements ? (
                            <GlassPanel variant="soft">
                                <h3>Placement Highlights 🚀</h3>
                                <div className="placement-grid-premium">
                                    <div className="placement-card highlight">
                                        <span className="p-label">Average Package</span>
                                        <span className="p-value">{college.placements.averagePackage}</span>
                                    </div>
                                    <div className="placement-card">
                                        <span className="p-label">Highest Package</span>
                                        <span className="p-value">{college.placements.highestPackage}</span>
                                    </div>
                                </div>

                                <div className="recruiters-section">
                                    <h4>Top Recruiters</h4>
                                    <div className="recruiters-cloud">
                                        {(college.topRecruiters || []).map((r, i) => (
                                            <span key={i} className="recruiter-tag">{r}</span>
                                        ))}
                                    </div>
                                </div>
                            </GlassPanel>
                        ) : (
                            <div className="empty-tab-state">
                                Placement reports are yet to be verified for this institute.
                            </div>
                        )}
                    </div>
                )}

                {activeTab === "roi" && (
                    <div className="tab-pane fade-in">
                        <ROICalculator
                            title={`Is ${college.shortName || college.name} worth it?`}
                            initialData={{
                                tuition: parseCurrency(college.tuition) || 150000,
                                avgPackage: parseCurrency(college.placements?.averagePackage) || 600000,
                                duration: 4
                            }}
                        />
                    </div>
                )}

            </div>
        </div>
    );
}
