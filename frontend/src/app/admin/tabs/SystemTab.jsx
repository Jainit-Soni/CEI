"use client";

/**
 * tabs/SystemTab.jsx — CEI System & Cache Control Panel
 * ======================================================
 * Shows live system health: MongoDB, Redis, process metrics.
 * Shows cache status: hit rates, ranking key counts.
 * Shows search provider: active backend (Meilisearch vs MongoDB).
 * Trigger buttons: rebuild caches, reindex search.
 */

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Zap, Database, Search, Activity, Server, CheckCircle2, AlertCircle } from "lucide-react";

const StatusDot = ({ status }) => {
    const colors = {
        connected: '#10b981', operational: '#10b981',
        error: '#ef4444', unavailable: '#ef4444', disconnected: '#ef4444',
        connecting: '#f59e0b',
    };
    return <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: '50%', background: colors[status] || '#94a3b8', flexShrink: 0 }} />;
};

const MetricCard = ({ icon: Icon, label, value, sub, color = '#6366f1' }) => (
    <div className="sys-metric-card">
        <div className="sys-metric-icon" style={{ background: `${color}18` }}>
            <Icon size={18} color={color} />
        </div>
        <div>
            <p className="sys-metric-label">{label}</p>
            <p className="sys-metric-value">{value ?? '—'}</p>
            {sub && <p className="sys-metric-sub">{sub}</p>}
        </div>
    </div>
);

