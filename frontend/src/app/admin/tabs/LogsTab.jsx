"use client";

/**
 * tabs/LogsTab.jsx — Real Admin Audit Log (not fake system logs)
 * ===============================================================
 * Fetches real entries from /api/admin/audit-log (AdminAuditLog collection).
 * Color-coded by HTTP method. Auto-refreshes every 30s.
 */

import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";

const METHOD_META = {
    GET: { bg: '#dbeafe', color: '#1d4ed8', label: 'GET' },
    POST: { bg: '#d1fae5', color: '#065f46', label: 'POST' },
    PATCH: { bg: '#fef3c7', color: '#92400e', label: 'PATCH' },
    DELETE: { bg: '#fee2e2', color: '#991b1b', label: 'DELETE' },
};

export default function LogsTab({ adminFetch }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [lastRefresh, setLastRefresh] = useState(null);

    const fetchLogs = useCallback(async () => {
        if (!adminFetch) return;
        setLoading(true); setError("");
        try {
            const res = await adminFetch("/api/admin/audit-log?limit=100");
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            setLogs(data.logs || []);
            setLastRefresh(new Date());
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [adminFetch]);

    useEffect(() => {
        fetchLogs();
        // Auto-refresh every 30s
        const interval = setInterval(fetchLogs, 30_000);
        return () => clearInterval(interval);
    }, [fetchLogs]);

    return (
        <div className="reveal revealed">
            <div className="admin-terminal">
                <div className="admin-terminal-header">
                    <div className="admin-terminal-dots">
                        <div className="admin-terminal-dot" style={{ background: '#ef4444' }} />
                        <div className="admin-terminal-dot" style={{ background: '#eab308' }} />
                        <div className="admin-terminal-dot" style={{ background: '#22c55e' }} />
                    </div>
                    <span className="admin-terminal-path">CEI / admin / audit-log (live)</span>
                    <button
                        onClick={fetchLogs}
                        disabled={loading}
                        style={{ marginLeft: 'auto', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#94a3b8', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.75rem' }}
                    >
                        <RefreshCw size={12} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
                        Refresh
                    </button>
                </div>

                <div className="admin-terminal-body">
                    {error && (
                        <div style={{ color: '#f87171', marginBottom: 12, fontSize: '0.8125rem' }}>
                            ⚠ Failed to load: {error}
                        </div>
                    )}

                    {loading && logs.length === 0 && (
                        <div style={{ color: '#64748b', fontSize: '0.8125rem' }}>Fetching audit logs…</div>
                    )}

                    {!loading && logs.length === 0 && !error && (
                        <div style={{ color: '#64748b' }}>
                            No admin actions logged yet. Actions will appear here as you use the panel.
                        </div>
                    )}

                    {logs.map((log, i) => {
                        const m = METHOD_META[log.method] || { bg: '#f1f5f9', color: '#64748b', label: log.method };
                        const ts = new Date(log.timestamp);
                        return (
                            <div key={i} className="log-line" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                                <span style={{ color: '#475569', fontSize: '0.7rem', whiteSpace: 'nowrap', fontFamily: 'monospace', paddingTop: 2 }}>
                                    {ts.toLocaleDateString('en-IN', { month: 'short', day: '2-digit' })} {ts.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                                </span>
                                <span style={{ background: m.bg, color: m.color, fontSize: '0.65rem', fontWeight: 700, padding: '2px 7px', borderRadius: 5, whiteSpace: 'nowrap' }}>
                                    {m.label}
                                </span>
                                <span style={{ color: '#e2e8f0', flex: 1, fontSize: '0.8125rem', wordBreak: 'break-all' }}>
                                    {log.resource}
                                </span>
                                <span style={{ color: '#64748b', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
                                    {log.adminEmail?.split('@')[0]}
                                </span>
                            </div>
                        );
                    })}

                    {!loading && logs.length > 0 && (
                        <div style={{ color: '#334155', marginTop: 16, fontSize: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
                            Showing last {logs.length} entries · Auto-refreshes every 30s
                            {lastRefresh && ` · Last refresh: ${lastRefresh.toLocaleTimeString('en-IN')}`}
                        </div>
                    )}

                    <div style={{ color: '#64748b', marginTop: 12, fontSize: '0.75rem' }}>▸ _</div>
                </div>
            </div>

            <style jsx global>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
