"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { postReport } from "@/lib/api";

// ── Reportable Fields ──────────────────────────────────────────────────────────
// Maps fieldName (API key) → human label + type hint for the input
const REPORTABLE_FIELDS = [
    { key: "placements.highestPackage", label: "Highest Package", hint: "What is the actual highest package? (e.g. 18 LPA)" },
    { key: "placements.averagePackage", label: "Average Package", hint: "What is the correct average package?" },
    { key: "placements.placementRate", label: "Placement Rate", hint: "What is the actual placement percentage?" },
    { key: "fees.tuitionFee", label: "Tuition Fee", hint: "What is the correct annual tuition fee?" },
    { key: "fees.hostelFee", label: "Hostel Fee", hint: "What is the correct hostel fee?" },
    { key: "affiliatedTo", label: "Affiliated University", hint: "Which university is this college actually affiliated to?" },
    { key: "accreditation", label: "Accreditation / Grade", hint: "What is the correct NAAC grade or NBA accreditation?" },
    { key: "rankingNirf", label: "NIRF Ranking", hint: "What is the correct NIRF ranking for this college?" },
    { key: "approvedBy", label: "Approved By (AICTE etc)", hint: "Which bodies actually approve this college?" },
    { key: "courseOffered", label: "Courses Offered", hint: "Which courses are incorrect or missing?" },
    { key: "intake", label: "Student Intake / Seats", hint: "What is the correct intake capacity?" },
    { key: "other", label: "Other / General Data", hint: "Describe what data is incorrect below." },
];

// ── Field → College Object Value Resolver ────────────────────────────────────
// Maps each reportable field key to a function that extracts the current
// value from the college object prop. Used to show context in Step 2.
const FIELD_VALUE_RESOLVER = {
    "placements.highestPackage": (c) => c.placements?.highestPackage || c.placements?.highestPackageNumeric ? `${c.placements.highestPackage || (c.placements.highestPackageNumeric / 100000).toFixed(1) + ' LPA'}` : null,
    "placements.averagePackage": (c) => c.placements?.averagePackage || null,
    "placements.placementRate": (c) => c.placements?.placementRate ? `${c.placements.placementRate}%` : null,
    "fees.tuitionFee": (c) => c.fees?.tuitionFee || null,
    "fees.hostelFee": (c) => c.fees?.hostelFee || null,
    "affiliatedTo": (c) => c.affiliatedTo || null,
    "accreditation": (c) => c.accreditation || c.naacGrade || null,
    "rankingNirf": (c) => c.rankingNirf ? `#${c.rankingNirf}` : null,
    "approvedBy": (c) => Array.isArray(c.approvedBy) ? c.approvedBy.join(", ") : (c.approvedBy || null),
    "courseOffered": (c) => Array.isArray(c.courses) ? `${c.courses.length} courses listed` : null,
    "intake": (c) => c.intake ? String(c.intake) : null,
    "other": () => null,
};

function getCurrentValue(fieldKey, college) {
    const resolver = FIELD_VALUE_RESOLVER[fieldKey];
    if (!resolver || !college) return null;
    try {
        const val = resolver(college);
        return val ? String(val).trim() : null;
    } catch {
        return null;
    }
}


