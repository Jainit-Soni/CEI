"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { postNews } from "@/lib/api";
import { RevealOnScroll } from '@/lib/useIntersectionObserver';
import {
    ShieldCheck, LayoutDashboard, Newspaper, LogOut,
    Activity, TerminalSquare, Database, Server,
    FileWarning, AlertTriangle, MessageSquare
} from "lucide-react";
import { useAdminAuth } from "@/lib/useAdminAuth";
import "./admin.css";

// Lazy-load all heavy tabs
const DashboardTab = dynamic(() => import("./tabs/DashboardTab"), { loading: () => <TabSkeleton /> });
const NewsTab = dynamic(() => import("./tabs/NewsTab"), { loading: () => <TabSkeleton /> });
const IntegrityTab = dynamic(() => import("./tabs/IntegrityTab"), { loading: () => <TabSkeleton /> });
const LogsTab = dynamic(() => import("./tabs/LogsTab"), { loading: () => <TabSkeleton /> });
const TrustReportsTab = dynamic(() => import("./tabs/TrustReportsTab"), { loading: () => <TabSkeleton /> });
const SystemTab = dynamic(() => import("./tabs/SystemTab"), { loading: () => <TabSkeleton /> });
const ReviewsTab = dynamic(() => import("./tabs/ReviewsTab"), { loading: () => <TabSkeleton /> });

const TabSkeleton = () => (
    <div style={{ height: '400px', borderRadius: '24px', background: '#f1f5f9', animation: 'pulse 1.5s ease-in-out infinite' }} />
);

const SidebarLink = ({ id, activeTab, onSelect, icon: Icon, label, badge }) => (
    <button
        onClick={() => onSelect(id)}
        className={`admin-nav-item ${activeTab === id ? 'active' : ''}`}
    >
        <Icon size={18} /> {label}
        {badge > 0 && <span className="admin-nav-badge">{badge}</span>}
    </button>
);

// ── Google Sign-In Button ─────────────────────────────────────────────────────
const GoogleSignInButton = ({ onClick, loading }) => (
    <button className="admin-google-btn" onClick={onClick} disabled={loading}>
        {loading ? (
            <span className="admin-google-spinner" />
        ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
        )}
        {loading ? "Signing in…" : "Sign in with Google"}
    </button>
);

