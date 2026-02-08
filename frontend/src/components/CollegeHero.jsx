"use client";

import Image from "next/image";
import GlassPanel from "./GlassPanel";
import AddToChoiceButton from "./AddToChoiceButton";
import { MapPin, Award, IndianRupee, BookOpen } from "lucide-react";
import "./CollegeHero.css";

export default function CollegeHero({ college }) {
    if (!college) return <div className="hero-skeleton" />;

    return (
        <div className="college-hero-container">
            <GlassPanel className="college-hero-card" variant="soft">
                <div className="hero-content">
                    {/* Left: Logo & badges */}
                    <div className="hero-identity">
                        <div className="college-logo-wrapper">
                            {college.logo ? (
                                <img
                                    src={college.logo}
                                    alt={college.name}
                                    className="college-logo-img"
                                    onError={(e) => {
                                        e.target.onerror = null;
                                        e.target.src = "https://via.placeholder.com/120?text=U";
                                    }}
                                />
                            ) : (
                                <div className="college-logo-placeholder">
                                    {college.name.charAt(0)}
                                </div>
                            )}
                        </div>
                        <div className="hero-titles">
                            <h1 className="hero-name">{college.name}</h1>
                            <div className="hero-badges">
                                <span className="hero-badge badge-loc">
                                    <MapPin size={14} /> {college.location}
                                </span>
                                {college.rankingTier && (
                                    <span className="hero-badge badge-tier">
                                        <Award size={14} /> {college.rankingTier}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: Stats Grid */}
                    <div className="hero-stats-grid">
                        <div className="stat-item">
                            <span className="stat-label">Avg Package</span>
                            <span className="stat-value highlight-green">
                                {college.placements?.averagePackage || "N/A"}
                            </span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Total Fees</span>
                            <span className="stat-value">
                                {college.tuition || "Check Details"}
                            </span>
                        </div>
                        <div className="stat-item">
                            <span className="stat-label">Exams</span>
                            <span className="stat-value small-text">
                                {college.acceptedExams?.join(", ") || "Merit Based"}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Bottom: Actions */}
                <div className="hero-actions">
                    <button className="apply-now-btn">
                        Apply Now 🚀
                    </button>
                    <AddToChoiceButton college={college} variant="glass" className="hero-shortlist-btn" />
                </div>
            </GlassPanel>
        </div>
    );
}