export default function SystemTab({ adminFetch }) {
    const [status, setStatus] = useState(null);
    const [cacheStats, setCacheStats] = useState(null);
    const [rankingCache, setRankingCache] = useState(null);
    const [searchMetrics, setSearchMetrics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [jobStatus, setJobStatus] = useState({});

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [sysRes, cacheRes, rankingRes, searchRes] = await Promise.allSettled([
                adminFetch('/api/admin/system/status').then(r => r.json()),
                adminFetch('/api/admin/cache-status').then(r => r.json()),
                adminFetch('/api/admin/ranking-cache').then(r => r.json()),
                adminFetch('/api/admin/search-metrics').then(r => r.json()),
            ]);

            if (sysRes.status === 'fulfilled') setStatus(sysRes.value);
            if (cacheRes.status === 'fulfilled') setCacheStats(cacheRes.value);
            if (rankingRes.status === 'fulfilled') setRankingCache(rankingRes.value);
            if (searchRes.status === 'fulfilled') setSearchMetrics(searchRes.value);
        } catch { /* fail silently — individual cards show their own states */ }
        finally { setLoading(false); }
    }, [adminFetch]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    async function triggerJob(jobName) {
        setJobStatus(prev => ({ ...prev, [jobName]: 'running' }));
        try {
            const res = await adminFetch(`/api/admin/jobs/trigger/${jobName}`, { method: 'POST' });
            const data = await res.json();
            setJobStatus(prev => ({ ...prev, [jobName]: res.ok ? 'done' : 'error' }));
            if (res.ok) setTimeout(() => setJobStatus(prev => ({ ...prev, [jobName]: null })), 3000);
        } catch {
            setJobStatus(prev => ({ ...prev, [jobName]: 'error' }));
        }
    }

    const JobBtn = ({ label, jobName, icon: Icon, color = '#6366f1' }) => {
        const s = jobStatus[jobName];
        return (
            <button
                className="sys-job-btn"
                style={{ '--job-color': color }}
                onClick={() => triggerJob(jobName)}
                disabled={s === 'running'}
            >
                {s === 'running' ? <RefreshCw size={15} className="sys-spin" /> :
                    s === 'done' ? <CheckCircle2 size={15} color="#10b981" /> :
                        s === 'error' ? <AlertCircle size={15} color="#ef4444" /> :
                            <Icon size={15} />}
                {s === 'running' ? 'Running…' : s === 'done' ? 'Done!' : s === 'error' ? 'Failed' : label}
            </button>
        );
    };

    return (
        <div className="admin-tab-content">
            <div className="sys-header">
                <h3 className="sys-title">System &amp; Cache</h3>
                <button className="sys-refresh" onClick={fetchAll} disabled={loading} title="Refresh all">
                    <RefreshCw size={15} className={loading ? 'sys-spin' : ''} /> Refresh
                </button>
            </div>

            {/* ── System Health ───────────────────────────────────────────── */}
            <section className="sys-section">
                <h4 className="sys-section-title"><Activity size={15} /> System Health</h4>
                <div className="sys-health-grid">
                    <div className="sys-health-row">
                        <StatusDot status={status?.services?.mongodb} />
                        <span className="sys-health-label">MongoDB</span>
                        <span className="sys-health-val">{status?.services?.mongodb ?? '…'}</span>
                    </div>
                    <div className="sys-health-row">
                        <StatusDot status={status?.services?.redis} />
                        <span className="sys-health-label">Redis</span>
                        <span className="sys-health-val">{status?.services?.redis ?? '…'}</span>
                    </div>
                    <div className="sys-health-row">
                        <StatusDot status="operational" />
                        <span className="sys-health-label">Node.js</span>
                        <span className="sys-health-val">{status?.process?.nodeVersion ?? '…'}</span>
                    </div>
                    <div className="sys-health-row">
                        <StatusDot status="operational" />
                        <span className="sys-health-label">Uptime</span>
                        <span className="sys-health-val">{status?.process?.uptime != null ? `${Math.floor(status.process.uptime / 3600)}h ${Math.floor((status.process.uptime % 3600) / 60)}m` : '…'}</span>
                    </div>
                </div>

                <div className="sys-metrics-row">
                    <MetricCard icon={Server} label="Heap Used" value={status?.process?.memHeapUsedMB ? `${status.process.memHeapUsedMB} MB` : '…'} sub={`of ${status?.process?.memHeapTotalMB ?? '?'} MB`} color="#8b5cf6" />
                    <MetricCard icon={Database} label="Cache Hit Rate" value={cacheStats?.hitRate ?? '…'} sub={`${(cacheStats?.keyspaceHits ?? 0).toLocaleString()} hits`} color="#f59e0b" />
                </div>
            </section>

            {/* ── Ranking Cache ───────────────────────────────────────────── */}
            <section className="sys-section">
                <h4 className="sys-section-title"><Zap size={15} /> Ranking Cache</h4>
                <div className="sys-cache-grid">
                    {[
                        { label: 'Global', val: rankingCache?.keyBreakdown?.global, color: '#6366f1' },
                        { label: 'By State', val: rankingCache?.keyBreakdown?.state, color: '#3b82f6' },
                        { label: 'By Tier', val: rankingCache?.keyBreakdown?.tier, color: '#8b5cf6' },
                        { label: 'By Band', val: rankingCache?.keyBreakdown?.band, color: '#06b6d4' },
                        { label: 'Total', val: rankingCache?.totalKeys, color: '#10b981' },
                    ].map(item => (
                        <div key={item.label} className="sys-cache-cell">
                            <span className="sys-cache-num" style={{ color: item.color }}>{item.val ?? '—'}</span>
                            <span className="sys-cache-label">{item.label}</span>
                        </div>
                    ))}
                </div>
                <div className="sys-job-row">
                    <JobBtn label="Rebuild Ranking Caches" jobName="rebuild-ranking-caches" icon={RefreshCw} color="#6366f1" />
                    <JobBtn label="Rebuild Page Caches" jobName="rebuild-page-caches" icon={Database} color="#3b82f6" />
                </div>
            </section>

            {/* ── Search Engine ───────────────────────────────────────────── */}
            <section className="sys-section">
                <h4 className="sys-section-title"><Search size={15} /> Search Engine</h4>
                <div className="sys-search-info">
                    <div className="sys-provider-badge">
                        <StatusDot status="operational" />
                        <span>Active provider:</span>
                        <strong style={{ textTransform: 'capitalize' }}>
                            {searchMetrics?.provider ?? 'mongodb'}
                        </strong>
                        {searchMetrics?.provider === 'meilisearch' && (
                            <span className="sys-provider-tag">Typo-Tolerant</span>
                        )}
                    </div>
                    {searchMetrics && (
                        <div className="sys-search-meta">
                            {searchMetrics.indexedDocuments && <span>{searchMetrics.indexedDocuments.toLocaleString()} indexed documents</span>}
                            {searchMetrics.healthy === false && <span style={{ color: '#ef4444' }}>Index health: degraded</span>}
                        </div>
                    )}
                </div>
                <div className="sys-job-row">
                    <JobBtn label="Re-sync Meilisearch Index" jobName="sync-meilisearch-index" icon={Search} color="#f59e0b" />
                </div>
            </section>

            <style jsx>{`
                .sys-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
                .sys-title { font-size: 1.25rem; font-weight: 700; color: #1e293b; margin: 0; }
                .sys-refresh { display: flex; align-items: center; gap: 6px; background: #f1f5f9; border: none; padding: 8px 14px; border-radius: 8px; font-size: 0.8125rem; font-weight: 500; color: #64748b; cursor: pointer; transition: all 0.15s; }
                .sys-refresh:hover { background: #e2e8f0; }
                .sys-refresh:disabled { opacity: 0.5; cursor: not-allowed; }
                .sys-spin { animation: spin 0.8s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }

                .sys-section { background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; margin-bottom: 16px; }
                .sys-section-title { display: flex; align-items: center; gap: 8px; font-size: 0.9rem; font-weight: 700; color: #475569; margin: 0 0 16px; text-transform: uppercase; letter-spacing: 0.04em; }

                .sys-health-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
                .sys-health-row { display: flex; align-items: center; gap: 10px; background: #f8fafc; border-radius: 10px; padding: 10px 14px; }
                .sys-health-label { font-size: 0.8125rem; color: #64748b; font-weight: 500; flex: 1; }
                .sys-health-val { font-size: 0.8125rem; color: #334155; font-weight: 600; text-transform: capitalize; }

                .sys-metrics-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
                .sys-metric-card { display: flex; align-items: center; gap: 14px; background: #f8fafc; border-radius: 12px; padding: 14px; }
                .sys-metric-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .sys-metric-label { font-size: 0.75rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; margin: 0 0 2px; }
                .sys-metric-value { font-size: 1.125rem; font-weight: 700; color: #1e293b; margin: 0; }
                .sys-metric-sub { font-size: 0.75rem; color: #64748b; margin: 0; }

                .sys-cache-grid { display: flex; gap: 16px; margin-bottom: 16px; flex-wrap: wrap; }
                .sys-cache-cell { display: flex; flex-direction: column; align-items: center; background: #f8fafc; border-radius: 12px; padding: 16px 20px; min-width: 80px; }
                .sys-cache-num { font-size: 1.625rem; font-weight: 800; }
                .sys-cache-label { font-size: 0.7rem; color: #94a3b8; font-weight: 600; text-transform: uppercase; margin-top: 4px; }

                .sys-job-row { display: flex; gap: 10px; flex-wrap: wrap; }
                .sys-job-btn {
                    display: flex; align-items: center; gap: 7px;
                    background: color-mix(in srgb, var(--job-color) 10%, #fff);
                    border: 1.5px solid color-mix(in srgb, var(--job-color) 30%, transparent);
                    color: var(--job-color);
                    padding: 9px 18px; border-radius: 10px;
                    font-size: 0.8125rem; font-weight: 600; cursor: pointer; transition: all 0.15s;
                }
                .sys-job-btn:hover:not(:disabled) {
                    background: color-mix(in srgb, var(--job-color) 18%, #fff);
                    transform: translateY(-1px);
                }
                .sys-job-btn:disabled { opacity: 0.6; cursor: not-allowed; }

                .sys-search-info { margin-bottom: 16px; }
                .sys-provider-badge { display: flex; align-items: center; gap: 8px; font-size: 0.875rem; color: #64748b; background: #f8fafc; border-radius: 10px; padding: 12px 16px; }
                .sys-provider-tag { background: #fef3c7; color: #92400e; font-size: 0.7rem; font-weight: 700; padding: 2px 8px; border-radius: 20px; }
                .sys-search-meta { display: flex; gap: 16px; margin-top: 10px; font-size: 0.8125rem; color: #64748b; padding-left: 4px; }
            `}</style>
        </div>
    );
}
