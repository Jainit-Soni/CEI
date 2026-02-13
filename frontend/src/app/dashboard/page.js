"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Container from "@/components/Container";
import { User, Settings, GraduationCap, ClipboardList, TrendingUp, Bell, Heart, ExternalLink } from "lucide-react";
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

            setStats(prev => ({
                ...prev,
                savedColleges: colleges.length
            }));
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

                            {/* Favorites Hub */}
                            <div className="favorites-hub-card">
                                <div className="card-header-premium">
                                    <Heart size={20} color="#ef4444" fill="#ef4444" />
                                    <h3>My Favorites</h3>
                                </div>

                                {favorites.colleges.length === 0 && favorites.exams.length === 0 ? (
                                    <div className="empty-fav-state">
                                        <p>No favorites yet. Explore colleges to add some!</p>
                                        <Link href="/colleges" className="text-link">Browse Catalog &rarr;</Link>
                                    </div>
                                ) : (
                                    <div className="favorites-grid-mini">
                                        {favorites.colleges.slice(0, 4).map(c => (
                                            <Link key={c.id} href={`/college/${c.id}`} className="fav-item-row">
                                                <div className="fav-info">
                                                    <span className="fav-name">{c.name}</span>
                                                    <span className="fav-meta">{c.location?.split(',')[0]}</span>
                                                </div>
                                                <ExternalLink size={14} className="fav-arrow" />
                                            </Link>
                                        ))}
                                        {favorites.colleges.length > 4 && (
                                            <p className="more-fav-link">+{favorites.colleges.length - 4} more colleges...</p>
                                        )}
                                    </div>
                                )}
                            </div>
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
                                        Your profile is active and tracking institutional discovery in real-time.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Container>
        </div>
    );
}