export default function ReportDataModal({ college, isOpen, onClose }) {
    const [step, setStep] = useState(1);          // 1 = select field, 2 = detail, 3 = done
    const [fieldKey, setFieldKey] = useState("");
    const [reportedValue, setReportedValue] = useState("");
    const [reportReason, setReportReason] = useState("");
    const [evidenceURL, setEvidenceURL] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [result, setResult] = useState(null);
    const overlayRef = useRef(null);
    const firstInputRef = useRef(null);

    // Reset on close
    useEffect(() => {
        if (!isOpen) {
            setTimeout(() => {
                setStep(1); setFieldKey(""); setReportedValue("");
                setReportReason(""); setEvidenceURL(""); setError(""); setResult(null);
            }, 300);
        } else {
            setTimeout(() => firstInputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleOverlayClick = useCallback((e) => {
        if (e.target === overlayRef.current) onClose();
    }, [onClose]);

    // Escape key
    useEffect(() => {
        const onKey = (e) => { if (e.key === "Escape") onClose(); };
        if (isOpen) document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [isOpen, onClose]);

    const selectedField = REPORTABLE_FIELDS.find(f => f.key === fieldKey);

    async function handleSubmit(e) {
        e.preventDefault();
        if (!fieldKey) { setError("Please select the field that is incorrect."); return; }
        if (!reportedValue.trim()) { setError("Please enter the correct value."); return; }
        if (reportReason.trim().length < 10) { setError("Reason must be at least 10 characters."); return; }

        if (evidenceURL && !/^https?:\/\//i.test(evidenceURL)) {
            setError("Evidence URL must start with http:// or https://");
            return;
        }

        setLoading(true); setError("");

        try {
            const data = await postReport({
                collegeId: college.id,
                fieldName: fieldKey,
                reportedValue: reportedValue.trim(),
                reportReason: reportReason.trim(),
                evidenceURL: evidenceURL.trim() || null,
            });

            setResult(data);
            setStep(3);
        } catch (err) {
            if (err.response?.status === 429) {
                setError("You've submitted too many reports recently. Please wait before submitting again.");
            } else {
                setError(err.response?.data?.error || "Submission failed. Please try again.");
            }
        } finally {
            setLoading(false);
        }
    }

    if (!isOpen) return null;

    return (
        <div
            ref={overlayRef}
            onClick={handleOverlayClick}
            className="rdr-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Report Incorrect Data"
        >
            <div className="rdr-modal">
                {/* ── Header ─────────────────────────────────────────────────── */}
                <div className="rdr-header">
                    <div className="rdr-header-left">
                        <span className="rdr-icon">🔍</span>
                        <div>
                            <h2 className="rdr-title">Report Incorrect Data</h2>
                            <p className="rdr-subtitle">{college?.name}</p>
                        </div>
                    </div>
                    <button className="rdr-close" onClick={onClose} aria-label="Close">✕</button>
                </div>

                {/* ── Step indicator ─────────────────────────────────────────── */}
                {step < 3 && (
                    <div className="rdr-steps">
                        {["Select Field", "Add Details"].map((label, i) => (
                            <div key={i} className={`rdr-step ${step === i + 1 ? "active" : step > i + 1 ? "done" : ""}`}>
                                <span className="rdr-step-num">{step > i + 1 ? "✓" : i + 1}</span>
                                <span className="rdr-step-label">{label}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Step 1: Select field ───────────────────────────────────── */}
                {step === 1 && (
                    <div className="rdr-body">
                        <p className="rdr-intro">
                            Which piece of data is incorrect? Select the field, then provide the correct information and evidence.
                        </p>
                        <div className="rdr-field-grid" ref={firstInputRef} tabIndex={-1}>
                            {REPORTABLE_FIELDS.map(f => (
                                <button
                                    key={f.key}
                                    className={`rdr-field-btn ${fieldKey === f.key ? "selected" : ""}`}
                                    onClick={() => setFieldKey(f.key)}
                                    type="button"
                                >
                                    <span className="rdr-field-label">{f.label}</span>
                                    {fieldKey === f.key && <span className="rdr-field-check">✓</span>}
                                </button>
                            ))}
                        </div>
                        <div className="rdr-footer">
                            <button className="rdr-btn-cancel" onClick={onClose} type="button">Cancel</button>
                            <button
                                className="rdr-btn-next"
                                onClick={() => { if (!fieldKey) { setError("Please select a field."); return; } setError(""); setStep(2); }}
                                type="button"
                                disabled={!fieldKey}
                            >
                                Continue →
                            </button>
                        </div>
                        {error && <p className="rdr-error">{error}</p>}
                    </div>
                )}

                {/* ── Step 2: Details form ───────────────────────────────────── */}
                {step === 2 && (
                    <form className="rdr-body" onSubmit={handleSubmit} noValidate>
                        <div className="rdr-selected-badge">
                            <span className="rdr-badge-label">Reporting:</span>
                            <span className="rdr-badge-value">{selectedField?.label}</span>
                            <button type="button" className="rdr-change" onClick={() => { setStep(1); setError(""); }}>Change</button>
                        </div>

                        {/* Current value context */}
                        {(() => {
                            const cur = getCurrentValue(fieldKey, college);
                            return cur ? (
                                <div className="rdr-current-value">
                                    <span className="rdr-cv-label">Current value on CEI:</span>
                                    <span className="rdr-cv-val">{cur}</span>
                                </div>
                            ) : null;
                        })()}

                        <label className="rdr-label" htmlFor="rdr-correct-value">
                            What is the correct value?
                            <span className="rdr-required">*</span>
                        </label>
                        <input
                            id="rdr-correct-value"
                            ref={firstInputRef}
                            className="rdr-input"
                            type="text"
                            placeholder={selectedField?.hint || "Enter the correct value"}
                            value={reportedValue}
                            onChange={e => setReportedValue(e.target.value)}
                            maxLength={500}
                            required
                        />

                        <label className="rdr-label" htmlFor="rdr-reason">
                            Why do you believe this is incorrect?
                            <span className="rdr-required">*</span>
                        </label>
                        <textarea
                            id="rdr-reason"
                            className="rdr-textarea"
                            placeholder="E.g. The college website shows a different figure. The official NIRF data contradicts this. I am a student/alumni..."
                            value={reportReason}
                            onChange={e => setReportReason(e.target.value)}
                            maxLength={1000}
                            rows={4}
                            required
                        />
                        <p className="rdr-char-count">{reportReason.length}/1000</p>

                        <label className="rdr-label" htmlFor="rdr-evidence">
                            Evidence URL
                            <span className="rdr-optional"> (optional but recommended)</span>
                        </label>
                        <input
                            id="rdr-evidence"
                            className="rdr-input"
                            type="url"
                            placeholder="https://nirf.org/report/... or college website link"
                            value={evidenceURL}
                            onChange={e => setEvidenceURL(e.target.value)}
                            maxLength={2000}
                        />
                        <p className="rdr-hint">Link to the official page, NIRF report, or any public source that supports your report.</p>

                        {error && <p className="rdr-error">{error}</p>}

                        <div className="rdr-footer">
                            <button type="button" className="rdr-btn-cancel" onClick={() => { setStep(1); setError(""); }}>← Back</button>
                            <button type="submit" className="rdr-btn-submit" disabled={loading}>
                                {loading ? (
                                    <span className="rdr-spinner-row"><span className="rdr-spinner" />Submitting…</span>
                                ) : "Submit Report"}
                            </button>
                        </div>

                        <p className="rdr-disclaimer">
                            Reports are reviewed by the CEI verification team. Max 5 reports per hour. Your IP is hashed for abuse prevention only.
                        </p>
                    </form>
                )}

                {/* ── Step 3: Success ─────────────────────────────────────────── */}
                {step === 3 && result && (
                    <div className="rdr-body rdr-success-body">
                        <div className="rdr-success-icon">
                            {result.isDuplicate ? "📋" : "✅"}
                        </div>
                        <h3 className="rdr-success-title">
                            {result.isDuplicate ? "Report Logged" : "Report Submitted!"}
                        </h3>
                        <p className="rdr-success-msg">{result.message}</p>

                        {!result.isDuplicate && (
                            <div className="rdr-success-meta">
                                <div className="rdr-meta-row">
                                    <span className="rdr-meta-label">Reference</span>
                                    <code className="rdr-meta-val">{result.reportRef?.toString().slice(-8).toUpperCase()}</code>
                                </div>
                                {result.anomalyBoostApplied > 0 && (
                                    <div className="rdr-meta-row">
                                        <span className="rdr-meta-label">Anomaly Weight Boost</span>
                                        <span className="rdr-meta-val rdr-boost">+{result.anomalyBoostApplied}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        <p className="rdr-success-note">
                            Your report has been flagged for verification. Thanks for helping make CEI more accurate.
                        </p>

                        <button className="rdr-btn-done" onClick={onClose}>Done</button>
                    </div>
                )}
            </div>

            <style jsx>{`
                .rdr-overlay {
                    position: fixed; inset: 0; z-index: 9999;
                    background: rgba(79, 70, 229, 0.12);
                    backdrop-filter: blur(12px);
                    display: flex; align-items: center; justify-content: center;
                    padding: 1rem;
                    animation: rdrFadeIn 0.2s ease;
                }
                @keyframes rdrFadeIn { from { opacity: 0 } to { opacity: 1 } }

                .rdr-modal {
                    background: rgba(255, 255, 255, 0.88);
                    backdrop-filter: blur(28px);
                    -webkit-backdrop-filter: blur(28px);
                    border: 1px solid rgba(99, 102, 241, 0.15);
                    border-radius: 24px;
                    width: 100%; max-width: 560px;
                    max-height: 90vh; overflow-y: auto;
                    box-shadow: 0 24px 80px rgba(79, 70, 229, 0.15), 0 4px 16px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.95);
                    animation: rdrSlideUp 0.25s cubic-bezier(.16,1,.3,1);
                    position: relative;
                    overflow: hidden;
                }
                .rdr-modal::before {
                    content: "";
                    position: absolute; top: 0; left: 0; right: 0;
                    height: 3px;
                    background: linear-gradient(90deg, #4f46e5, #7c3aed, #ec4899);
                    border-radius: 24px 24px 0 0;
                }
                @keyframes rdrSlideUp { from { transform: translateY(24px); opacity: 0 } to { transform: none; opacity: 1 } }

                /* Header */
                .rdr-header {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 1.5rem 1.75rem 1rem;
                    border-bottom: 1px solid rgba(99, 102, 241, 0.08);
                }
                .rdr-header-left { display: flex; align-items: center; gap: 0.875rem; }
                .rdr-icon { font-size: 1.5rem; }
                .rdr-title { font-size: 1.125rem; font-weight: 800; color: #1A1A2E; margin: 0; }
                .rdr-subtitle { font-size: 0.75rem; color: #4f46e5; margin: 0; margin-top: 2px; font-weight: 600; }
                .rdr-close {
                    background: rgba(99, 102, 241, 0.06); border: 1px solid rgba(99, 102, 241, 0.12); color: #8C8CA1;
                    width: 32px; height: 32px; border-radius: 50%; cursor: pointer;
                    font-size: 0.875rem; display: flex; align-items: center; justify-content: center;
                    transition: all 0.15s;
                }
                .rdr-close:hover { background: rgba(99, 102, 241, 0.12); color: #4f46e5; }

                /* Step indicator */
                .rdr-steps {
                    display: flex; gap: 0; padding: 1rem 1.75rem 0;
                }
                .rdr-step {
                    display: flex; align-items: center; gap: 0.5rem;
                    flex: 1; padding-bottom: 0.75rem;
                    border-bottom: 2px solid rgba(99, 102, 241, 0.1);
                    color: #B4B4C4; font-size: 0.8125rem;
                    transition: all 0.2s;
                }
                .rdr-step.active { color: #4f46e5; border-bottom-color: #4f46e5; }
                .rdr-step.done { color: #16a34a; border-bottom-color: #16a34a; }
                .rdr-step-num {
                    width: 22px; height: 22px; border-radius: 50%;
                    border: 1.5px solid currentColor;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 0.7rem; font-weight: 700; flex-shrink: 0;
                }
                .rdr-step.active .rdr-step-num { background: #4f46e5; color: #fff; border-color: #4f46e5; }
                .rdr-step.done .rdr-step-num { background: #16a34a; color: #fff; border-color: #16a34a; }
                .rdr-step-label { font-weight: 600; }

                /* Body */
                .rdr-body { padding: 1.5rem 1.75rem; }
                .rdr-intro { color: #8C8CA1; font-size: 0.875rem; margin: 0 0 1.25rem; line-height: 1.6; }

                /* Field grid */
                .rdr-field-grid {
                    display: grid; grid-template-columns: 1fr 1fr;
                    gap: 0.5rem; margin-bottom: 1.5rem;
                }
                .rdr-field-btn {
                    background: rgba(255, 255, 255, 0.6);
                    border: 1.5px solid rgba(99, 102, 241, 0.1);
                    border-radius: 12px; padding: 0.625rem 0.875rem;
                    color: #4A4A68; font-size: 0.8125rem; font-weight: 600;
                    cursor: pointer; text-align: left;
                    display: flex; justify-content: space-between; align-items: center;
                    transition: all 0.15s;
                }
                .rdr-field-btn:hover { background: rgba(255,255,255,0.9); border-color: rgba(99,102,241,0.3); color: #1A1A2E; box-shadow: 0 2px 8px rgba(99,102,241,0.08); }
                .rdr-field-btn.selected { background: rgba(79, 70, 229, 0.06); border-color: #4f46e5; color: #4f46e5; }
                .rdr-field-check { font-size: 0.875rem; color: #4f46e5; }

                /* Form elements */
                .rdr-selected-badge {
                    display: flex; align-items: center; gap: 0.625rem;
                    background: rgba(79, 70, 229, 0.06); border: 1px solid rgba(79, 70, 229, 0.15);
                    border-radius: 10px; padding: 0.625rem 0.875rem;
                    margin-bottom: 1.25rem; font-size: 0.8125rem;
                }
                .rdr-badge-label { color: #8C8CA1; }
                .rdr-badge-value { color: #4f46e5; font-weight: 700; flex: 1; }
                .rdr-change { background: none; border: none; color: #4f46e5; cursor: pointer; font-size: 0.75rem; text-decoration: underline; padding: 0; opacity: 0.75; }
                .rdr-change:hover { opacity: 1; }

                /* Current value context chip */
                .rdr-current-value {
                    display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;
                    background: rgba(245, 158, 11, 0.06); border: 1px solid rgba(245, 158, 11, 0.2);
                    border-radius: 10px; padding: 0.5rem 0.875rem;
                    margin-bottom: 1rem; font-size: 0.8125rem;
                }
                .rdr-cv-label { color: #8C8CA1; white-space: nowrap; }
                .rdr-cv-val {
                    color: #b45309; font-weight: 700;
                    background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2);
                    border-radius: 6px; padding: 2px 8px;
                }

                .rdr-label {
                    display: block; font-size: 0.8125rem; font-weight: 700;
                    color: #1A1A2E; margin-bottom: 0.375rem; margin-top: 1rem;
                }
                .rdr-label:first-of-type { margin-top: 0; }
                .rdr-required { color: #dc2626; margin-left: 3px; }
                .rdr-optional { color: #B4B4C4; font-weight: 400; font-size: 0.75rem; }

                .rdr-input, .rdr-textarea {
                    width: 100%; padding: 0.625rem 0.875rem;
                    background: rgba(255, 255, 255, 0.7);
                    border: 1.5px solid rgba(99, 102, 241, 0.12);
                    border-radius: 10px; color: #1A1A2E; font-size: 0.875rem;
                    outline: none; resize: vertical;
                    transition: border-color 0.2s, box-shadow 0.2s;
                    font-family: inherit;
                    box-sizing: border-box;
                }
                .rdr-input:focus, .rdr-textarea:focus {
                    border-color: #4f46e5;
                    background: rgba(255, 255, 255, 0.9);
                    box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
                }
                .rdr-input::placeholder, .rdr-textarea::placeholder { color: #B4B4C4; }

                .rdr-char-count { font-size: 0.7rem; color: #B4B4C4; text-align: right; margin: 0.25rem 0 0; }
                .rdr-hint { font-size: 0.76rem; color: #8C8CA1; margin: 0.375rem 0 0; line-height: 1.5; }

                /* Buttons */
                .rdr-footer {
                    display: flex; justify-content: flex-end; gap: 0.75rem;
                    margin-top: 1.5rem;
                }
                .rdr-btn-cancel {
                    background: rgba(0,0,0,0.04); border: 1.5px solid rgba(0,0,0,0.08);
                    color: #8C8CA1; padding: 0.625rem 1.25rem; border-radius: 10px;
                    font-size: 0.875rem; font-weight: 600; cursor: pointer; transition: all 0.15s;
                }
                .rdr-btn-cancel:hover { background: rgba(0,0,0,0.08); color: #4A4A68; }
                .rdr-btn-next {
                    background: linear-gradient(135deg, #4f46e5, #6366f1);
                    border: none; color: #fff; padding: 0.625rem 1.5rem;
                    border-radius: 10px; font-size: 0.875rem; font-weight: 700;
                    cursor: pointer; transition: all 0.15s;
                    box-shadow: 0 4px 14px rgba(79, 70, 229, 0.3);
                }
                .rdr-btn-next:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); box-shadow: 0 6px 18px rgba(79,70,229,0.4); }
                .rdr-btn-next:disabled { opacity: 0.45; cursor: not-allowed; box-shadow: none; }
                .rdr-btn-submit {
                    background: linear-gradient(135deg, #dc2626, #b91c1c);
                    border: none; color: #fff; padding: 0.625rem 1.5rem;
                    border-radius: 10px; font-size: 0.875rem; font-weight: 700;
                    cursor: pointer; transition: all 0.15s; min-width: 140px;
                    display: flex; align-items: center; justify-content: center;
                    box-shadow: 0 4px 14px rgba(220, 38, 38, 0.25);
                }
                .rdr-btn-submit:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); }
                .rdr-btn-submit:disabled { opacity: 0.5; cursor: not-allowed; box-shadow: none; }
                .rdr-spinner-row { display: flex; align-items: center; gap: 0.5rem; }
                .rdr-spinner {
                    width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3);
                    border-top-color: #fff; border-radius: 50%;
                    animation: spinRdr 0.7s linear infinite;
                }
                @keyframes spinRdr { to { transform: rotate(360deg) } }

                .rdr-error {
                    color: #b91c1c; font-size: 0.8125rem; margin-top: 0.75rem;
                    background: rgba(220, 38, 38, 0.06); border: 1px solid rgba(220, 38, 38, 0.15);
                    border-radius: 8px; padding: 0.5rem 0.75rem;
                }
                .rdr-disclaimer {
                    font-size: 0.7rem; color: #B4B4C4; margin-top: 1rem; text-align: center; line-height: 1.5;
                }

                /* Success state */
                .rdr-success-body { text-align: center; padding: 2.5rem 1.75rem; }
                .rdr-success-icon { font-size: 3.5rem; margin-bottom: 1rem; }
                .rdr-success-title { font-size: 1.375rem; font-weight: 800; color: #1A1A2E; margin: 0 0 0.75rem; }
                .rdr-success-msg { color: #8C8CA1; font-size: 0.9rem; line-height: 1.6; margin: 0 0 1.5rem; }
                .rdr-success-meta {
                    background: rgba(255,255,255,0.6); border: 1px solid rgba(99,102,241,0.1);
                    border-radius: 14px; padding: 1rem 1.25rem; margin-bottom: 1.5rem; text-align: left;
                }
                .rdr-meta-row { display: flex; justify-content: space-between; align-items: center; padding: 0.375rem 0; }
                .rdr-meta-label { font-size: 0.8rem; color: #8C8CA1; }
                .rdr-meta-val { font-size: 0.875rem; color: #1A1A2E; font-weight: 700; }
                code.rdr-meta-val { font-family: monospace; background: rgba(79,70,229,0.08); color: #4f46e5; padding: 2px 8px; border-radius: 5px; }
                .rdr-boost { color: #16a34a; }
                .rdr-success-note { font-size: 0.8rem; color: #8C8CA1; margin-bottom: 2rem; line-height: 1.6; }
                .rdr-btn-done {
                    background: linear-gradient(135deg, #4f46e5, #6366f1);
                    border: none; color: #fff; padding: 0.75rem 2.5rem;
                    border-radius: 12px; font-size: 0.9375rem; font-weight: 700;
                    cursor: pointer; transition: all 0.15s;
                    box-shadow: 0 6px 20px rgba(79,70,229,0.3);
                }
                .rdr-btn-done:hover { filter: brightness(1.08); transform: translateY(-1px); }

                @media (max-width: 480px) {
                    .rdr-field-grid { grid-template-columns: 1fr; }
                    .rdr-modal { border-radius: 18px; max-height: 95vh; }
                }
            `}</style>
        </div>
    );
}
