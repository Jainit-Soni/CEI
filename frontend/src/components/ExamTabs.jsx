"use client";

import React, { useState } from 'react';
import GlassPanel from './GlassPanel';
import './ExamTabs.css';

export default function ExamTabs({ exam }) {
    const [activeTab, setActiveTab] = useState('overview');

    if (!exam) return null;

    const tabs = [
        { id: 'overview', label: 'Briefing' },
        { id: 'timeline', label: 'Timeline' },
        { id: 'syllabus', label: 'Intel (Syllabus)' },
        { id: 'prep', label: 'Training' },
        { id: 'colleges', label: 'Targets (Colleges)' },
    ];

    return (
        <div className="mission-tabs-container">
            {/* Navigation Tabs */}
            <div className="mission-tabs-nav">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        className={`mission-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="mission-tabs-content">

                {/* 1. OVERVIEW TAB */}
                {activeTab === 'overview' && (
                    <div className="tab-pane fade-in">
                        <div className="mission-grid-2">
                            <div className="mission-card">
                                <h3 className="card-header">Mission Profile</h3>
                                <p className="mission-text">
                                    {exam.name} ({exam.shortName}) is a {exam.level || "national"}-level
                                    entrance exam conducted by {exam.conductingBody}.
                                    It is the gateway for admission into {exam.courses?.join(", ")} courses.
                                </p>
                                <div className="tags-row">
                                    {(exam.courses || []).map(c => <span key={c} className="mission-tag">{c}</span>)}
                                </div>
                            </div>

                            <div className="mission-card">
                                <h3 className="card-header">Target Parameters</h3>
                                {exam.safeScore ? (
                                    <div className="safe-score-box">
                                        <div className="sc-item">
                                            <span className="sc-label">Min Qualifying</span>
                                            <span className="sc-val">{exam.safeScore.min}</span>
                                        </div>
                                        <div className="sc-divider"></div>
                                        <div className="sc-item highlight">
                                            <span className="sc-label">Safe Target</span>
                                            <span className="sc-val">{exam.safeScore.target}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="no-data">Intel pending.</p>
                                )}
                            </div>

                            <div className="mission-card wide">
                                <h3 className="card-header">Marking Protocol</h3>
                                {exam.markingScheme ? (
                                    <div className="marking-grid">
                                        <div className="mark-item positive">
                                            <span className="mark-val">+{exam.markingScheme.correct}</span>
                                            <span className="mark-desc">Correct</span>
                                        </div>
                                        <div className="mark-item negative">
                                            <span className="mark-val">-{exam.markingScheme.incorrect}</span>
                                            <span className="mark-desc">Incorrect</span>
                                        </div>
                                        <div className="mark-item neutral">
                                            <span className="mark-val">0</span>
                                            <span className="mark-desc">Unattempted</span>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="no-data">Standard marking scheme applies.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. TIMELINE TAB */}
                {activeTab === 'timeline' && (
                    <div className="tab-pane fade-in">
                        <div className="mission-card">
                            <h3 className="card-header">Operation Schedule</h3>
                            {exam.dates ? (
                                <div className="timeline-stepper">
                                    <div className="step-item">
                                        <div className="step-marker"></div>
                                        <div className="step-content">
                                            <span className="step-date mono">{exam.dates.registration}</span>
                                            <span className="step-title">Registration Phase</span>
                                        </div>
                                    </div>
                                    <div className="step-item active">
                                        <div className="step-marker pulse"></div>
                                        <div className="step-content">
                                            <span className="step-date mono">{exam.dates.examWindow}</span>
                                            <span className="step-title">Execution (Exam) Date</span>
                                        </div>
                                    </div>
                                    <div className="step-item">
                                        <div className="step-marker"></div>
                                        <div className="step-content">
                                            <span className="step-date mono">{exam.dates.result}</span>
                                            <span className="step-title">Debrief (Result)</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p>Dates classified.</p>
                            )}
                        </div>
                    </div>
                )}

                {/* 3. SYLLABUS TAB */}
                {activeTab === 'syllabus' && (
                    <div className="tab-pane fade-in">
                        <div className="mission-grid-2">
                            <div className="mission-card">
                                <h3 className="card-header">Execution Pattern</h3>
                                <ul className="custom-list">
                                    {(exam.pattern || []).map((p, i) => <li key={i}>{p}</li>)}
                                </ul>
                            </div>
                            <div className="mission-card">
                                <h3 className="card-header">Required Intel (Syllabus)</h3>
                                <div className="syllabus-tags">
                                    {(exam.syllabus || ["Physics", "Chemistry", "Maths/Bio", "Aptitude"]).map(s => (
                                        <span key={s} className="mission-chip">{s}</span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* 4. PREP TAB */}
                {activeTab === 'prep' && (
                    <div className="tab-pane fade-in">
                        <div className="mission-grid-2">
                            <div className="mission-card">
                                <h3 className="card-header">Training Protocols</h3>
                                <ul className="check-list">
                                    {(exam.prepResources || [{ title: "Solve Previous Year Papers" }, { title: "Focus on NCERT" }]).map((r, i) => (
                                        <li key={i}><strong>{r.type ? r.type + ": " : ""}</strong>{r.title}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                )}

                {/* 5. COLLEGES TAB */}
                {activeTab === 'colleges' && (
                    <div className="tab-pane fade-in">
                        <div className="mission-card">
                            <h3 className="card-header">Target Institutes</h3>
                            <div className="colleges-grid-mini">
                                {(exam.collegesAccepting || []).map(c => (
                                    <div key={c} className="mini-college-card">{c.replace(/-/g, ' ').toUpperCase()}</div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
