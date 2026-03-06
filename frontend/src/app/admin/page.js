"use client";

import { useState } from "react";
import { postNews } from "@/lib/api";
import { RevealOnScroll } from '@/lib/useIntersectionObserver';
import {
    Lock, LayoutDashboard, Newspaper, LogOut, ShieldCheck,
    Zap, TrendingUp, Users, Activity, FileText,
    AlertTriangle, CheckCircle, Server, Database, ChevronRight,
    TerminalSquare
} from "lucide-react";
import {
    LineChart, Line, AreaChart, Area, XAxis, YAxis,
    CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';

import "./admin.css"; // Use the robust custom CSS module

// Mock Data for Premium Dashboards
const trafficData = [
    { time: '00:00', requests: 4200, errors: 12 },
    { time: '04:00', requests: 2800, errors: 5 },
    { time: '08:00', requests: 12500, errors: 45 },
    { time: '12:00', requests: 28900, errors: 120 },
    { time: '16:00', requests: 35200, errors: 156 },
    { time: '20:00', requests: 18400, errors: 68 },
    { time: '23:59', requests: 8600, errors: 24 },
];

const anomalyData = [
    { id: 'AN-892', target: 'Pune Institute of Tech', type: 'Placement Spike', severity: 'High', status: 'Pending Review' },
    { id: 'AN-891', target: 'Delhi Arts College', type: 'Missing Affiliation', severity: 'Medium', status: 'Auto-Resolved' },
    { id: 'AN-890', target: 'Global Mgmt School', type: 'Fee Mismatch', severity: 'Low', status: 'Pending Review' },
];

const systemLogs = [
    "[SYS] Database synchronized successfully: 68,210 records active.",
    "[AUTH] JWT rotation schedule verified.",
    "[SEC] 42 unauthorized access attempts blocked from IP 192.168.1.104",
    "[ML] Placement deviation model retraining initiated (Epoch 14/50)",
    "[SYS] Peak load handled gracefully. Auto-scaling cluster scaled down.",
];

export default function AdminPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState("");
    const [activeTab, setActiveTab] = useState("dashboard");
    const [logs, setLogs] = useState(systemLogs);

    // News Dispatcher State
    const [newsForm, setNewsForm] = useState({
        title: "", summary: "", category: "Exam Alert", url: "", urgent: false
    });
    const [posting, setPosting] = useState(false);

    const handleLogin = (e) => {
        e.preventDefault();
        // Complex Hardcoded Security Key
        if (password === "C3i_0p$C0mmand_!905") {
            setIsAuthenticated(true);
        } else {
            alert("SECURITY ALERT: Invalid Key Configuration. Access Denied.");
        }
    };

    const handlePostNews = async (e) => {
        e.preventDefault();
        setPosting(true);
        try {
            const success = await postNews(newsForm);
            if (success) {
                alert("Intel Dispatched Successfully.");
                setNewsForm({ title: "", summary: "", category: "Exam Alert", url: "", urgent: false });
                setLogs(prev => [`[OP] News Dispatcher broadcast: "${newsForm.title}"`, ...prev]);
            } else {
                alert("Failed to post news");
            }
        } catch (err) {
            alert("Error posting news");
        }
        setPosting(false);
    };

    // --- RENDER LOGIN SCREEN ---
    if (!isAuthenticated) {
        return (
            <div className="admin-login-wrapper">
                <div className="admin-login-bg-glow1" />
                <div className="admin-login-bg-glow2" />

                <RevealOnScroll>
                    <div className="admin-login-box">
                        <div className="admin-shield-icon">
                            <ShieldCheck size={48} />
                        </div>

                        <h1 className="admin-login-title">O.P.S CORE</h1>
                        <p className="admin-login-subtitle">Level 4 Authorization Required</p>

                        <form onSubmit={handleLogin}>
                            <div className="admin-input-group">
                                <Lock className="admin-input-icon" size={20} />
                                <input
                                    type="password"
                                    placeholder="Enter Decryption Key"
                                    className="admin-input-login"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <button type="submit" className="admin-btn-login">
                                Initiate Uplink
                            </button>
                        </form>
                    </div>
                </RevealOnScroll>
            </div>
        );
    }

    // --- RENDER MAIN ADMIN DASHBOARD ---

    // Helper for Sidebar Links
    const SidebarLink = ({ id, icon: Icon, label }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`admin-nav-item ${activeTab === id ? 'active' : ''}`}
        >
            <Icon size={18} /> {label}
        </button>
    );

    return (
        <div className="admin-app-wrapper">

            {/* --- SIDEBAR --- */}
            <aside className="admin-sidebar">
                <div className="admin-sidebar-header">
                    <div className="admin-sidebar-logo-icon">
                        <ShieldCheck size={24} />
                    </div>
                    <div className="admin-sidebar-logo-text">
                        <h1>CEI O.P.S</h1>
                        <p>Super Admin</p>
                    </div>
                </div>

                <div className="admin-sidebar-nav">
                    <span className="admin-sidebar-label">Command Modules</span>
                    <SidebarLink id="dashboard" icon={LayoutDashboard} label="Main Dashboard" />
                    <SidebarLink id="news" icon={Newspaper} label="News Dispatcher" />
                    <SidebarLink id="integrity" icon={Activity} label="Data Integrity Engine" />
                    <SidebarLink id="logs" icon={TerminalSquare} label="System Logs" />
                </div>

                <div className="admin-sidebar-footer">
                    <button
                        onClick={() => setIsAuthenticated(false)}
                        className="admin-nav-logout"
                    >
                        <LogOut size={18} /> Terminate Session
                    </button>
                </div>
            </aside>

            {/* --- MAIN CONTENT AREA --- */}
            <main className="admin-main">

                {/* Top Bar */}
                <header className="admin-topbar">
                    <div>
                        <h2>{activeTab.replace("-", " ")}</h2>
                        <p>Platform Status: <span className="admin-status-badge">Optimal</span></p>
                    </div>
                    <div className="admin-topbar-widgets">
                        <div className="admin-widget">
                            <Database size={16} color="#6366f1" /> Edge Cache Active
                        </div>
                        <div className="admin-widget">
                            <Server size={16} color="#10b981" /> Database Synced
                        </div>
                    </div>
                </header>

                {/* --- TAB CONTENT: DASHBOARD --- */}
                {activeTab === "dashboard" && (
                    <div className="reveal revealed">
                        {/* KPI Grid */}
                        <div className="admin-stats-grid">
                            {[
                                { label: "Total Institutions", val: "68,210", change: "+100%", icon: Database, color: "#4f46e5", bg: "#eef2ff" },
                                { label: "Verified Data Points", val: "1.4M", change: "+12%", icon: CheckCircle, color: "#10b981", bg: "#d1fae5" },
                                { label: "Active Investigations", val: "14", change: "-2", icon: AlertTriangle, color: "#f59e0b", bg: "#fef3c7" },
                                { label: "API Requests (24h)", val: "148.5K", change: "+45%", icon: Zap, color: "#3b82f6", bg: "#dbeafe" },
                            ].map((stat, i) => (
                                <div key={i} className="admin-stat-card">
                                    <div className="admin-stat-header">
                                        <div className="admin-stat-icon-wrapper" style={{ background: stat.bg, color: stat.color }}>
                                            <stat.icon size={24} />
                                        </div>
                                        <span className="admin-stat-chip">{stat.change}</span>
                                    </div>
                                    <h3 className="admin-stat-label">{stat.label}</h3>
                                    <p className="admin-stat-val">{stat.val}</p>
                                </div>
                            ))}
                        </div>

                        {/* Charts Area */}
                        <div className="admin-chart-card">
                            <h3 className="admin-chart-title">
                                <Activity size={20} color="#4f46e5" /> Platform Traffic Overview
                            </h3>
                            <div style={{ width: '100%', height: '320px' }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <AreaChart data={trafficData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                        <defs>
                                            <linearGradient id="colorReq" x1="0" y1="0" x2="0" y2="1">
                                                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                                                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                            </linearGradient>
                                        </defs>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dy={10} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} dx={-10} />
                                        <Tooltip
                                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.1)', fontWeight: 'bold' }}
                                        />
                                        <Area type="monotone" dataKey="requests" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorReq)" />
                                    </AreaChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- TAB CONTENT: NEWS DISPATCHER --- */}
                {activeTab === "news" && (
                    <div className="reveal revealed">
                        <div className="admin-form-container">
                            <h3 className="admin-form-title">Dispatch Live Intel</h3>
                            <p className="admin-form-subtitle">Broadcast breaking educational news directly to the student portal.</p>

                            <form onSubmit={handlePostNews}>
                                <div className="admin-form-group">
                                    <label>Strategic Headline</label>
                                    <input
                                        type="text"
                                        className="admin-input-field"
                                        placeholder="e.g. JEE Main Results Declared"
                                        value={newsForm.title}
                                        onChange={e => setNewsForm({ ...newsForm, title: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="admin-form-group">
                                    <label>Intel Summary (Brief)</label>
                                    <textarea
                                        className="admin-textarea"
                                        placeholder="Brief overview of the announcement..."
                                        value={newsForm.summary}
                                        onChange={e => setNewsForm({ ...newsForm, summary: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="admin-form-row">
                                    <div className="admin-form-group">
                                        <label>Classification</label>
                                        <select
                                            className="admin-select"
                                            value={newsForm.category}
                                            onChange={e => setNewsForm({ ...newsForm, category: e.target.value })}
                                        >
                                            <option>Exam Alert</option><option>Results</option><option>Policy</option>
                                            <option>Admissions</option><option>General</option>
                                        </select>
                                    </div>
                                    <div className="admin-form-group">
                                        <label>Source Link (URL)</label>
                                        <input
                                            type="url"
                                            className="admin-input-field mono"
                                            placeholder="https://..."
                                            value={newsForm.url}
                                            onChange={e => setNewsForm({ ...newsForm, url: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div
                                    className={`admin-urgent-box ${newsForm.urgent ? 'active' : ''}`}
                                    onClick={() => setNewsForm({ ...newsForm, urgent: !newsForm.urgent })}
                                >
                                    <div className="admin-urgent-check">
                                        {newsForm.urgent && <CheckCircle size={14} />}
                                    </div>
                                    <div className="admin-urgent-text">
                                        <h4>High Priority Transmission</h4>
                                        <p>Alert students immediately on homepage</p>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={posting}
                                    className="admin-btn-primary"
                                >
                                    {posting ? "Transmitting via Node..." : "DISPATCH UPDATE"}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* --- TAB CONTENT: DATA INTEGRITY (MOCK) --- */}
                {activeTab === "integrity" && (
                    <div className="reveal revealed">
                        <div className="admin-table-wrapper">
                            <div className="admin-table-header">
                                <div>
                                    <h3>Anomaly Detection Queue</h3>
                                    <p>AI-flagged discrepancies requiring manual review.</p>
                                </div>
                                <button className="admin-table-btn">Run Full Scan</button>
                            </div>
                            <div style={{ overflowX: 'auto' }}>
                                <table className="admin-table">
                                    <thead>
                                        <tr>
                                            <th>Target ID</th>
                                            <th>Institution</th>
                                            <th>Anomaly Type</th>
                                            <th>Severity</th>
                                            <th>Status</th>
                                            <th>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {anomalyData.map((row, i) => {
                                            let bg = '#d1fae5', color = '#047857';
                                            if (row.severity === 'High') { bg = '#fee2e2'; color = '#be123c'; }
                                            if (row.severity === 'Medium') { bg = '#fef3c7'; color = '#b45309'; }

                                            return (
                                                <tr key={i}>
                                                    <td style={{ fontFamily: 'monospace', color: '#64748b' }}>{row.id}</td>
                                                    <td style={{ fontWeight: 900, color: '#0f172a' }}>{row.target}</td>
                                                    <td>{row.type}</td>
                                                    <td>
                                                        <span className="admin-pill" style={{ background: bg, color: color }}>
                                                            {row.severity}
                                                        </span>
                                                    </td>
                                                    <td style={{ fontWeight: 700 }}>{row.status}</td>
                                                    <td>
                                                        <button style={{ color: '#4f46e5', background: 'transparent', border: 'none', fontWeight: 900, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            Inspect <ChevronRight size={14} />
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- TAB CONTENT: SYSTEM LOGS (MOCK) --- */}
                {activeTab === "logs" && (
                    <div className="reveal revealed">
                        <div className="admin-terminal">
                            <div className="admin-terminal-header">
                                <div className="admin-terminal-dots">
                                    <div className="admin-terminal-dot" style={{ background: '#ef4444' }}></div>
                                    <div className="admin-terminal-dot" style={{ background: '#eab308' }}></div>
                                    <div className="admin-terminal-dot" style={{ background: '#22c55e' }}></div>
                                </div>
                                <span className="admin-terminal-path">production / root / var / log / sys.log</span>
                            </div>
                            <div className="admin-terminal-body">
                                {logs.map((log, i) => {
                                    let textColor = "#e2e8f0";
                                    if (log.includes("[SEC]")) textColor = "#f43f5e";
                                    if (log.includes("[SYS]")) textColor = "#34d399";
                                    if (log.includes("[ML]")) textColor = "#818cf8";
                                    if (log.includes("[OP]")) textColor = "#fbbf24";

                                    return (
                                        <div key={i} className="log-line" style={{ color: textColor }}>
                                            <span className="log-time">{new Date().toISOString()}</span>
                                            <span>{log}</span>
                                        </div>
                                    );
                                })}
                                <div style={{ color: '#64748b', marginTop: '16px', animation: 'pulse 2s infinite' }}>_ blinking cursor waiting...</div>
                            </div>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
}
