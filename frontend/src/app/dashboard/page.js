"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import GlassPanel from "@/components/GlassPanel";
import Button from "@/components/Button"; // Keep existing imports
import {
    LayoutDashboard,
    Heart,
    TrendingUp,
    Settings,
    LogOut,
    User,
    ChevronRight,
    Sparkles,
    MapPin,
    GraduationCap,
    Clock
} from "lucide-react";
import DeadlineWatchtower from "@/components/DeadlineWatchtower";
import "./dashboard.css"; // We'll update this next

export default function Dashboard() {
    const { user, loading, logout } = useAuth();
    const router = useRouter();
    const [stats, setStats] = useState({
        favorites: 0,
        applications: 0,
        predicted: 0
    });

    useEffect(() => {
        if (!loading && !user) {
            router.push("/");
        }
    }, [user, loading, router]);

    // Mock loading of stats (replace with real API if needed)
    useEffect(() => {
        if (user) {
            // Simulate fetch
            setTimeout(() => {
                setStats({
                    favorites: 12,
                    applications: 5,
                    predicted: 85
                });
            }, 500);
        }
    }, [user]);

    if (loading || !user) return null;

    const quickLinks = [
        { icon: <Heart size={20} />, label: "My Favorites", href: "/dashboard/favorites", color: "#ec4899" },
        { icon: <TrendingUp size={20} />, label: "Analytics", href: "/dashboard/analytics", color: "#8b5cf6" },
        { icon: <MapPin size={20} />, label: "College Map", href: "/map", color: "#10b981" },
        { icon: <GraduationCap size={20} />, label: "Exams", href: "/exams", color: "#f59e0b" },
    ];

    // --- GAMIFICATION LOGIC ---
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 18) return "Good afternoon";
        return "Good evening";
    };

    const firstName = user?.displayName ? user.displayName.split(' ')[0] : 'Student';
    const profileScore = stats.predicted || 0; // Using predicted score as generic "Completeness" for now

    // --- SVG KINETIC RING CALCULATIONS ---
    const radius = 38;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (profileScore / 100) * circumference;

    const quickLinks = [
        { icon: <Heart size={20} />, label: "My Favorites", href: "/dashboard/favorites", color: "#ec4899" },
        { icon: <TrendingUp size={20} />, label: "Analytics", href: "/dashboard/analytics", color: "#8b5cf6" },
        { icon: <MapPin size={20} />, label: "College Map", href: "/map", color: "#10b981" },
        { icon: <GraduationCap size={20} />, label: "Exams", href: "/exams", color: "#f59e0b" },
    ];

    return (
        <div className="dashboard-container">
            {/* Left Sidebar (Glass) */}
            <aside className="dashboard-sidebar">
                <div className="user-profile-mini">
                    <div className="kinetic-avatar-container">
                        {/* Kinetic SVG Ring */}
                        <svg className="kinetic-ring" width="96" height="96" viewBox="0 0 96 96">
                            {/* Background Track */}
                            <circle cx="48" cy="48" r={radius} fill="none" stroke="rgba(0,0,0,0.05)" strokeWidth="6" />
                            {/* Animated Progress Track */}
                            <circle
                                cx="48"
                                cy="48"
                                r={radius}
                                fill="none"
                                stroke="url(#gradient)"
                                strokeWidth="6"
                                strokeLinecap="round"
                                strokeDasharray={circumference}
                                strokeDashoffset={strokeDashoffset}
                                className="kinetic-progress"
                                transform="rotate(-90 48 48)"
                            />
                            <defs>
                                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                    <stop offset="0%" stopColor="#4f46e5" />
                                    <stop offset="100%" stopColor="#ec4899" />
                                </linearGradient>
                            </defs>
                        </svg>

                        {/* Inner Avatar */}
                        <div className="avatar-placeholder">
                            {user?.photoURL ? (
                                <img src={user.photoURL} alt="Profile" />
                            ) : (
                                <User size={24} />
                            )}
                        </div>

                        {/* Score Badge */}
                        <div className="avatar-score-badge">
                            {profileScore}%
                        </div>
                    </div>

                    <div className="user-profile-info">
                        <h3>{firstName}</h3>
                        <p>Free Account</p>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <Link href="/dashboard" className="nav-item active">
                        <LayoutDashboard size={20} /> Command Center
                    </Link>
                    <Link href="/my-list" className="nav-item">
                        <Heart size={20} /> Priority Roadmap
                    </Link>

                    <div className="nav-divider" />

                    <button onClick={logout} className="nav-item logout">
                        <LogOut size={20} /> Sign Out
                    </button>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="dashboard-content">
                <header className="content-header">
                    <div>
                        <h1>{getGreeting()}, {firstName}! 👋</h1>
                        <p>Your strategic command center for college admissions.</p>
                    </div>
                    <Button variant="outline" href="/colleges">Explore Colleges</Button>
                </header>

                {/* Main Content Area: Stats + Watchtower */}
                <div className="dashboard-grid">
                    <div className="stats-column">
                        {/* Quick Stats Row */}
                        <div className="stats-grid-row">
                            <GlassPanel className="stat-card">
                                <div className="stat-icon" style={{ background: 'rgba(236, 72, 153, 0.1)', color: '#ec4899' }}>
                                    <Heart size={24} />
                                </div>
                                <div className="stat-info">
                                    <span className="stat-value">{stats.favorites}</span>
                                    <span className="stat-label">Roadmap Priorities</span>
                                </div>
                            </GlassPanel>

                            <GlassPanel className="stat-card">
                                <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                                    <Sparkles size={24} />
                                </div>
                                <div className="stat-info">
                                    <span className="stat-value">{profileScore}%</span>
                                    <span className="stat-label">Profile Strength</span>
                                </div>
                            </GlassPanel>
                        </div>

                        {/* INTELLIGENT NEXT STEPS */}
                        <section className="dashboard-section">
                            <div className="section-header">
                                <h2>Next Steps to Unlock Premium AI Insights</h2>
                                <span className="ai-badge"><Sparkles size={12} /> Priority Queue</span>
                            </div>

                            <div className="next-steps-list">
                                {/* Step 1: Roadmap Completion */}
                                <Link href="/colleges" className={`next-step-card ${stats.favorites >= 3 ? 'completed' : ''}`}>
                                    <div className="step-indicator">1</div>
                                    <div className="step-content">
                                        <h3>Build your Priority Roadmap</h3>
                                        <p>Add at least 3 colleges {stats.favorites > 0 && stats.favorites < 3 ? `(Add ${3 - stats.favorites} more)` : ''} to build a baseline algorithm map.</p>
                                    </div>
                                    <ChevronRight size={20} className="step-arrow text-slate-300" />
                                </Link>

                                {/* Step 2: Exam Score Entry */}
                                <button className={`next-step-card ${profileScore >= 90 ? 'completed' : ''}`} style={{ textAlign: 'left', width: '100%', border: 'none', background: 'white' }}>
                                    <div className="step-indicator">2</div>
                                    <div className="step-content">
                                        <h3>Input Exam Metrics</h3>
                                        <p>Feed your actual or expected percentiles (CAT, XAT, NMAT) into the engine to unlock predictive odds.</p>
                                    </div>
                                    <ChevronRight size={20} className="step-arrow text-slate-300" />
                                </button>

                                {/* Step 3: Run True ROI */}
                                <Link href="/roi-calculator" className="next-step-card actionable-pulse">
                                    <div className="step-indicator">3</div>
                                    <div className="step-content">
                                        <h3>Run the True ROI Simulator</h3>
                                        <p>Map out the exact break-even timeline for your top prioritized colleges. Stop guessing your 10-year outlook.</p>
                                    </div>
                                    <ChevronRight size={20} className="step-arrow text-indigo-500" />
                                </Link>
                            </div>
                        </section>

                        {/* Quick Actions */}
                        <section className="dashboard-section mt-8">
                            <h2>Fast Travel</h2>
                            <div className="quick-links-grid">
                                {quickLinks.map((link, idx) => (
                                    <Link key={idx} href={link.href} className="quick-link-card">
                                        <div className="ql-icon" style={{ color: link.color }}>{link.icon}</div>
                                        <span>{link.label}</span>
                                        <ChevronRight size={16} className="ql-arrow" />
                                    </Link>
                                ))}
                            </div>
                        </section>
                    </div>

                    {/* Right Column: Watchtower */}
                    <div className="watchtower-column">
                        <DeadlineWatchtower />
                    </div>
                </div>
            </main>
        </div>
    );
}
