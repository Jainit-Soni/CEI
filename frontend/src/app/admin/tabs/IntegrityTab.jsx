"use client";
import { ChevronRight } from "lucide-react";

const anomalyData = [
    { id: 'AN-892', target: 'Pune Institute of Tech', type: 'Placement Spike', severity: 'High', status: 'Pending Review' },
    { id: 'AN-891', target: 'Delhi Arts College', type: 'Missing Affiliation', severity: 'Medium', status: 'Auto-Resolved' },
    { id: 'AN-890', target: 'Global Mgmt School', type: 'Fee Mismatch', severity: 'Low', status: 'Pending Review' },
];

export default function IntegrityTab() {
    return (
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
    );
}
