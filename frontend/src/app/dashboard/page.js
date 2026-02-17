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

    return (
        <div className="dashboard-container">
            {/* Left Sidebar (Glass) */}
            <aside className="dashboard-sidebar">
                <div className="user-profile-mini">
                    <div className="avatar-placeholder">
                        {user.photoURL ? (
                            <img src={user.photoURL} alt="Profile" />
                        ) : (
                            <User size={24} />
                        )}
                    </div>
                    <div>
                        <h3>{user.displayName || "Student"}</h3>
                        <p>Free Account</p>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    <Link href="/dashboard" className="nav-item active">
                        <LayoutDashboard size={20} /> Dashboard
                    </Link>
                    <Link href="/dashboard/favorites" className="nav-item">
                        <Heart size={20} /> Favorites
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
                        <h1>Hello, {user.displayName ? user.displayName.split(' ')[0] : 'Student'}! 👋</h1>
                        <p>Here's what's happening with your college journey.</p>
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
                                    <span className="stat-label">Favorites</span>
                                </div>
                            </GlassPanel>

                            <GlassPanel className="stat-card">
                                <div className="stat-icon" style={{ background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' }}>
                                    <Sparkles size={24} />
                                </div>
                                <div className="stat-info">
                                    <span className="stat-value">{stats.predicted}%</span>
                                    <span className="stat-label">Profile Score</span>
                                </div>
                            </GlassPanel>
                        </div>

                        {/* Quick Actions */}
                        <section className="dashboard-section">
                            <h2>Quick Actions</h2>
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

                        {/* Recommended Section (Placeholder for AI) */}
                        <section className="dashboard-section">
                            <div className="section-header">
                                <h2>Recommended for You</h2>
                                <span className="ai-badge"><Sparkles size={12} /> AI Picked</span>
                            </div>
                            <div className="rec-grid">
                                {[1, 2].map((i) => (
                                    <div key={i} className="rec-card-skeleton">
                                        <div className="sk-img" />
                                        <div className="sk-content">
                                            <div className="sk-line w-3/4" />
                                            <div className="sk-line w-1/2" />
                                        </div>
                                    </div>
                                ))}
                                <div className="rec-cta">
                                    <p>Complete your profile to get personalized college recommendations.</p>
                                    <Button size="sm">Update Profile</Button>
                                </div>
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
