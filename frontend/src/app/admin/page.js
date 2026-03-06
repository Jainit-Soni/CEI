"use client";

import { useState, useEffect } from "react";
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

import "../colleges/page.css"; // Reuse existing global panel styles

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
            <div className="fixed inset-0 z-[99999] bg-slate-900 flex items-center justify-center overflow-hidden font-sans">
                {/* Dark High-Tech Background */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600/20 blur-[150px] rounded-full mix-blend-screen" />
                    <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 blur-[150px] rounded-full mix-blend-screen" />
                    {/* Grid overlay */}
                    <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-50" />
                </div>

                <RevealOnScroll className="relative z-10 w-full max-w-md px-6">
                    <div className="backdrop-blur-2xl bg-black/40 border border-white/10 rounded-3xl p-10 shadow-2xl text-center relative overflow-hidden">
                        {/* Inner scanline effect */}
                        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(to_bottom,transparent_0%,rgba(255,255,255,0.02)_50%,transparent_100%)] bg-[length:100%_4px] animate-[scan_2s_linear_infinite]" />

                        <div className="bg-indigo-500/20 border border-indigo-500/30 w-24 h-24 rounded-2xl flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(99,102,241,0.3)]">
                            <ShieldCheck size={48} className="text-indigo-400" />
                        </div>

                        <h1 className="text-3xl font-black text-white mb-2 tracking-tight">O.P.S CORE</h1>
                        <p className="text-indigo-300/70 text-sm font-mono tracking-widest mb-10 uppercase">Level 4 Authorization Required</p>

                        <form onSubmit={handleLogin} className="space-y-6">
                            <div className="relative group">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={20} />
                                <input
                                    type="password"
                                    placeholder="Enter Decryption Key"
                                    className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 font-mono text-white placeholder:text-slate-600 transition-all shadow-inner"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoFocus
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full py-4 rounded-2xl text-sm tracking-widest uppercase font-black bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)] hover:shadow-[0_0_30px_rgba(99,102,241,0.6)] transition-all transform hover:-translate-y-0.5"
                            >
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
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all text-sm mb-2 ${activeTab === id
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30'
                : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
        >
            <Icon size={18} /> {label}
        </button>
    );

    return (
        <div className="fixed inset-0 z-[99999] bg-slate-50 flex flex-col md:flex-row font-sans overflow-y-auto w-full h-full">

            {/* --- SIDEBAR --- */}
            <aside className="w-full md:w-64 bg-slate-900 text-white flex flex-col md:min-h-screen shrink-0 sticky top-0 md:h-screen overflow-y-auto">
                <div className="p-6 pb-2 border-b border-white/10 flex items-center justify-between md:justify-start gap-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 p-2 rounded-lg shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                            <ShieldCheck size={20} />
                        </div>
                        <div>
                            <h1 className="text-xl font-black tracking-tight leading-none">CEI O.P.S</h1>
                            <p className="text-[10px] text-indigo-400 font-mono uppercase tracking-widest mt-1">Super Admin</p>
                        </div>
                    </div>
                </div>

                <div className="p-4 flex-1">
                    <p className="text-xs font-black text-slate-600 uppercase tracking-widest mb-4 px-2 mt-4">Command Modules</p>
                    <SidebarLink id="dashboard" icon={LayoutDashboard} label="Main Dashboard" />
                    <SidebarLink id="news" icon={Newspaper} label="News Dispatcher" />
                    <SidebarLink id="integrity" icon={Activity} label="Data Integrity Engine" />
                    <SidebarLink id="logs" icon={TerminalSquare} label="System Logs" />
                </div>

                <div className="p-4 border-t border-white/10">
                    <button
                        onClick={() => setIsAuthenticated(false)}
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-all text-sm"
                    >
                        <LogOut size={18} /> Terminate Session
                    </button>
                </div>
            </aside>

            {/* --- MAIN CONTENT AREA --- */}
            <main className="flex-1 p-6 md:p-10 overflow-x-hidden">

                {/* Top Bar */}
                <header className="flex justify-between items-center mb-10 pb-6 border-b border-slate-200">
                    <div>
                        <h2 className="text-3xl font-black text-slate-800 tracking-tight capitalize">
                            {activeTab.replace("-", " ")}
                        </h2>
                        <p className="text-sm font-medium text-slate-500 mt-1">Platform Status: <span className="text-emerald-500 font-bold">Optimal</span></p>
                    </div>
                    <div className="flex items-center gap-4 hidden sm:flex">
                        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm text-sm font-bold text-slate-600">
                            <Database size={16} className="text-indigo-500" /> Edge Cache Active
                        </div>
                        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-200 shadow-sm text-sm font-bold text-slate-600">
                            <Server size={16} className="text-emerald-500" /> Database Synced
                        </div>
                    </div>
                </header>

                {/* --- TAB CONTENT: DASHBOARD --- */}
                {activeTab === "dashboard" && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* KPI Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                            {[
                                { label: "Total Institutions", val: "68,210", change: "+100%", icon: Database, color: "text-indigo-600", bg: "bg-indigo-50" },
                                { label: "Verified Data Points", val: "1.4M", change: "+12%", icon: CheckCircle, color: "text-emerald-600", bg: "bg-emerald-50" },
                                { label: "Active Investigations", val: "14", change: "-2", icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50" },
                                { label: "API Requests (24h)", val: "148.5K", change: "+45%", icon: Zap, color: "text-blue-600", bg: "bg-blue-50" },
                            ].map((stat, i) => (
                                <div key={i} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`${stat.bg} ${stat.color} p-3 rounded-2xl`}>
                                            <stat.icon size={24} />
                                        </div>
                                        <span className="text-xs font-black bg-slate-100 text-slate-600 px-2 py-1 rounded-md">{stat.change}</span>
                                    </div>
                                    <h3 className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mb-1">{stat.label}</h3>
                                    <p className="text-3xl font-black text-slate-800">{stat.val}</p>
                                </div>
                            ))}
                        </div>

                        {/* Charts Area */}
                        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2">
                                <Activity size={20} className="text-indigo-600" /> Platform Traffic Overview
                            </h3>
                            <div className="h-80 w-full">
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
                    <div className="max-w-4xl animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-white p-8 md:p-10 rounded-3xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                            <div className="mb-8">
                                <h3 className="text-xl font-black text-slate-800">Dispatch Live Intel</h3>
                                <p className="text-sm font-medium text-slate-500 mt-1">Broadcast breaking educational news directly to the student portal.</p>
                            </div>

                            <form onSubmit={handlePostNews} className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-1">Strategic Headline</label>
                                    <input
                                        type="text"
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-800 transition-all"
                                        placeholder="e.g. JEE Main Results Declared"
                                        value={newsForm.title}
                                        onChange={e => setNewsForm({ ...newsForm, title: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-1">Intel Summary (Brief)</label>
                                    <textarea
                                        className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-slate-600 transition-all"
                                        rows="4"
                                        placeholder="Brief overview of the announcement..."
                                        value={newsForm.summary}
                                        onChange={e => setNewsForm({ ...newsForm, summary: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-1">Classification</label>
                                        <select
                                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-bold text-slate-700 cursor-pointer appearance-none transition-all"
                                            value={newsForm.category}
                                            onChange={e => setNewsForm({ ...newsForm, category: e.target.value })}
                                        >
                                            <option>Exam Alert</option><option>Results</option><option>Policy</option>
                                            <option>Admissions</option><option>General</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-1">Source Link (URL)</label>
                                        <input
                                            type="url"
                                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none font-mono text-indigo-600 font-bold transition-all"
                                            placeholder="https://..."
                                            value={newsForm.url}
                                            onChange={e => setNewsForm({ ...newsForm, url: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div
                                    className={`flex items-center gap-4 p-5 rounded-2xl border-2 transition-all cursor-pointer select-none ${newsForm.urgent ? 'bg-red-50 border-red-200' : 'bg-white border-slate-100 hover:border-slate-200'}`}
                                    onClick={() => setNewsForm({ ...newsForm, urgent: !newsForm.urgent })}
                                >
                                    <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-all ${newsForm.urgent ? 'bg-red-600 text-white shadow-md shadow-red-200' : 'bg-slate-200'}`}>
                                        {newsForm.urgent && <CheckCircle size={14} />}
                                    </div>
                                    <div>
                                        <p className={`font-black uppercase text-[11px] tracking-widest ${newsForm.urgent ? 'text-red-600' : 'text-slate-500'}`}>High Priority Transmission</p>
                                        <p className="text-sm font-medium text-slate-500">Alert students immediately on homepage</p>
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={posting}
                                    className="w-full py-5 rounded-2xl text-sm tracking-widest uppercase font-black bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white shadow-lg shadow-indigo-200 transition-all"
                                >
                                    {posting ? "Transmitting via Node..." : "DISPATCH UPDATE"}
                                </button>
                            </form>
                        </div>
                    </div>
                )}

                {/* --- TAB CONTENT: DATA INTEGRITY (MOCK) --- */}
                {activeTab === "integrity" && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
                            <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center">
                                <div>
                                    <h3 className="text-xl font-black text-slate-800">Anomaly Detection Queue</h3>
                                    <p className="text-sm font-medium text-slate-500 mt-1">AI-flagged discrepancies requiring manual review.</p>
                                </div>
                                <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition-colors">
                                    Run Full Scan
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-slate-50 border-b border-slate-100">
                                            <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Target ID</th>
                                            <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Institution</th>
                                            <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Anomaly Type</th>
                                            <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Severity</th>
                                            <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Status</th>
                                            <th className="p-4 text-xs font-black text-slate-400 uppercase tracking-widest whitespace-nowrap">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {anomalyData.map((row, i) => (
                                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                <td className="p-4 font-mono text-sm text-slate-500">{row.id}</td>
                                                <td className="p-4 font-bold text-slate-700">{row.target}</td>
                                                <td className="p-4 text-sm font-medium text-slate-600">{row.type}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 rounded-md text-xs font-black uppercase ${row.severity === 'High' ? 'bg-red-100 text-red-700' :
                                                        row.severity === 'Medium' ? 'bg-amber-100 text-amber-700' :
                                                            'bg-emerald-100 text-emerald-700'
                                                        }`}>
                                                        {row.severity}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-sm font-bold text-slate-500">{row.status}</td>
                                                <td className="p-4">
                                                    <button className="text-indigo-600 hover:text-indigo-800 font-bold text-sm flex items-center gap-1 group">
                                                        Inspect <ChevronRight size={16} className="group-hover:translate-x-1 transition-transform" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- TAB CONTENT: SYSTEM LOGS (MOCK) --- */}
                {activeTab === "logs" && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-slate-900 rounded-3xl border border-slate-800 shadow-[0_8px_30px_rgb(0,0,0,0.1)] overflow-hidden">
                            <div className="p-4 border-b border-slate-800 flex items-center gap-3 bg-slate-800/50">
                                <div className="flex gap-2">
                                    <div className="w-3 h-3 rounded-full bg-rose-500"></div>
                                    <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                                    <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                                </div>
                                <span className="text-xs font-mono text-slate-500 tracking-wider">production / root / var / log / sys.log</span>
                            </div>
                            <div className="p-6 h-[500px] overflow-y-auto font-mono text-sm space-y-2">
                                {logs.map((log, i) => {
                                    let textColor = "text-slate-300";
                                    if (log.includes("[SEC]")) textColor = "text-rose-400";
                                    if (log.includes("[SYS]")) textColor = "text-emerald-400";
                                    if (log.includes("[ML]")) textColor = "text-indigo-400";
                                    if (log.includes("[OP]")) textColor = "text-amber-400";

                                    return (
                                        <div key={i} className={`${textColor} flex gap-4`}>
                                            <span className="text-slate-600 select-none hidden sm:inline">{new Date().toISOString()}</span>
                                            <span>{log}</span>
                                        </div>
                                    );
                                })}
                                <div className="text-slate-500 mt-4 animate-pulse">_ blinking cursor waiting...</div>
                            </div>
                        </div>
                    </div>
                )}

            </main>
        </div>
    );
}