export default function AdminPage() {
    const { user, loading, isAuthorized, signInWithGoogle, signOut, adminFetch } = useAdminAuth();
    const [activeTab, setActiveTab] = useState("dashboard");
    const [signingIn, setSigningIn] = useState(false);
    const [signInError, setSignInError] = useState("");
    const [reportBadge, setReportBadge] = useState(0);

    const handleGoogleSignIn = async () => {
        setSigningIn(true);
        setSignInError("");
        try {
            await signInWithGoogle();
        } catch (err) {
            setSignInError("Sign-in failed. Please try again.");
        } finally {
            setSigningIn(false);
        }
    };

    // ── Loading state ─────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="admin-login-wrapper">
                <div className="admin-login-bg-glow1" />
                <div className="admin-login-bg-glow2" />
                <div className="admin-login-box" style={{ textAlign: 'center' }}>
                    <span className="admin-google-spinner" style={{ width: 36, height: 36, border: '3px solid rgba(99,102,241,0.2)', borderTopColor: '#6366f1', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.8s linear infinite' }} />
                    <p style={{ marginTop: 16, color: '#64748b' }}>Checking session…</p>
                </div>
            </div>
        );
    }

    // ── Login screen ──────────────────────────────────────────────────────────
    if (!user) {
        return (
            <div className="admin-login-wrapper">
                <div className="admin-login-bg-glow1" />
                <div className="admin-login-bg-glow2" />
                <RevealOnScroll>
                    <div className="admin-login-box">
                        <div className="admin-shield-icon">
                            <ShieldCheck size={48} />
                        </div>
                        <h1 className="admin-login-title">CEI CONTROL CENTER</h1>
                        <p className="admin-login-subtitle">Authorized Personnel Only</p>
                        <p className="admin-login-desc">
                            Access restricted to evaluated CEI administrators.<br />
                            Sign in with your authorized Google account.
                        </p>
                        <GoogleSignInButton onClick={handleGoogleSignIn} loading={signingIn} />
                        {signInError && <p className="admin-login-error">{signInError}</p>}
                        <p className="admin-login-note">
                            🔒 All access attempts are logged and monitored.
                        </p>
                    </div>
                </RevealOnScroll>
            </div>
        );
    }

    // ── Access denied ─────────────────────────────────────────────────────────
    if (!isAuthorized) {
        return (
            <div className="admin-login-wrapper">
                <div className="admin-login-bg-glow1" />
                <div className="admin-login-bg-glow2" />
                <div className="admin-login-box">
                    <div className="admin-shield-icon" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
                        <AlertTriangle size={48} />
                    </div>
                    <h1 className="admin-login-title" style={{ color: '#ef4444' }}>Access Denied</h1>
                    <p className="admin-login-subtitle">Unauthorized account</p>
                    <p className="admin-login-desc">
                        <strong>{user.email}</strong> is not authorized to access this panel.<br />
                        This access attempt has been logged.
                    </p>
                    <button className="admin-google-btn" style={{ background: '#ef4444', color: '#fff', border: 'none' }} onClick={signOut}>
                        <LogOut size={18} /> Sign out
                    </button>
                </div>
            </div>
        );
    }

    // ── Admin dashboard ───────────────────────────────────────────────────────
    return (
        <div className="admin-app-wrapper">
            {/* SIDEBAR */}
            <aside className="admin-sidebar">
                <div className="admin-sidebar-header">
                    <div className="admin-sidebar-logo-icon"><ShieldCheck size={24} /></div>
                    <div className="admin-sidebar-logo-text">
                        <h1>CEI Admin</h1>
                        <p>{user.displayName?.split(" ")[0] || "Super Admin"}</p>
                    </div>
                </div>

                {user.photoURL && (
                    <div style={{ padding: '0 16px 12px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                        <img src={user.photoURL} alt="" style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(99,102,241,0.4)' }} />
                        <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</span>
                    </div>
                )}

                <div className="admin-sidebar-nav">
                    <span className="admin-sidebar-label">Operations</span>
                    <SidebarLink id="dashboard" activeTab={activeTab} onSelect={setActiveTab} icon={LayoutDashboard} label="Dashboard" />
                    <SidebarLink id="reports" activeTab={activeTab} onSelect={setActiveTab} icon={FileWarning} label="Trust Reports" badge={reportBadge} />
                    <SidebarLink id="integrity" activeTab={activeTab} onSelect={setActiveTab} icon={Activity} label="Data Integrity" />
                    <SidebarLink id="system" activeTab={activeTab} onSelect={setActiveTab} icon={Server} label="System &amp; Cache" />
                    <span className="admin-sidebar-label" style={{ marginTop: 16 }}>Content</span>
                    <SidebarLink id="news" activeTab={activeTab} onSelect={setActiveTab} icon={Newspaper} label="News Dispatcher" />
                    <SidebarLink id="reviews" activeTab={activeTab} onSelect={setActiveTab} icon={MessageSquare} label="User Reviews" />
                    <SidebarLink id="logs" activeTab={activeTab} onSelect={setActiveTab} icon={TerminalSquare} label="Audit Logs" />
                </div>

                <div className="admin-sidebar-footer">
                    <button onClick={signOut} className="admin-nav-logout">
                        <LogOut size={18} /> Sign Out
                    </button>
                </div>
            </aside>

            {/* MAIN */}
            <main className="admin-main">
                <header className="admin-topbar">
                    <div>
                        <h2 style={{ textTransform: 'capitalize' }}>{activeTab.replace("-", " ")}</h2>
                        <p>Platform Status: <span className="admin-status-badge">Operational</span></p>
                    </div>
                    <div className="admin-topbar-widgets">
                        <div className="admin-widget"><Database size={16} color="#6366f1" /> Cache Active</div>
                        <div className="admin-widget"><Server size={16} color="#10b981" /> DB Connected</div>
                    </div>
                </header>

                {activeTab === "dashboard" && <DashboardTab adminFetch={adminFetch} />}
                {activeTab === "reports" && <TrustReportsTab adminFetch={adminFetch} onBadgeUpdate={setReportBadge} />}
                {activeTab === "integrity" && <IntegrityTab adminFetch={adminFetch} />}
                {activeTab === "system" && <SystemTab adminFetch={adminFetch} />}
                {activeTab === "news" && <NewsTab />}
                {activeTab === "reviews" && <ReviewsTab adminFetch={adminFetch} />}
                {activeTab === "logs" && <LogsTab adminFetch={adminFetch} />}
            </main>

            <style jsx global>{`
                @keyframes spin { to { transform: rotate(360deg) } }
                @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.5 } }

                .admin-google-btn {
                    display: flex; align-items: center; justify-content: center; gap: 12px;
                    width: 100%; padding: 13px 20px; margin: 20px 0 12px;
                    background: #fff; border: 1.5px solid #e2e8f0; border-radius: 12px;
                    font-size: 0.9375rem; font-weight: 600; color: #1e293b;
                    cursor: pointer; transition: all 0.2s;
                }
                .admin-google-btn:hover:not(:disabled) {
                    box-shadow: 0 4px 16px rgba(0,0,0,0.12); transform: translateY(-1px);
                }
                .admin-google-btn:disabled { opacity: 0.7; cursor: not-allowed; }
                .admin-google-spinner {
                    width: 18px; height: 18px; border: 2px solid rgba(100,116,139,0.3);
                    border-top-color: #6366f1; border-radius: 50%;
                    animation: spin 0.7s linear infinite; display: inline-block;
                }
                .admin-login-desc { color: #64748b; font-size: 0.875rem; line-height: 1.6; margin: 8px 0; }
                .admin-login-error { color: #ef4444; font-size: 0.8125rem; text-align: center; margin: 8px 0; }
                .admin-login-note { color: #94a3b8; font-size: 0.75rem; text-align: center; }
                .admin-nav-badge {
                    background: #ef4444; color: #fff; font-size: 0.65rem; font-weight: 700;
                    min-width: 18px; height: 18px; border-radius: 9px; padding: 0 5px;
                    display: flex; align-items: center; justify-content: center;
                    margin-left: auto;
                }
            `}</style>
        </div>
    );
}
