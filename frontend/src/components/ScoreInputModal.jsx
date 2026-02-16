"use client";

import { useState } from "react";
import { X, Trophy, Save } from "lucide-react";
import "./ScoreInputModal.css";

export default function ScoreInputModal({ isOpen, onClose, currentScores, onSave }) {
    const [scores, setScores] = useState(currentScores || {});
    const [selectedExams, setSelectedExams] = useState(() => {
        // Pre-select exams that already have scores
        const initial = new Set();
        if (currentScores) {
            Object.keys(currentScores).forEach(k => {
                if (currentScores[k] > 0) initial.add(k);
            });
        }
        return initial;
    });

    if (!isOpen) return null;

    const availableExams = [
        { id: "CAT", name: "CAT", desc: "IIMs & top B-schools" },
        { id: "CMAT", name: "CMAT", desc: "AICTE approved colleges" },
        { id: "XAT", name: "XAT", desc: "XLRI & associate institutes" },
        { id: "MAT", name: "MAT", desc: "AIMA affiliated colleges" },
        { id: "GMAT", name: "GMAT", desc: "Global MBA programs" },
        { id: "NMAT", name: "NMAT", desc: "NMIMS & partner colleges" },
    ];

    const toggleExam = (examId) => {
        setSelectedExams(prev => {
            const next = new Set(prev);
            if (next.has(examId)) {
                next.delete(examId);
                setScores(s => { const copy = { ...s }; delete copy[examId]; return copy; });
            } else {
                next.add(examId);
            }
            return next;
        });
    };

    const handleChange = (exam, value) => {
        let val = parseFloat(value);
        if (isNaN(val)) val = "";
        if (val > 100) val = 100;
        if (val < 0) val = 0;
        setScores(prev => ({ ...prev, [exam]: val }));
    };

    const handleSave = () => {
        onSave(scores);
        onClose();
    };

    return (
        <div className="score-modal-overlay" onClick={onClose}>
            <div className="score-modal" onClick={(e) => e.stopPropagation()}>

                {/* Header */}
                <div className="score-modal-header">
                    <div className="score-modal-icon">
                        <Trophy size={22} />
                    </div>
                    <div>
                        <h3 className="score-modal-title">Your Exam Scores</h3>
                        <p className="score-modal-desc">Select exams you took, then enter percentiles</p>
                    </div>
                    <button className="score-modal-close" onClick={onClose}>
                        <X size={18} />
                    </button>
                </div>

                {/* Step 1: Exam Selection */}
                <div className="score-exam-grid">
                    {availableExams.map(exam => (
                        <button
                            key={exam.id}
                            className={`score-exam-chip ${selectedExams.has(exam.id) ? "selected" : ""}`}
                            onClick={() => toggleExam(exam.id)}
                        >
                            <span className="chip-name">{exam.name}</span>
                            <span className="chip-desc">{exam.desc}</span>
                        </button>
                    ))}
                </div>

                {/* Step 2: Score Inputs (only selected exams) */}
                {selectedExams.size > 0 && (
                    <div className="score-inputs">
                        {[...selectedExams].map(examId => (
                            <div key={examId} className="score-input-row">
                                <label className="score-input-label">{examId}</label>
                                <div className="score-input-wrapper">
                                    <input
                                        type="number"
                                        placeholder="Percentile"
                                        className="score-input-field"
                                        value={scores[examId] || ""}
                                        onChange={(e) => handleChange(examId, e.target.value)}
                                        max="100"
                                        min="0"
                                        step="0.1"
                                    />
                                    <span className="score-input-suffix">%ile</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Actions */}
                <div className="score-modal-actions">
                    <button className="score-btn-cancel" onClick={onClose}>Cancel</button>
                    <button className="score-btn-save" onClick={handleSave}>
                        <Save size={16} />
                        Save Scores
                    </button>
                </div>

                <p className="score-modal-note">
                    *Scores are stored locally and used to predict SAFE, TARGET, or DREAM colleges.
                </p>
            </div>
        </div>
    );
}
