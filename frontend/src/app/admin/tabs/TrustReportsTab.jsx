"use client";

/**
 * tabs/TrustReportsTab.jsx — Admin Trust Reports Panel
 * ======================================================
 * Pulls live trust reports from GET /api/admin/reports.
 * Admin can approve (validate) or reject each report directly.
 * Auto-fetches pending count for sidebar badge.
 */

import { useState, useEffect, useCallback } from "react";
import { CheckCircle, XCircle, Clock, RefreshCw, ChevronDown, AlertTriangle } from "lucide-react";

const STATUS_COLORS = {
    pending: { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
    validated: { bg: '#d1fae5', color: '#065f46', label: 'Validated' },
    rejected: { bg: '#fee2e2', color: '#991b1b', label: 'Rejected' },
    duplicate: { bg: '#f3f4f6', color: '#6b7280', label: 'Duplicate' },
};

export default function TrustReportsTab({ adminFetch, onBadgeUpdate }) {
    const [reports, setReports] = useState([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("pending");
    const [actionLoading, setActionLoading] = useState({});
    const [error, setError] = useState("");
    const [expandedId, setExpandedId] = useState(null);

    const fetchReports = useCallback(async () => {
        setLoading(true); setError("");
        try {
            const res = await adminFetch(`/api/admin/reports?status=${filter}&limit=100`);
            if (!res.ok) throw new Error(await res.text());
            const data = await res.json();
            setReports(data.reports || []);
            setTotal(data.total || 0);
            // Update sidebar badge with pending count
            if (filter === 'pending' && onBadgeUpdate) onBadgeUpdate(data.total || 0);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [adminFetch, filter, onBadgeUpdate]);

    useEffect(() => { fetchReports(); }, [fetchReports]);

    async function resolve(reportId, outcome) {
        setActionLoading(prev => ({ ...prev, [reportId]: true }));
        try {
            const res = await adminFetch(`/api/admin/report/${reportId}/resolve`, {
                method: 'PATCH',
                body: JSON.stringify({ outcome }),
            });
            if (!res.ok) throw new Error(await res.text());
            // Optimistic remove from list
            setReports(prev => prev.filter(r => r._id !== reportId));
            setTotal(prev => Math.max(0, prev - 1));
            if (onBadgeUpdate) onBadgeUpdate(Math.max(0, total - 1));
        } catch (err) {
            alert("Failed: " + err.message);
        } finally {
            setActionLoading(prev => ({ ...prev, [reportId]: false }));
        }
    }

    return (
        <div className="admin-tab-content">
            <div className="tr-header">
                <div>
                    <h3 className="tr-title">Trust Reports</h3>
                    <p className="tr-subtitle">Community-submitted data corrections ({total} {filter})</p>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {['pending', 'validated', 'rejected', 'all'].map(s => (
                        <button key={s} className={`tr-filter-btn ${filter === s ? 'active' : ''}`} onClick={() => setFilter(s)}>
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                        </button>
                    ))}
                    <button className="tr-refresh-btn" onClick={fetchReports} disabled={loading} title="Refresh">
                        <RefreshCw size={15} className={loading ? 'tr-spin' : ''} />
                    </button>
                </div>
            </div>

            {error && <div className="tr-error"><AlertTriangle size={16} /> {error}</div>}

            {loading ? (
                <div className="tr-loading">
                    {[1, 2, 3, 4, 5].map(i => <div key={i} className="tr-skeleton" />)}
                </div>
            ) : reports.length === 0 ? (
                <div className="tr-empty">
                    <CheckCircle size={40} color="#10b981" />
                    <p>No {filter} reports</p>
                </div>
            ) : (
                <div className="tr-list">
                    {reports.map(r => {
                        const sc = STATUS_COLORS[r.status] || STATUS_COLORS.pending;
                        const isExpanded = expandedId === r._id;
                        const isActing = actionLoading[r._id];
                        return (
                            <div key={r._id} className="tr-card">
                                <div className="tr-card-header" onClick={() => setExpandedId(isExpanded ? null : r._id)}>
                                    <div className="tr-card-left">
                                        <span className="tr-status-chip" style={{ background: sc.bg, color: sc.color }}>{sc.label}</span>
                                        <div>
                                            <p className="tr-field-name">{r.fieldName}</p>
                                            <p className="tr-college-id">{r.collegeId}</p>
                                        </div>
                                    </div>
                                    <div className="tr-card-right">
                                        <span className="tr-date">{new Date(r.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}</span>
                                        <ChevronDown size={16} style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: '#94a3b8' }} />
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="tr-expand">
                                        <div className="tr-detail-grid">
                                            <div className="tr-detail-cell">
                                                <span className="tr-detail-label">Reported Correct Value</span>
                                                <span className="tr-detail-val tr-highlight">{r.reportedValue || '—'}</span>
                                            </div>
                                            <div className="tr-detail-cell">
                                                <span className="tr-detail-label">Reporter Trust Score</span>
                                                <span className="tr-detail-val">{r.reporterTrustScore ?? 50}/100</span>
                                            </div>
                                            <div className="tr-detail-cell" style={{ gridColumn: '1/-1' }}>
                                                <span className="tr-detail-label">Reason</span>
                                                <span className="tr-detail-val">{r.reportReason}</span>
                                            </div>
                                            {r.evidenceURL && (
                                                <div className="tr-detail-cell" style={{ gridColumn: '1/-1' }}>
                                                    <span className="tr-detail-label">Evidence</span>
                                                    <a href={r.evidenceURL} target="_blank" rel="noopener noreferrer" className="tr-evidence-link">
                                                        {r.evidenceURL.substring(0, 80)}…
                                                    </a>
                                                </div>
                                            )}
                                        </div>

                                        {r.status === 'pending' && (
                                            <div className="tr-actions">
                                                <button
                                                    className="tr-btn-approve"
                                                    onClick={() => resolve(r._id, 'validated')}
                                                    disabled={isActing}
                                                >
                                                    {isActing ? '…' : <><CheckCircle size={15} /> Validate</>}
                                                </button>
                                                <button
                                                    className="tr-btn-reject"
                                                    onClick={() => resolve(r._id, 'rejected')}
                                                    disabled={isActing}
                                                >
                                                    {isActing ? '…' : <><XCircle size={15} /> Reject</>}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            <style jsx>{`
                .tr-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
                .tr-title { font-size: 1.25rem; font-weight: 700; color: #1e293b; margin: 0 0 4px; }
                .tr-subtitle { font-size: 0.875rem; color: #64748b; margin: 0; }
                .tr-filter-btn { background: #f1f5f9; border: none; padding: 6px 14px; border-radius: 8px; font-size: 0.8125rem; font-weight: 500; color: #64748b; cursor: pointer; transition: all 0.15s; }
                .tr-filter-btn.active { background: #6366f1; color: #fff; }
                .tr-refresh-btn { background: #f1f5f9; border: none; padding: 7px 10px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; }
                .tr-refresh-btn:hover { background: #e2e8f0; }
                .tr-spin { animation: spin 0.8s linear infinite; }
                @keyframes spin { to { transform: rotate(360deg); } }
                .tr-error { display: flex; align-items: center; gap: 8px; background: #fee2e2; color: #991b1b; border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; font-size: 0.875rem; }
                .tr-loading { display: flex; flex-direction: column; gap: 12px; }
                .tr-skeleton { height: 64px; border-radius: 12px; background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 50%, #f1f5f9 75%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
                @keyframes shimmer { 0% { background-position: 200% 0 } 100% { background-position: -200% 0 } }
                .tr-empty { text-align: center; padding: 48px; color: #64748b; }
                .tr-empty p { margin: 12px 0 0; font-weight: 500; }
                .tr-list { display: flex; flex-direction: column; gap: 8px; }
                .tr-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 14px; overflow: hidden; transition: box-shadow 0.15s; }
                .tr-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.06); }
                .tr-card-header { display: flex; justify-content: space-between; align-items: center; padding: 14px 18px; cursor: pointer; }
                .tr-card-left { display: flex; align-items: center; gap: 12px; }
                .tr-card-right { display: flex; align-items: center; gap: 10px; }
                .tr-status-chip { font-size: 0.7rem; font-weight: 700; padding: 3px 10px; border-radius: 20px; white-space: nowrap; text-transform: uppercase; letter-spacing: 0.03em; }
                .tr-field-name { font-size: 0.875rem; font-weight: 600; color: #1e293b; margin: 0; }
                .tr-college-id { font-size: 0.75rem; color: #94a3b8; margin: 0; font-family: monospace; }
                .tr-date { font-size: 0.75rem; color: #94a3b8; }
                .tr-expand { padding: 0 18px 18px; border-top: 1px solid #f1f5f9; }
                .tr-detail-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding-top: 14px; margin-bottom: 16px; }
                .tr-detail-cell { display: flex; flex-direction: column; gap: 4px; }
                .tr-detail-label { font-size: 0.7rem; text-transform: uppercase; color: #94a3b8; font-weight: 600; letter-spacing: 0.04em; }
                .tr-detail-val { font-size: 0.875rem; color: #334155; line-height: 1.5; }
                .tr-highlight { font-weight: 700; color: #6366f1; }
                .tr-evidence-link { font-size: 0.8125rem; color: #3b82f6; text-decoration: underline; overflow-wrap: break-word; }
                .tr-actions { display: flex; gap: 8px; }
                .tr-btn-approve { display: flex; align-items: center; gap: 6px; background: #10b981; border: none; color: #fff; padding: 8px 18px; border-radius: 8px; font-size: 0.8125rem; font-weight: 600; cursor: pointer; transition: all 0.15s; }
                .tr-btn-approve:hover:not(:disabled) { background: #059669; }
                .tr-btn-reject { display: flex; align-items: center; gap: 6px; background: #ef4444; border: none; color: #fff; padding: 8px 18px; border-radius: 8px; font-size: 0.8125rem; font-weight: 600; cursor: pointer; transition: all 0.15s; }
                .tr-btn-reject:hover:not(:disabled) { background: #dc2626; }
                .tr-btn-approve:disabled, .tr-btn-reject:disabled { opacity: 0.6; cursor: not-allowed; }
            `}</style>
        </div>
    );
}
