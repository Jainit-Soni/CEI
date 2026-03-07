"use client";

/**
 * tabs/SystemTab.jsx — CEI System Control Panel (Google Analytics style)
 * =======================================================================
 * Clean light UI. All data is real. All buttons are wired.
 * No dark backgrounds inside the panel — sidebar handles that.
 */

import { useState, useEffect, useCallback } from "react";
import {
    RefreshCw, Activity, Database, Search, Server,
    CheckCircle2, AlertCircle, Zap, RotateCcw, Wifi
} from "lucide-react";

// ── Small reusable pieces ─────────────────────────────────────────────────────

function StatusPill({ status }) {
    const colors = {
        connected: { bg: '#d1fae5', color: '#065f46' },
        operational: { bg: '#d1fae5', color: '#065f46' },
        disconnected: { bg: '#fee2e2', color: '#991b1b' },
        error: { bg: '#fee2e2', color: '#991b1b' },
        unavailable: { bg: '#fee2e2', color: '#991b1b' },
        connecting: { bg: '#fef3c7', color: '#92400e' },
    };
    const s = colors[status] || { bg: '#f1f5f9', color: '#64748b' };
    return (
        <span style={{ background: s.bg, color: s.color, fontSize: '0.75rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20, textTransform: 'capitalize' }}>
            {status || '—'}
        </span>
    );
}

function Card({ children, style }) {
    return (
        <div style={{
            background: '#fff', borderRadius: 16, border: '1px solid #e2e8f0',
            padding: '20px 24px', ...style
        }}>{children}</div>
    );
}

function SectionTitle({ icon: Icon, label }) {
    return (
        <p style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 7, fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <Icon size={14} /> {label}
        </p>
    );
}

function ActionBtn({ label, jobName, icon: Icon, color, onTrigger, running }) {
    const isRunning = running === jobName;
    return (
        <button
            onClick={() => onTrigger(jobName)}
            disabled={!!running}
            style={{
                display: 'flex', alignItems: 'center', gap: 7,
                background: color + '12', border: `1.5px solid ${color}30`,
                color, padding: '9px 18px', borderRadius: 10,
                fontSize: '0.8125rem', fontWeight: 600, cursor: running ? 'not-allowed' : 'pointer',
                opacity: running && !isRunning ? 0.5 : 1,
                transition: 'all 0.15s',
            }}
        >
            {isRunning
                ? <RefreshCw size={14} style={{ animation: 'spin 0.8s linear infinite' }} />
                : <Icon size={14} />}
            {isRunning ? 'Running…' : label}
        </button>
    );
}

// ── Main Tab ──────────────────────────────────────────────────────────────────

export default function SystemTab({ adminFetch }) {
    const [status, setStatus] = useState(null);
    const [cacheStats, setCacheStats] = useState(null);
    const [rankingCache, setRankingCache] = useState(null);
    const [searchMetrics, setSearchMetrics] = useState(null);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(null); // currently-running jobName
    const [jobResult, setJobResult] = useState({});   // { jobName: 'done'|'error' }

    const fetchAll = useCallback(async () => {
        if (!adminFetch) return;
        setLoading(true);
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
        setLoading(false);
    }, [adminFetch]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    async function triggerJob(jobName) {
        setRunning(jobName);
        setJobResult(prev => ({ ...prev, [jobName]: null }));
        try {
            const res = await adminFetch(`/api/admin/jobs/trigger/${jobName}`, { method: 'POST' });
            setJobResult(prev => ({ ...prev, [jobName]: res.ok ? 'done' : 'error' }));
            if (res.ok) {
                setTimeout(() => setJobResult(prev => ({ ...prev, [jobName]: null })), 4000);
                // Refresh stats after a short delay
                setTimeout(fetchAll, 2000);
            }
        } catch {
            setJobResult(prev => ({ ...prev, [jobName]: 'error' }));
        } finally {
            setRunning(null);
        }
    }

    const proc = status?.process;
    const svc = status?.services;
    const hitRate = cacheStats?.hitRate;
    const rkb = rankingCache?.keyBreakdown ?? {};

    return (
        <div style={{ maxWidth: 1200, display: 'grid', gap: 16 }}>

            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1.1rem', color: '#1e293b' }}>System Health</h3>
                    <p style={{ margin: '3px 0 0', fontSize: '0.8125rem', color: '#94a3b8' }}>
                        {status?.timestamp ? `Last checked ${new Date(status.timestamp).toLocaleTimeString('en-IN')}` : 'Fetching…'}
                    </p>
                </div>
                <button
                    onClick={fetchAll} disabled={loading}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#f1f5f9', border: 'none', padding: '8px 16px', borderRadius: 10, fontSize: '0.8125rem', fontWeight: 500, color: '#475569', cursor: 'pointer' }}
                >
                    <RefreshCw size={14} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} /> Refresh
                </button>
            </div>

            {/* ── Services + Process ─── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                {[
                    { icon: Database, label: 'MongoDB', value: svc?.mongodb, chip: true, color: '#10b981' },
                    { icon: Wifi, label: 'Redis', value: svc?.redis, chip: true, color: '#6366f1' },
                    { icon: Server, label: 'Node.js', value: proc?.nodeVersion, color: '#3b82f6' },
                    { icon: Activity, label: 'Uptime', value: proc?.uptime != null ? `${Math.floor(proc.uptime / 3600)}h ${Math.floor((proc.uptime % 3600) / 60)}m` : null, color: '#f59e0b' },
                    { icon: Zap, label: 'Heap Used', value: proc?.memHeapUsedMB ? `${proc.memHeapUsedMB} MB` : null, sub: `of ${proc?.memHeapTotalMB ?? '?'} MB total`, color: '#8b5cf6' },
                    { icon: Database, label: 'Cache Hit Rate', value: hitRate, sub: hitRate ? `${(cacheStats?.keyspaceHits ?? 0).toLocaleString()} hits` : null, color: '#06b6d4' },
                ].map((item, i) => (
                    <Card key={i} style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 10, background: item.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <item.icon size={17} color={item.color} />
                        </div>
                        <div style={{ overflow: 'hidden' }}>
                            <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{item.label}</p>
                            {item.chip
                                ? <StatusPill status={item.value} />
                                : <p style={{ margin: '2px 0 0', fontWeight: 700, fontSize: '1.05rem', color: '#1e293b' }}>{item.value ?? '…'}</p>
                            }
                            {item.sub && <p style={{ margin: 0, fontSize: '0.7rem', color: '#94a3b8' }}>{item.sub}</p>}
                        </div>
                    </Card>
                ))}
            </div>

            {/* ── Ranking Cache ─── */}
            <Card>
                <SectionTitle icon={Zap} label="Ranking Cache (Redis)" />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, marginBottom: 16 }}>
                    {[
                        { label: 'Global', val: rkb.global, color: '#6366f1' },
                        { label: 'By State', val: rkb.state, color: '#3b82f6' },
                        { label: 'By Tier', val: rkb.tier, color: '#8b5cf6' },
                        { label: 'By Band', val: rkb.band, color: '#06b6d4' },
                        { label: 'Total', val: rankingCache?.totalKeys, color: '#10b981' },
                    ].map((c, i) => (
                        <div key={i} style={{ background: c.color + '10', border: `1px solid ${c.color}20`, borderRadius: 12, padding: '14px 16px', textAlign: 'center' }}>
                            <p style={{ margin: 0, fontSize: '1.625rem', fontWeight: 800, color: c.color }}>{c.val ?? '—'}</p>
                            <p style={{ margin: '4px 0 0', fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>{c.label}</p>
                        </div>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <ActionBtn label="Rebuild Ranking Caches" jobName="rebuild-ranking-caches" icon={RotateCcw} color="#6366f1" onTrigger={triggerJob} running={running} />
                    <ActionBtn label="Rebuild Page Caches" jobName="rebuild-page-caches" icon={Database} color="#3b82f6" onTrigger={triggerJob} running={running} />
                    {jobResult['rebuild-ranking-caches'] === 'done' && <span style={{ color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem' }}><CheckCircle2 size={15} /> Done!</span>}
                    {jobResult['rebuild-ranking-caches'] === 'error' && <span style={{ color: '#ef4444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem' }}><AlertCircle size={15} /> Failed</span>}
                </div>
            </Card>

            {/* ── Search Engine ─── */}
            <Card>
                <SectionTitle icon={Search} label="Search Engine" />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                    <StatusPill status="operational" />
                    <span style={{ fontSize: '0.875rem', color: '#64748b' }}>Active provider:</span>
                    <strong style={{ fontSize: '0.9375rem', color: '#1e293b', textTransform: 'capitalize' }}>
                        {searchMetrics?.provider ?? 'mongodb'}
                    </strong>
                    {searchMetrics?.provider === 'meilisearch' && (
                        <span style={{ background: '#fef3c7', color: '#92400e', fontSize: '0.7rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>Typo-Tolerant</span>
                    )}
                    {searchMetrics?.indexedDocuments && (
                        <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>{searchMetrics.indexedDocuments.toLocaleString()} indexed docs</span>
                    )}
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                    <ActionBtn label="Re-sync Meilisearch Index" jobName="sync-meilisearch-index" icon={Search} color="#f59e0b" onTrigger={triggerJob} running={running} />
                    {jobResult['sync-meilisearch-index'] === 'done' && <span style={{ color: '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem' }}><CheckCircle2 size={15} /> Synced!</span>}
                </div>
            </Card>

            {/* ── Jobs ─── */}
            <Card>
                <SectionTitle icon={RotateCcw} label="Manual Job Triggers" />
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <ActionBtn label="Full Anomaly Scan" jobName="weekly-anomaly-scan" icon={Activity} color="#ef4444" onTrigger={triggerJob} running={running} />
                    <ActionBtn label="Integrity Recompute" jobName="monthly-integrity-recompute" icon={Database} color="#8b5cf6" onTrigger={triggerJob} running={running} />
                    <ActionBtn label="Placement Scan" jobName="weekly-placement-scan" icon={Activity} color="#f59e0b" onTrigger={triggerJob} running={running} />
                </div>
                {Object.entries(jobResult).map(([job, result]) =>
                    result === 'done' ? (
                        <span key={job} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#10b981', fontWeight: 600, fontSize: '0.8rem', marginTop: 10 }}>
                            <CheckCircle2 size={14} /> {job} completed
                        </span>
                    ) : result === 'error' ? (
                        <span key={job} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#ef4444', fontWeight: 600, fontSize: '0.8rem', marginTop: 10 }}>
                            <AlertCircle size={14} /> {job} failed
                        </span>
                    ) : null
                )}
            </Card>

            <style jsx global>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
    );
}
