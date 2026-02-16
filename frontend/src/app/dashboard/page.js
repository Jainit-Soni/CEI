"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Container from "@/components/Container";
import { User, Settings, GraduationCap, ClipboardList, TrendingUp, Bell, Heart, ExternalLink, Search } from "lucide-react";
import { useFavorites } from "@/lib/useFavorites";
import "./dashboard.css";

export default function DashboardPage() {
    const { favorites } = useFavorites();
    const [profile, setProfile] = useState(null);
    const [stats, setStats] = useState({
        savedColleges: 0,
        completion: 75,
        status: "Strategist"
    });

    useEffect(() => {
        const loadDashboardData = () => {
            // Load Saved Colleges (Cart)
            const storedCart = localStorage.getItem("choice-filling-cart");
            const colleges = storedCart ? JSON.parse(storedCart) : [];

            // Load Scores
            const storedScores = localStorage.getItem("user_exam_scores");
            const scores = storedScores ? JSON.parse(storedScores) : {};
            const scoreCount = Object.keys(scores).length;

            // Load Profile
            const storedProfile = localStorage.getItem("student-profile");
            const profileData = storedProfile ? JSON.parse(storedProfile) : {
                name: "",
                targetDegree: "",
                exams: { cat: "", cmat: "", jee: "", gate: "" }
            };

            setProfile(profileData);

            // Calculate Completion Code
            let completionScore = 0;
            if (profileData.name) completionScore += 20;
            if (colleges.length > 0) completionScore += 30; // Cart usage
            if (scoreCount > 0) completionScore += 30; // Scores entered
            if (favorites?.colleges?.length > 0) completionScore += 20; // Favorites used

            let statusLabel = "Novice";
            if (completionScore > 30) statusLabel = "Explorer";
            if (completionScore > 60) statusLabel = "Strategist";
            if (completionScore > 90) statusLabel = "Master";

            setStats({
                savedColleges: colleges.length,
                completion: completionScore || 15,
                status: statusLabel,
                scoreCount: scoreCount
            });
        };

        loadDashboardData();
        window.addEventListener("profile-update", loadDashboardData);
        window.addEventListener("local-storage-update", loadDashboardData);
        return () => {
            window.removeEventListener("profile-update", loadDashboardData);
            window.removeEventListener("local-storage-update", loadDashboardData);
        };
    }, [favorites]);

    const firstName = profile?.name ? profile.name.split(" ")[0] : "Academic";

    return (
        <div className="dashboard-page">
            <Container>
                {/* 1. Welcome Header */}
                <div className="dashboard-header-v2">
                    <div className="welcome-text">
                        <h1>Expert Dashboard</h1>
                        <p>Welcome back, <span className="text-highlight">{firstName}!</span> Your {stats.status} strategy is active.</p>
                    </div>
                    <div className="header-status">
                        <div className="status-badge-v2">{stats.status}</div>
                    </div>
                </div>

                {/* 2. Key Metrics Row */}
                <div className="stats-row-v2">
                    <div className="stat-card-v2 blue">
                        <div className="stat-icon-wrapper"><GraduationCap /></div>
                        <div className="stat-content">
                            <span className="sc-value">{stats.savedColleges}</span>
                            <span className="sc-label">Discovery List</span>
                        </div>
                    </div>
                    <div className="stat-card-v2 green">
                        <div className="stat-icon-wrapper"><ClipboardList /></div>
                        <div className="stat-content">
                            <span className="sc-value">{stats.scoreCount || 0}</span>
                            <span className="sc-label">Exams Tracked</span>
                        </div>
                    </div>
                    <div className="stat-card-v2 purple">
                        <div className="stat-icon-wrapper"><TrendingUp /></div>
                        <div className="stat-content">
                            <span className="sc-value">{stats.completion}%</span>
                            <span className="sc-label">Readiness Score</span>
                        </div>
                    </div>
                </div>

                {/* 3. Main Dashboard Grid */}
                <div className="dashboard-grid-v2">
                    {/* LEFT COLUMN: Actions & Favorites */}
                    <div className="main-col">

                        {/* Quick Actions */}
                        <div className="quick-actions-grid">
                            <Link href="/my-list" className="qa-card blue-gradient">
                                <div className="qa-icon"><ClipboardList size={24} /></div>
                                <div className="qa-text">
                                    <h3>Priority Roadmap</h3>
                                    <p>Manage your strategic college list & PDF report</p>
                                </div>
                                <div className="qa-arrow">&rarr;</div>
                            </Link>

                            <Link href="/colleges" className="qa-card purple-gradient">
                                <div className="qa-icon"><Search size={24} /></div>
                                <div className="qa-text">
                                    <h3>College Finder</h3>
                                    <p>Browse 100+ verified Tier 1 & 2 institutes</p>
                                </div>
                                <div className="qa-arrow">&rarr;</div>
                            </Link>
                        </div>

                        {/* Full Favorites Grid */}
                        <div className="section-header">
                            <h2>My Saved Colleges</h2>
                            <span className="badge-count">{favorites.colleges.length}</span>
                        </div>

                        {favorites.colleges.length === 0 ? (
                            <div className="empty-favorites-v2">
                                <div className="empty-icon-circle">❤️</div>
                                <h3>No favorites yet</h3>
                                <p>Start exploring colleges to build your personal shortlist.</p>
                                <Link href="/colleges" className="btn-explore">Browse Catalog</Link>
                            </div>
                        ) : (
                            <div className="favorites-grid-v2">
                                {favorites.colleges.map((college) => (
                                    <Link key={college.id} href={`/college/${college.id}`} className="fav-card-v2">
                                        <div className="fav-card-header">
                                            <div className="fav-card-icon">{college.name.charAt(0)}</div>
                                            <div className="fav-card-tier">Tier {college.rankingTier || "1"}</div>
                                        </div>
                                        <div className="fav-card-body">
                                            <h3>{college.name}</h3>
                                            <p className="fav-location">{college.location?.split(',')[0]}</p>
                                        </div>
                                        <div className="fav-card-footer">
                                            <span>View Details</span>
                                            <ExternalLink size={14} />
                                        </div>
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: Sidebar (Profile & Updates) */}
                    <div className="sidebar-col">
                        {/* Profile Strength Card */}
                        <div className="sidebar-card">
                            <div className="sidebar-header">
                                <User size={18} />
                                <h3>Profile Strength</h3>
                            </div>
                            <div className="profile-chart-container">
                                <div className="chart-circle">
                                    <svg viewBox="0 0 36 36" className="circular-chart-v2">
                                        <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                        <path
                                            className="circle-v2"
                                            strokeDasharray={`${stats.completion}, 100`}
                                            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        />
                                    </svg>
                                    <div className="chart-text">
                                        <span className="percent">{stats.completion}%</span>
                                    </div>
                                </div>
                                <div className="profile-steps">
                                    <div className={`step-item ${profile?.name ? 'done' : ''}`}>
                                        <div className="step-dot"></div>
                                        <span>Personal Details</span>
                                    </div>
                                    <div className={`step-item ${stats.scoreCount > 0 ? 'done' : ''}`}>
                                        <div className="step-dot"></div>
                                        <span>Exam Scores</span>
                                    </div>
                                    <div className={`step-item ${favorites.colleges.length > 0 ? 'done' : ''}`}>
                                        <div className="step-dot"></div>
                                        <span>First Favorite</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Recent Activity / Tip */}
                        <div className="sidebar-card tip-card">
                            <div className="sidebar-header">
                                <Bell size={18} />
                                <h3>Pro Tip</h3>
                            </div>
                            <p className="tip-text">
                                Did you know? Comparing colleges side-by-side helps you spot subtle differences in ROI and placement stats.
                            </p>
                            <Link href="/compare" className="tip-link">Go to Compare Tool &rarr;</Link>
                        </div>
                    </div>
                </div>
            </Container>
        </div>
    );
}
