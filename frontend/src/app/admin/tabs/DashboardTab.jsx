"use client";

/**
 * DashboardTab.jsx — Real-data admin overview
 * =============================================
 * All numbers come from /api/admin/dashboard/stats.
 * Chart shows actual admin activity over the past 24h (hourly buckets from audit log).
 * Recent Activity feed shows the last 20 real admin actions.
 * Zero hardcoded numbers.
 */

import { useState, useEffect, useCallback } from "react";
import { Database, AlertTriangle, Zap, Activity, FileWarning, RefreshCw } from "lucide-react";
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const METHOD_COLOR = { GET: '#3b82f6', POST: '#10b981', PATCH: '#f59e0b', DELETE: '#ef4444' };

function DeltaChip({ delta }) {
    if (delta === null || delta === undefined) return null;
    const positive = delta >= 0;
    return (
        <span style={{
            background: positive ? '#d1fae5' : '#fef3c7',
            color: positive ? '#065f46' : '#92400e',
            fontSize: '0.7rem', fontWeight: 700,
            padding: '2px 8px', borderRadius: 20,
        }}>
            {positive ? `+${delta}` : delta} vs yesterday
        </span>
    );
}

export default function DashboardTab({ adminFetch }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [lastRefresh, setLastRefresh] = useState(null);

    const fetchStats = useCallback(async () => {
        if (!adminFetch) return;
        setLoading(true); setError("");
        try {
            const res = await adminFetch("/api/admin/dashboard/stats");
            if (!res.ok) throw new Error(await res.text());
            const json = await res.json();
            setData(json);
            setLastRefresh(new Date());
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [adminFetch]);

    useEffect(() => { fetchStats(); }, [fetchStats]);

    const kpis = data?.kpis ?? {};

    const statCards = [
        {
            label: "Total Institutions",
            val: kpis.totalColleges != null ? kpis.totalColleges.toLocaleString("en-IN") : "…",
            delta: null,
            icon: Database, color: "#4f46e5", bg: "#eef2ff",
        },
        {
            label: "Pending Reports",
            val: kpis.pendingReports != null ? kpis.pendingReports : "…",
            delta: kpis.pendingReportsDelta,
            icon: FileWarning, color: "#f59e0b", bg: "#fef3c7",
        },
        {
            label: "Open Anomalies",
            val: kpis.openAnomalies != null ? kpis.openAnomalies : "…",
            delta: null,
            icon: AlertTriangle, color: "#ef4444", bg: "#fee2e2",
        },
        {
            label: "Admin Actions (24h)",
            val: kpis.adminActions24h != null ? kpis.adminActions24h : "…",
            delta: kpis.adminActionsDelta,
            icon: Zap, color: "#3b82f6", bg: "#dbeafe",
        },
    ];

    return (
        <div className="reveal revealed">
            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <p style={{ fontSize: '0.8125rem', color: '#94a3b8', margin: 0 }}>
                    {lastRefresh ? `Refreshed ${lastRefresh.toLocaleTimeString('en-IN')}` : 'Loading real-time data…'}
                    {kpis.cacheHitRate && ` · Cache hit rate: ${kpis.cacheHitRate}%`}
                </p>
                <button
                    onClick={fetchStats}
                    disabled={loading}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f1f5f9', border: 'none', padding: '7px 14px', borderRadius: 8, fontSize: '0.8rem', fontWeight: 500, color: '#64748b', cursor: 'pointer' }}
                >
                    <RefreshCw size={14} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
                    Refresh
                </button>
            </div>

            {error && (
                <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: 12, marginBottom: 20, fontSize: '0.875rem' }}>
                    Failed to load: {error}
                </div>
            )}

            {/* KPI Grid */}
            <div className="admin-stats-grid">
                {statCards.map((stat, i) => (
                    <div key={i} className="admin-stat-card">
                        <div className="admin-stat-header">
                            <div className="admin-stat-icon-wrapper" style={{ background: stat.bg, color: stat.color }}>
                                <stat.icon size={24} />
                            </div>
                            <DeltaChip delta={stat.delta} />
                        </div>
                        <h3 className="admin-stat-label">{stat.label}</h3>
                        <p className="admin-stat-val">{stat.val}</p>
                    </div>
                ))}
            </div>

            {/* Hourly Admin Activity Chart */}
            <div className="admin-chart-card">
                <h3 className="admin-chart-title">
                    <Activity size={20} color="#4f46e5" />
                    Admin Activity — Last 24 Hours (hourly)
                </h3>
                {loading ? (
                    <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.875rem' }}>
                        Loading…
                    </div>
                ) : (
                    <div style={{ width: '100%', height: '220px', minHeight: '220px', position: 'relative' }}>
                        <ResponsiveContainer width="99%" aspect={3}>
                            <AreaChart data={data?.chart ?? []} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorActions" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} dy={8} interval={3} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} dx={-6} allowDecimals={false} />
                                <Tooltip contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 8px 32px rgba(0,0,0,0.1)', fontSize: '0.875rem' }} formatter={(val) => [val, 'Admin actions']} />
                                <Area type="monotone" dataKey="actions" stroke="#4f46e5" strokeWidth={2.5} fillOpacity={1} fill="url(#colorActions)" dot={false} activeDot={{ r: 5, fill: '#4f46e5' }} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
                {data?.chart?.every(d => d.actions === 0) && !loading && (
                    <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '0.8rem', marginTop: 8 }}>
                        No admin actions recorded in the last 24 hours.
                    </p>
                )}
            </div>

            {/* Recent Activity Feed */}
            {data?.recentActivity?.length > 0 && (
                <div className="admin-chart-card" style={{ marginTop: 16 }}>
                    <h3 className="admin-chart-title" style={{ marginBottom: 12 }}>
                        <Activity size={20} color="#10b981" />
                        Recent Admin Actions
                    </h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {data.recentActivity.map((a, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#f8fafc', borderRadius: 10, fontSize: '0.8125rem' }}>
                                <span style={{ background: METHOD_COLOR[a.method] || '#94a3b8', color: '#fff', padding: '2px 7px', borderRadius: 5, fontWeight: 700, fontSize: '0.7rem', minWidth: 44, textAlign: 'center' }}>
                                    {a.method}
                                </span>
                                <span style={{ color: '#475569', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.resource}</span>
                                <span style={{ color: '#94a3b8', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                    {new Date(a.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {data?.recentActivity?.length === 0 && !loading && (
                <div className="admin-chart-card" style={{ marginTop: 16, textAlign: 'center', color: '#94a3b8', padding: '32px 20px' }}>
                    No admin activity in last 24 hours. This dashboard will populate as you use the panel.
                </div>
            )}

            <style jsx global>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
