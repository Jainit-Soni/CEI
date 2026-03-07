"use client";
import { Database, CheckCircle, AlertTriangle, Zap, Activity } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const trafficData = [
    { time: '00:00', requests: 4200, errors: 12 },
    { time: '04:00', requests: 2800, errors: 5 },
    { time: '08:00', requests: 12500, errors: 45 },
    { time: '12:00', requests: 28900, errors: 120 },
    { time: '16:00', requests: 35200, errors: 156 },
    { time: '20:00', requests: 18400, errors: 68 },
    { time: '23:59', requests: 8600, errors: 24 },
];

export default function DashboardTab() {
    return (
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
    );
}
