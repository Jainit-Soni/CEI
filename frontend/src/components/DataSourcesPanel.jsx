"use client";
/**
 * DataSourcesPanel.jsx — CEI "View Data Sources" Expandable Panel
 * ================================================================
 * Renders per-field provenance for each critical data field of an institution.
 * Data fetched from: GET /api/verification/integrity/:collegeId
 *
 * Shows: Field name | Source type | Verification status | Last evaluated
 * Displayed inside the ExplainabilityCard / CEI Intelligence tab.
 */

import { useState, useEffect } from "react";
import DataConfidenceBadge from "./DataConfidenceBadge";
import "./DataSourcesPanel.css";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000").replace(/\/$/, "");

const FIELD_LABELS = {
    establishedYear: "Established Year",
    campusSize: "Campus Size",
    accreditationStatus: "Accreditation Status",
    affiliations: "Affiliations",
    coursesOffered: "Courses Offered",
    studentIntake: "Student Intake",
    avgPackage: "Average Package",
    highestPackage: "Highest Package",
    placementRate: "Placement Rate",
    companiesVisiting: "Companies Visiting",
    facultyCount: "Faculty Count",
    infrastructureMetric: "Infrastructure"
};

const SOURCE_TYPE_LABELS = {
    government_registry: "Government Registry",
    official_website: "Official Website",
    audited_report: "Audited Report",
    third_party_report: "Third-Party Report",
    self_declared: "Self-Declared",
    unknown: "Unknown"
};

const STATUS_CONFIG = {
    manually_evaluated: { label: "Manually Evaluated", color: "#34d399" },
    auto_evaluated: { label: "Auto-Evaluated", color: "#60a5fa" },
    disputed: { label: "Disputed", color: "#f87171" },
    unindexed: { label: "Unindexed", color: "#94a3b8" }
};

const VERIFIER_LABELS = {
    aishe: "AISHE",
    ugc: "UGC",
    aicte: "AICTE",
    human_reviewer: "Manual Review",
    auto_engine: "Auto Engine",
    none: "—"
};

export default function DataSourcesPanel({ collegeId }) {
    const [open, setOpen] = useState(false);
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!open || data || !collegeId) return;
        setLoading(true);
        fetch(`${API_URL}/api/verification/integrity/${collegeId}`)
            .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
            .then(d => { setData(d); setLoading(false); })
            .catch(e => { setError("Could not load data sources."); setLoading(false); });
    }, [open, collegeId]);

    const fieldSources = data?.fieldSources || {};
    const entries = Object.entries(FIELD_LABELS);

    return (
        <div className="dsp-root">
            {/* Trigger button */}
            <button
                className={`dsp-trigger ${open ? "open" : ""}`}
                onClick={() => setOpen(v => !v)}
                aria-expanded={open}
            >
                <span>📂 View Data Sources</span>
                <svg
                    className={`dsp-chevron ${open ? "rotate" : ""}`}
                    viewBox="0 0 24 24" fill="none" stroke="currentColor"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    width={14} height={14}
                >
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>

            {/* Expandable panel */}
            {open && (
                <div className="dsp-panel">
                    {/* Header */}
                    {data && (
                        <div className="dsp-header">
                            <div className="dsp-header-left">
                                <span className="dsp-institution">{data.collegeName}</span>
                                {data.lastIntegrityCheck && (
                                    <span className="dsp-last-check">
                                        Last evaluated: {new Date(data.lastIntegrityCheck).toLocaleDateString("en-IN")}
                                    </span>
                                )}
                            </div>
                            <DataConfidenceBadge
                                label={data.dataConfidenceLabel || "low"}
                                score={data.dataIntegrityScore}
                            />
                        </div>
                    )}

                    {/* Anomaly / Mismatch warnings */}
                    {data?.hasOpenAnomalies && (
                        <div className="dsp-warning anomaly">
                            ⚠️ <strong>Open Anomaly Alerts:</strong> Some fields have triggered statistical anomaly detection. Verify with caution.
                        </div>
                    )}
                    {data?.hasGovernmentMismatch && (
                        <div className="dsp-warning mismatch">
                            🔴 <strong>Regulatory Mismatch Detected:</strong> One or more fields conflict with official government registry data (AISHE/UGC/AICTE). Under review.
                        </div>
                    )}

                    {/* Loading / Error states */}
                    {loading && <div className="dsp-loading">Loading source provenance...</div>}
                    {error && <div className="dsp-error">⚠️ {error}</div>}

                    {/* Field sources table */}
                    {!loading && !error && (
                        <div className="dsp-table-wrap">
                            <table className="dsp-table" aria-label="Data source provenance table">
                                <thead>
                                    <tr>
                                        <th>Field</th>
                                        <th>Source Type</th>
                                        <th>Verification</th>
                                        <th>Evaluated By</th>
                                        <th>Last Evaluated</th>
                                        <th>Confidence</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entries.map(([key, label]) => {
                                        const src = fieldSources[key];
                                        const status = src?.verification_status || "unindexed";
                                        const sc = STATUS_CONFIG[status] || STATUS_CONFIG.unindexed;
                                        return (
                                            <tr key={key} className={`dsp-row ${status}`}>
                                                <td className="dsp-field-name">{label}</td>
                                                <td>
                                                    {src?.source_type
                                                        ? SOURCE_TYPE_LABELS[src.source_type] || src.source_type
                                                        : <span className="dsp-na">—</span>}
                                                </td>
                                                <td>
                                                    <span
                                                        className="dsp-status-pill"
                                                        style={{ color: sc.color, borderColor: sc.color + "44", background: sc.color + "18" }}
                                                    >
                                                        {sc.label}
                                                    </span>
                                                </td>
                                                <td>{VERIFIER_LABELS[src?.verifier_type] || "—"}</td>
                                                <td className="dsp-date">
                                                    {src?.evaluated_at
                                                        ? new Date(src.evaluated_at).toLocaleDateString("en-IN")
                                                        : <span className="dsp-na">Not evaluated</span>}
                                                </td>
                                                <td>
                                                    {src?.confidence_level
                                                        ? <DataConfidenceBadge label={src.confidence_level === "high" ? "high" : src.confidence_level === "medium" ? "moderate" : "low"} compact />
                                                        : <span className="dsp-na">—</span>}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="dsp-footer">
                        <a href="/methodology" className="dsp-footer-link">
                            📖 How does the Data Integrity Score work? →
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
}
