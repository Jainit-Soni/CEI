"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Container from "@/components/Container";
import { User, Settings, GraduationCap, ClipboardList, TrendingUp, Bell } from "lucide-react";
import "./dashboard.css";

export default function DashboardPage() {
    const [profile, setProfile] = useState(null);
    const [stats, setStats] = useState({
        savedColleges: 0,
        completion: 0,
        status: "Strategist",
        missing: []
    });

    useEffect(() => {
        const loadDashboardData = () => {
            // Load Saved Colleges
            const storedCart = localStorage.getItem("choice-filling-cart");
            const colleges = storedCart ? JSON.parse(storedCart) : [];

            // Load Profile
            const storedProfile = localStorage.getItem("student-profile");
            const profileData = storedProfile ? JSON.parse(storedProfile) : {
                name: "",
                targetDegree: "",
                exams: { cat: "", cmat: "", jee: "", gate: "" }
            };

            setProfile(profileData);

            // Calculate Completion
            let score = 0;
            const missing = [];

            if (profileData.name) score += 20; else missing.push("Full Name");
            if (profileData.targetDegree) score += 20; else missing.push("Target Degree");

            // Exam logic
            const isMBA = profileData.targetDegree?.includes("MBA");
            const isTech = profileData.targetDegree?.includes("Tech");

            if (isMBA) {
                if (profileData.exams?.cat) score += 30; else missing.push("CAT Score");
                if (profileData.exams?.cmat) score += 30; else missing.push("CMAT Score");
            } else if (isTech) {
                if (profileData.exams?.jee) score += 30; else missing.push("JEE Rank");
                if (profileData.exams?.gate) score += 30; else missing.push("GATE Score");
            } else {
                // If no degree selected, we can't score exams fairly, but let's count a generic "Score" field if needed
                // For now, missing degree blocks 60% of the score
            }

            let status = "Observer";
            if (score > 90) status = "Master";
            else if (score > 60) status = "Elite";
            else if (score > 30) status = "Strategist";

            setStats({
                savedColleges: colleges.length,
                completion: score,
                status,
                missing
            });
        };

        loadDashboardData();
        window.addEventListener("profile-update", loadDashboardData);
        window.addEventListener("local-storage-update", loadDashboardData);
        return () => {
            window.removeEventListener("profile-update", loadDashboardData);
            window.removeEventListener("local-storage-update", loadDashboardData);
        };
    }, []);

    const firstName = profile?.name ? profile.name.split(" ")[0] : "Academic";

    return (
        <div className="dashboard-page">
            <Container>
                <div className="dashboard-header-modern">
                    <div className="welcome-section">
                        <h1>Expert Dashboard</h1>
                        <p>Welcome back, <span className="text-highlight">{firstName}!</span> Your {stats.status} strategy is active.</p>
                    </div>
                    <div className="header-actions">
                        <div className="status-badge-premium">{stats.status}</div>
                        <Link href="/profile" className="btn-icon-modern" title="Profile Settings"><Settings size={20} /></Link>
                    </div>
                </div>

                <div className="dashboard-grid">
                    {/* Top Tier Metrics */}
                    <div className="stats-row">
                        <div className="stat-card-modern">
                            <div className="stat-icon blue"><GraduationCap /></div>
                            <div className="stat-info">
                                <span className="stat-label">Discovery List</span>
                                <span className="stat-value">{stats.savedColleges} Colleges</span>
                            </div>
                        </div>
                        <div className="stat-card-modern">
                            <div className="stat-icon green"><ClipboardList /></div>
                            <div className="stat-info">
                                <span className="stat-label">Strategy Status</span>
                                <span className="stat-value">{stats.status}</span>
                            </div>
                        </div>
                        <div className="stat-card-modern">
                            <div className="stat-icon purple"><TrendingUp /></div>
                            <div className="stat-info">
                                <span className="stat-label">Admission readiness</span>
                                <span className="stat-value">{stats.completion}%</span>
                            </div>
                        </div>
                    </div>

                    {/* Content Hub */}
                    <div className="dashboard-main-area">
                        <div className="action-cards">
                            <div className="intelligence-group">
                                <Link href="/my-list" className="action-card-link">
                                    <div className="action-card gradient-blue">
                                        <h3>Strategic Selection 🎯</h3>
                                        <p>Rank your preferred institutions and generate your final PDF report.</p>
                                        <span className="action-btn">Manage Priority List &rarr;</span>
                                    </div>
                                </Link>

                                <Link href="/colleges" className="action-card-link">
                                    <div className="action-card gradient-purple">
                                        <h3>Institutional Discovery 🏢</h3>
                                        <p>AI-driven matching against 100+ verified Tier 1 & 2 universities.</p>
                                        <span className="action-btn">Find More Matches &rarr;</span>
                                    </div>
                                </Link>
                            </div>

                            {/* Intelligent Guidance */}
                            {stats.missing.length > 0 && (
                                <div className="guidance-card">
                                    <div className="guidance-header">
                                        <Bell size={20} className="pulse-icon" />
                                        <h4>Optimization Checklist</h4>
                                    </div>
                                    <div className="guidance-list">
                                        {stats.missing.map(item => (
                                            <div key={item} className="guidance-item">
                                                <span className="bullet"></span>
                                                <span className="text">Add your <strong>{item}</strong> for precise matching.</span>
                                                <Link href="/profile" className="fix-link">Fix &rarr;</Link>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Readiness Orb */}
                        <div className="profile-summary-card">
                            <div className="card-header">
                                <User size={20} />
                                <h3>Strategy Strength</h3>
                            </div>
                            <div className="profile-content">
                                <div className="profile-orbit">
                                    <div className="orbit-text">{stats.completion}%</div>
                                    <svg viewBox="0 0 36 36" className="circular-chart">
                                        <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                        <path
                                            className="circle"
                                            strokeDasharray={`${stats.completion}, 100`}
                                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        />
                                    </svg>
                                </div>
                                <div className="profile-details">
                                    <p className="strategy-level">Level: <strong>{stats.status}</strong></p>
                                    <p className="text-muted">
                                        {stats.completion === 100
                                            ? "Your profile is fully optimized for AI discovery."
                                            : "Unlock elite insights by completing your strategy profile."}
                                    </p>
                                    <Link href="/profile" className="btn-text">Refine Profile &rarr;</Link>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Container>
        </div>
    );
}
