"use client";

import React from 'react';
import Container from './Container';
import Button from './Button';
import './ExamHero.css';

import ScrollReveal from './animations/ScrollReveal';

export default function ExamHero({ exam }) {
    if (!exam) return null;

    return (
        <div className="mission-hero">
            <Container>
                <div className="mission-interface">
                    {/* Background Grid/HUD elements */}
                    <div className="hud-grid-overlay"></div>
                    <div className="hud-corner-tl"></div>
                    <div className="hud-corner-tr"></div>
                    <div className="hud-corner-bl"></div>
                    <div className="hud-corner-br"></div>

                    <div className="mission-content">
                        {/* LEFT: Identity */}
                        <div className="mission-identity">
                            <div className="mission-badge">
                                <span className="status-dot pulse"></span>
                                {exam.shortName || "EXAM DETAILS"}
                            </div>
                            <ScrollReveal as="h1" containerClassName="mission-title" baseRotation={1} blurStrength={5}>
                                {exam.name}
                            </ScrollReveal>
                            <ScrollReveal as="div" containerClassName="mission-subtitle" baseOpacity={0.4} blurStrength={2}>
                                <span className="label">CONDUCTED BY:</span> {exam.conductingBody}
                                <span className="sep">|</span>
                                <span className="label">MODE:</span> {exam.stats?.mode || "OFFLINE/ONLINE"}
                            </ScrollReveal>

                            <div className="mission-actions">
                                <Button href={exam.officialUrl || "#"} variant="accent" className="mission-btn-primary">
                                    APPLY NOW ↗
                                </Button>
                            </div>
                        </div>

                        {/* RIGHT: Intel Grid */}
                        <div className="mission-intel">
                            <div className="intel-row">
                                {(exam.stats?.applicants && exam.stats.applicants !== "N/A") && (
                                    <div className="intel-box">
                                        <span className="intel-label">APPLICANTS</span>
                                        <span className="intel-value mono">{exam.stats.applicants}</span>
                                    </div>
                                )}
                                {(exam.stats?.fee && exam.stats.fee !== "N/A") && (
                                    <div className="intel-box">
                                        <span className="intel-label">FEE INTEL</span>
                                        <span className="intel-value mono">{exam.stats.fee}</span>
                                    </div>
                                )}
                            </div>
                            <div className="intel-row">
                                {(exam.stats?.duration && exam.stats.duration !== "N/A") && (
                                    <div className="intel-box">
                                        <span className="intel-label">TIME LIMIT</span>
                                        <span className="intel-value mono">{exam.stats.duration}</span>
                                    </div>
                                )}
                                {exam.totalMarks && (
                                    <div className="intel-box highlight">
                                        <span className="intel-label">MAX SCORE</span>
                                        <span className="intel-value mono">
                                            {typeof exam.totalMarks === 'string' ? exam.totalMarks.split(' ')[0] : exam.totalMarks}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div className="intel-row">
                                <div className="intel-box wide-intel">
                                    <span className="intel-label">ACCREDITED ARENAS</span>
                                    <span className="intel-value mono">
                                        {exam.acceptedCount || (exam.acceptedColleges || []).length || "--"} Affiliated
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </Container>
        </div>
    );
}
