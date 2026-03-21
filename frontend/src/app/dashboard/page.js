"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/AuthContext";
import { useRouter } from "next/navigation";
import { 
    Trophy, 
    Sparkles, 
    Calendar, 
    User, 
    LayoutDashboard, 
    Bookmark, 
    History, 
    ShieldCheck, 
    LogOut,
    Plus,
    ChevronRight,
    Binary,
    Settings
} from "lucide-react";
import GlassPanel from "@/components/GlassPanel";
import Button from "@/components/Button";
import Link from "next/link";
import IdentityPulseCard from "@/components/IdentityPulseCard";
import NextBestAction from "@/components/NextBestAction";
import ShortlistHealth from "@/components/ShortlistHealth";
import { api } from "@/lib/api";
import "./dashboard.css";

export default function DashboardPage() {
    const { user, loading: authLoading, logout } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState("overview");
    const [intelligence, setIntelligence] = useState(null);
    const [intelLoading, setIntelLoading] = useState(true);
    const [isMounted, setIsMounted] = useState(false);
    const [localList, setLocalList] = useState([]);

    useEffect(() => {
        setIsMounted(true);
        if (!authLoading && !user) {
            router.push("/auth/login");
        }
        
        // Restore active tab from patterns
        const savedTab = localStorage.getItem("cei_dashboard_prefs");
        if (savedTab) {
            setActiveTab(savedTab);
        }
    }, [user, authLoading, router]);

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        localStorage.setItem("cei_dashboard_prefs", tab);
    };

    // Reactive Local List Sync
    useEffect(() => {
        const updateList = () => {
            if (typeof window !== "undefined") {
                const stored = localStorage.getItem("choice-filling-cart");
                const items = stored ? JSON.parse(stored) : [];
                setLocalList(items);
            }
        };
        updateList();
        window.addEventListener("storage", updateList);
        window.addEventListener("local-storage-update", updateList);
        return () => {
            window.removeEventListener("storage", updateList);
            window.removeEventListener("local-storage-update", updateList);
        };
    }, []);

    useEffect(() => {
        const fetchIntelligence = async () => {
            if (!user) return;
            try {
                // Corrected route to match backend implementation
                // Use standardized 'api' instance from @/lib/api
                const { data: response } = await api.get(`/api/intelligence/dashboard`, {
                    params: { uid: user.uid || user.id }
                });
                setIntelligence(response.data);
            } catch (error) {
                console.error("Error fetching intelligence:", error);
            } finally {
                setIntelLoading(false);
            }
        };

        if (user) fetchIntelligence();
    }, [user]);

    if (authLoading || !user || !isMounted) {
        return (
            <div className="loading-overlay">
                <div className="loading-spinner" />
            </div>
        );
    }

    const getTimeGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good morning";
        if (hour < 17) return "Good afternoon";
        return "Good evening";
    };

    const favoriteColleges = user.favoriteColleges || [];
    const priorityItems = favoriteColleges.filter(c => c && c.priority);
    const colleges = favoriteColleges.filter(c => c && c.id && c.id !== "undefined");
    const exams = user.exams || [];
    const deadlines = user.deadlines || [];

    return (
        <main className="dashboard-reboot">
            <div className="dashboard-reboot-container">
                {/* 2. INTELLIGENCE HUD */}
                <header className="iq-hud">
                    {/* Profile Node */}
                    <GlassPanel className="iq-node iq-profile-node">
                        <div className="iq-avatar-wrapper">
                            {user.photoURL ? (
                                <img src={user.photoURL} alt={user.displayName} />
                            ) : (
                                <div className="avatar-placeholder"><User size={40} /></div>
                            )}
                            <div className="iq-avatar-glow" />
                        </div>
                        <h2>{user.displayName?.split(' ')[0] || "Student"}</h2>
                        <p>Batch 2026 • Premium</p>
                    </GlassPanel>

                    {/* Main Greeting Node */}
                    <div className="iq-header-node">
                        <h1>{getTimeGreeting()}.</h1>
                        <p>
                            {intelligence ? 
                                `Your intelligence layer has analyzed ${colleges.length} priorities and ${exams.length} exams.` :
                                "Your personalized academic engine is synchronized."
                            }
                        </p>
                        <div className="iq-intelligence-bar">
                            <Sparkles size={14} className="text-indigo-500" />
                            <span>
                                {colleges.length > 0 ? 
                                    `Ready to analyze ${colleges[0].name.split(' ')[0]} and ${colleges.length - 1} more.` : 
                                    "Ready to begin your strategic college discovery."
                                }
                            </span>
                        </div>
                    </div>

                    {/* Quick Stats Node */}
                    <GlassPanel className="iq-node iq-stats-node">
                        <div className="iq-stat-row">
                            <span className="iq-stat-label">Priorities</span>
                            <span className="iq-stat-value">{localList.length || colleges.length}</span>
                        </div>
                        <div className="iq-stat-row">
                            <span className="iq-stat-label">Exams</span>
                            <span className="iq-stat-value">{exams.length}</span>
                        </div>
                        <div className="iq-stat-row">
                            <span className="iq-stat-label">Milestones</span>
                            <span className="iq-stat-value">{deadlines.length}</span>
                        </div>
                    </GlassPanel>
                </header>

                {/* 3. SWITCHBOARD NAVIGATION */}
                <nav className="iq-switchboard">
                    <button 
                        className={`switch-item ${activeTab === "overview" ? "active" : ""}`}
                        onClick={() => handleTabChange("overview")}
                    >
                        <LayoutDashboard size={18} />
                        Overview
                    </button>
                    <button 
                        className={`switch-item ${activeTab === "colleges" ? "active" : ""}`}
                        onClick={() => handleTabChange("colleges")}
                    >
                        <Bookmark size={18} />
                        Priorities
                    </button>
                    <button 
                        className={`switch-item ${activeTab === "deadlines" ? "active" : ""}`}
                        onClick={() => handleTabChange("deadlines")}
                    >
                        <Calendar size={18} />
                        Milestones
                    </button>
                    <button 
                        className={`switch-item ${activeTab === "profile" ? "active" : ""}`}
                        onClick={() => handleTabChange("profile")}
                    >
                        <Settings size={18} />
                        Settings
                    </button>
                    <button className="switch-item" onClick={logout} style={{ color: '#ef4444' }}>
                        <LogOut size={18} />
                        Sign Out
                    </button>
                </nav>

                {/* 4. CORE ENGINE CONTENT */}
                <section className="iq-pulse-content">
                    {activeTab === "overview" && (
                        <div className="iq-grid">
                            {/* Profile Intelligence Card */}
                            <div className="iq-card iq-card-span-4">
                                <IdentityPulseCard 
                                    user={user} 
                                    intelligence={intelligence} 
                                    loading={intelLoading} 
                                />
                            </div>

                            {/* AI Action Card */}
                            <div className="iq-card iq-card-span-8">
                                {intelLoading ? (
                                    <div className="loading-skeleton" style={{ height: '300px' }} />
                                ) : (
                                    <NextBestAction action={intelligence?.nextBestAction} />
                                )}
                            </div>

                            {/* Shortlist Health */}
                            <div className="iq-card iq-card-span-12">
                                {intelLoading ? (
                                    <div className="loading-skeleton" style={{ height: '200px' }} />
                                ) : (
                                    <ShortlistHealth health={intelligence?.shortlistHealth} />
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === "colleges" && (
                        <div className="iq-card iq-card-span-12">
                            <h3 className="iq-card-title"><Bookmark /> Your Strategic Priorities</h3>
                            <div className="iq-list">
                                {localList.length === 0 && colleges.length === 0 ? (
                                    <p className="p-8 text-center text-muted">No priorities set. Explore colleges to begin.</p>
                                ) : (
                                    [...colleges, ...(localList || []).filter(l => !colleges.find(c => String(c.id || c._id) === String(l.id || l._id)))].map((c, i) => (
                                        <div key={i} className="iq-list-item">
                                            <div className="iq-list-item-main">
                                                <div className="iq-college-avatar">
                                                    {(c.name || c.shortName || "C").charAt(0)}
                                                    <div className="iq-avatar-glow" />
                                                </div>
                                                <div>
                                                    <h4 className="font-bold">{c.name || c.shortName || "Strategic Choice"}</h4>
                                                    <p className="text-sm opacity-60">
                                                        {localList.find(l => String(l.id || l._id) === String(c.id || c._id)) ? "Direct Selection (Actionable)" : "Evaluated Strategic Partner"}
                                                    </p>
                                                </div>
                                            </div>
                                            <Link href={`/college/${c.id || c._id}`}>
                                                <Button size="sm" variant="outline">Analyze</Button>
                                            </Link>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === "deadlines" && (
                        <div className="iq-card iq-card-span-12">
                            <h3 className="iq-card-title"><Calendar /> Upcoming Milestones</h3>
                            <div className="iq-list">
                                {deadlines.length === 0 ? (
                                    <p className="p-8 text-center text-muted">No deadlines tracked. Your timeline is clear.</p>
                                ) : (
                                    deadlines.map((d, i) => {
                                        const milestoneDate = new Date(d.date);
                                        const now = new Date();
                                        const diffTime = milestoneDate - now;
                                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                        const isUrgent = diffDays > 0 && diffDays <= 7;
                                        const isOverdue = diffDays <= 0;

                                        return (
                                            <div key={i} className="iq-list-item">
                                                <div className="iq-list-item-main">
                                                    <div className={`iq-milestone-marker ${isUrgent ? 'urgent' : isOverdue ? 'overdue' : ''}`} />
                                                    <div>
                                                        <h4 className="font-bold">{d.title}</h4>
                                                        <p className="text-sm opacity-60">{d.location || "Central Engine Verification"}</p>
                                                    </div>
                                                </div>
                                                <div className="iq-milestone-status">
                                                    {isOverdue ? (
                                                        <span className="text-xs font-bold text-red-500">PAST DUE</span>
                                                    ) : (
                                                        <span className={`text-xs font-bold ${isUrgent ? 'text-orange-500' : 'text-blue-500'}`}>
                                                            {diffDays} DAYS LEFT
                                                        </span>
                                                    )}
                                                    <span className="badge badge-accent">Tracked</span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === "profile" && (
                        <div className="settings-grid">
                            <div className="iq-card iq-card-span-6">
                                <h3 className="iq-card-title"><User /> Account Intelligence</h3>
                                <div className="profile-detail-card">
                                    <div className="profile-detail-row">
                                        <span className="label">Display Name</span>
                                        <span className="value">{user.displayName}</span>
                                    </div>
                                    <div className="profile-detail-row">
                                        <span className="label">Primary Email</span>
                                        <span className="value">{user.email}</span>
                                    </div>
                                    <div className="profile-detail-row">
                                        <span className="label">Membership</span>
                                        <span className="value premium-badge">Premium Elite</span>
                                    </div>
                                </div>
                            </div>
                            <div className="iq-card iq-card-span-6">
                                <h3 className="iq-card-title"><Binary /> System Preferences</h3>
                                <div className="iq-list">
                                    <div className="iq-list-item">
                                        <div>
                                            <h4 className="font-bold">Adaptive Navigation</h4>
                                            <p className="text-sm opacity-60">Remember last active dashboard tab</p>
                                        </div>
                                        <div className="status-indicator active">Enabled</div>
                                    </div>
                                    <div className="iq-list-item">
                                        <div>
                                            <h4 className="font-bold">Intelligence Overlay</h4>
                                            <p className="text-sm opacity-60">Dynamic HUD personalized insights</p>
                                        </div>
                                        <div className="status-indicator active">Enabled</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
