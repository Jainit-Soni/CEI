"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import GlassPanel from "@/components/GlassPanel";
import Button from "@/components/Button";
import { useFavorites } from "@/lib/useFavorites";
import Link from "next/link";
import { Bookmark, Calendar, Clock, LogOut, ChevronRight, User } from "lucide-react";
import "./dashboard.css";

export default function DashboardPage() {
    const { user, loading: authLoading, logout } = useAuth();
    const { favorites, clearAllFavorites } = useFavorites();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState("overview");

    useEffect(() => {
        if (!authLoading && !user) {
            router.push("/login");
        }
    }, [user, authLoading, router]);

    if (authLoading || !user) {
        return (
            <main className="dashboard-page loading">
                <div className="spinner"></div>
                <h2>Loading your dashboard...</h2>
            </main>
        );
    }

    const { colleges: rawColleges = [], exams = [] } = favorites;
    // Filter out invalid colleges defensively to prevent 404 prefetching
    const colleges = rawColleges.filter(c => c && c.id && c.id !== "undefined");

    // Fallback if deadlines are not populated yet
    const deadlines = user.deadlines || [];

    const handleLogout = async () => {
        await logout();
        router.push("/");
    };

    return (
        <main className="dashboard-page">
            <div className="dashboard-container">
                {/* Sidebar Menu */}
                <aside className="dashboard-sidebar">
                    <GlassPanel className="sidebar-panel">
                        <div className="user-profile">
                            <div className="avatar">
                                {user.avatarUrl ? (
                                    <img src={user.avatarUrl} alt="Avatar" />
                                ) : (
                                    <User size={32} color="var(--color-primary)" />
                                )}
                            </div>
                            <h3>{user.displayName || "Student"}</h3>
                            <p>{user.email}</p>
                        </div>

                        <nav className="dashboard-nav">
                            <button
                                className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
                                onClick={() => setActiveTab('overview')}
                            >
                                <Bookmark size={18} /> Overview
                            </button>
                            <button
                                className={`nav-item ${activeTab === 'colleges' ? 'active' : ''}`}
                                onClick={() => setActiveTab('colleges')}
                            >
                                <Bookmark size={18} /> Saved Colleges ({colleges.length})
                            </button>
                            <button
                                className={`nav-item ${activeTab === 'deadlines' ? 'active' : ''}`}
                                onClick={() => setActiveTab('deadlines')}
                            >
                                <Calendar size={18} /> Deadlines ({deadlines.length})
                            </button>
                        </nav>

                        <div className="sidebar-footer">
                            <button className="logout-btn" onClick={handleLogout}>
                                <LogOut size={16} /> Sign Out
                            </button>
                        </div>
                    </GlassPanel>
                </aside>

                {/* Main Content Area */}
                <section className="dashboard-main">
                    <div className="dashboard-header">
                        <h1>{activeTab === "overview" ? "Welcome back!" :
                            activeTab === "colleges" ? "Your Shortlist" : "Application Deadlines"}</h1>
                        <p className="dashboard-subtitle">
                            Manage your higher education journey in one place.
                        </p>
                    </div>

                    {activeTab === "overview" && (
                        <div className="overview-grid">
                            {/* Summary Cards */}
                            <GlassPanel className="summary-card">
                                <div className="card-icon blue"><Bookmark size={24} /></div>
                                <div className="card-info">
                                    <h3>{colleges.length}</h3>
                                    <p>Saved Colleges</p>
                                </div>
                                <Link href="/colleges" className="card-link"><ChevronRight size={18} /></Link>
                            </GlassPanel>

                            <GlassPanel className="summary-card">
                                <div className="card-icon purple"><Calendar size={24} /></div>
                                <div className="card-info">
                                    <h3>{deadlines.length}</h3>
                                    <p>Upcoming Deadlines</p>
                                </div>
                                <button className="card-link" onClick={() => setActiveTab('deadlines')}><ChevronRight size={18} /></button>
                            </GlassPanel>

                            <GlassPanel className="summary-card">
                                <div className="card-icon orange"><Bookmark size={24} /></div>
                                <div className="card-info">
                                    <h3>{exams.length}</h3>
                                    <p>Tracked Exams</p>
                                </div>
                                <Link href="/exams" className="card-link"><ChevronRight size={18} /></Link>
                            </GlassPanel>

                            {/* Recent Activity or Next Steps */}
                            <div className="action-section">
                                <h2>Next Steps</h2>
                                <GlassPanel className="action-panel">
                                    {colleges.length === 0 ? (
                                        <div className="empty-state">
                                            <p>You haven't saved any colleges yet. Start exploring!</p>
                                            <Link href="/colleges">
                                                <Button size="sm">Browse Colleges</Button>
                                            </Link>
                                        </div>
                                    ) : (
                                        <div className="empty-state">
                                            <p>Ready to compare your shortlisted colleges?</p>
                                            <Link href="/compare">
                                                <Button size="sm" variant="outline">Compare Now</Button>
                                            </Link>
                                        </div>
                                    )}
                                </GlassPanel>
                            </div>
                        </div>
                    )}

                    {activeTab === "colleges" && (
                        <div className="list-section">
                            {colleges.length === 0 ? (
                                <GlassPanel className="empty-panel">
                                    <Bookmark size={48} color="#9ca3af" style={{ marginBottom: '1rem' }} />
                                    <h3>Your shortlist is empty</h3>
                                    <p>Save colleges while browsing to easily access them here.</p>
                                    <Link href="/colleges"><Button className="mt-4">Explore Colleges</Button></Link>
                                </GlassPanel>
                            ) : (
                                <div className="item-list">
                                    {colleges.map((c, i) => (
                                        <GlassPanel key={i} className="list-item">
                                            <div className="item-details">
                                                <h4>{c.name || c.id}</h4>
                                                <span className="item-tag">College</span>
                                            </div>
                                            <div className="item-actions">
                                                <Link href={`/college/${c.id}`}><Button size="sm" variant="outline">View</Button></Link>
                                            </div>
                                        </GlassPanel>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "deadlines" && (
                        <div className="list-section">
                            {deadlines.length === 0 ? (
                                <GlassPanel className="empty-panel">
                                    <Calendar size={48} color="#9ca3af" style={{ marginBottom: '1rem' }} />
                                    <h3>No upcoming deadlines</h3>
                                    <p>Add custom reminders or track official exam dates.</p>
                                    <Button className="mt-4" onClick={() => alert("Deadline builder coming soon.")}>Add Deadline</Button>
                                </GlassPanel>
                            ) : (
                                <div className="item-list">
                                    {deadlines.map((d, i) => (
                                        <GlassPanel key={i} className="list-item deadline-item">
                                            <div className="deadline-date black">
                                                <span className="month">{new Date(d.date).toLocaleString('default', { month: 'short' })}</span>
                                                <span className="day">{new Date(d.date).getDate()}</span>
                                            </div>
                                            <div className="item-details">
                                                <h4>{d.title}</h4>
                                                <p className="item-notes">{d.notes}</p>
                                                <span className="item-tag deadline-tag"><Clock size={12} /> {d.type}</span>
                                            </div>
                                        </GlassPanel>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
