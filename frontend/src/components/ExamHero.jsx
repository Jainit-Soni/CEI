"use client";

import { useEffect, useState, useMemo } from 'react';
import Container from './Container';
import Button from './Button';
import './ExamHero.css';

import { RevealOnScroll } from '@/lib/useIntersectionObserver';

export default function ExamHero({ exam }) {
    const [timeLeft, setTimeLeft] = useState(null);

    const activeDateInfo = useMemo(() => {
        if (!exam?.dates) return null;
        
        const examDateStr = exam.dates.examWindow || "";
        const regDateStr = exam.dates.registration || "";
        
        const parseDate = (str) => {
            if (!str) return null;
            const fullMatch = str.match(/([A-Za-z]+ \d{1,2}, \d{4})/);
            if (fullMatch) return new Date(fullMatch[1]);
            
            const monthYearMatch = str.match(/([A-Za-z]+ \d{4})/);
            if (monthYearMatch) {
                const d = new Date(monthYearMatch[1]);
                d.setDate(1);
                return d;
            }
            return null;
        };

        const examDate = parseDate(examDateStr);
        const regDate = parseDate(regDateStr);
        const now = new Date();

        if (examDate && examDate > now) {
            return { date: examDate, label: "EXAM COUNTDOWN" };
        }
        if (regDate && regDate > now) {
            return { date: regDate, label: "REGISTRATION CLOSES IN" };
        }
        return null;
    }, [exam]);

    useEffect(() => {
        if (!activeDateInfo) return;

        const timer = setInterval(() => {
            const now = new Date();
            const diff = activeDateInfo.date - now;

            if (diff <= 0) {
                setTimeLeft(null);
                clearInterval(timer);
            } else {
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
                const mins = Math.floor((diff / (1000 * 60)) % 60);
                const secs = Math.floor((diff / 1000) % 60);
                setTimeLeft({ days, hours, mins, secs });
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [activeDateInfo]);

    const statusLabel = exam.status?.label || "Portal Active";
    const statusClass = exam.status?.class || "active";

    return (
        <div className="mission-hero">
            <Container>
                <div className="mission-interface academic-hub">
                    {/* Background HUD elements */}
                    <div className="hud-grid-overlay"></div>
                    <div className="hud-scanline"></div>
                    <div className="data-scanner-line"></div>
                    
                    {/* Portal Header */}
                    <div className="mission-terminal-header">
                        <div className="terminal-left">
                            <span className="terminal-mode">ACADEMIC_INTELLIGENCE: EVALUATED</span>
                            <span className="terminal-id">REF: {exam.shortName || "EXM"}_v2026</span>
                        </div>
                        <div className="terminal-right">
                            <span className="terminal-stats">DATA INTEGRITY: HIGH | SESSION: SECURE</span>
                            <div className="terminal-battery">
                                <div className="battery-level"></div>
                            </div>
                        </div>
                    </div>

                    <div className="hud-corner-tl animate-hud-1"></div>
                    <div className="hud-corner-tr animate-hud-2"></div>
                    <div className="hud-corner-bl animate-hud-3"></div>
                    <div className="hud-corner-br animate-hud-4"></div>

                    <div className="mission-content">
                        {/* Hero Header Area */}
                        <div className="hero-identity-sector">
                            <div className="status-badge-container">
                                <span className={`status-node ${statusClass}`}>
                                    <span className="node-pulse"></span>
                                    {statusLabel}
                                </span>
                            </div>
                            <h1 className="mission-title academic-title" data-text={exam.name}>
                                {exam.name}
                            </h1>
                            <div className="mission-subtitle">
                                <span className="label">OFFICIAL AUTHORITY:</span> {exam.conductingBody || "N/A"}
                                <span className="sep">|</span>
                                <span className="label">MODE:</span> {exam.stats?.mode || "COMPUTER BASED TEST"}
                            </div>
                            
                            <div className="mission-actions">
                                <Button href={exam.officialUrl || "#"} variant="accent" className="mission-btn-primary primary-glow">
                                    VISIT OFFICIAL WEBSITE ↗
                                </Button>
                                {timeLeft && (
                                    <div className="mission-countdown-container">
                                        <span className="countdown-label">{activeDateInfo.label}:</span>
                                        <div className="countdown-timer mono">
                                            <div className="t-unit"><span>{timeLeft.days}</span><label>D</label></div>
                                            <div className="t-sep">:</div>
                                            <div className="t-unit"><span>{timeLeft.hours}</span><label>H</label></div>
                                            <div className="t-sep">:</div>
                                            <div className="t-unit"><span>{timeLeft.mins}</span><label>M</label></div>
                                            <div className="t-sep">:</div>
                                            <div className="t-unit"><span>{timeLeft.secs}</span><label>S</label></div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Analysis Grid */}
                        <div className="academic-analysis-grid">
                            <div className="intel-node">
                                <div className="node-visual">
                                    <svg viewBox="0 0 100 100" className="node-svg">
                                        <circle cx="50" cy="50" r="45" className="node-circle-bg" />
                                        <circle cx="50" cy="50" r="45" className="node-circle-progress" style={{ strokeDashoffset: '60' }} />
                                    </svg>
                                    <span className="node-icon">👥</span>
                                </div>
                                <div className="node-data">
                                    <span className="node-label">CANDIDATES</span>
                                    <span className="node-value mono">{exam.stats?.applicants || "10 Lakh+"}</span>
                                </div>
                            </div>

                            <div className="intel-node">
                                <div className="node-visual">
                                    <svg viewBox="0 0 100 100" className="node-svg">
                                        <circle cx="50" cy="50" r="45" className="node-circle-bg" />
                                        <circle cx="50" cy="50" r="45" className="node-circle-progress" style={{ strokeDashoffset: '120' }} />
                                    </svg>
                                    <span className="node-icon">⏱️</span>
                                </div>
                                <div className="node-data">
                                    <span className="node-label">DURATION</span>
                                    <span className="node-value mono">{exam.stats?.duration || "180 Min"}</span>
                                </div>
                            </div>

                            <div className="intel-node">
                                <div className="node-visual">
                                    <svg viewBox="0 0 100 100" className="node-svg">
                                        <circle cx="50" cy="50" r="45" className="node-circle-bg" />
                                        <circle cx="50" cy="50" r="45" className="node-circle-progress" style={{ strokeDashoffset: '80' }} />
                                    </svg>
                                    <span className="node-icon">🎫</span>
                                </div>
                                <div className="node-data">
                                    <span className="node-label">EXAM FEE</span>
                                    <span className="node-value mono">
                                        {exam.stats?.fee ? exam.stats.fee.split('(')[0].trim() : "₹1,000"}
                                    </span>
                                </div>
                            </div>

                            <div className="intel-node highlighter">
                                <div className="node-visual">
                                    <svg viewBox="0 0 100 100" className="node-svg">
                                        <circle cx="50" cy="50" r="45" className="node-circle-bg" />
                                        <circle cx="50" cy="50" r="45" className="node-circle-progress" style={{ strokeDashoffset: '180' }} />
                                    </svg>
                                    <span className="node-icon">📊</span>
                                </div>
                                <div className="node-data">
                                    <span className="node-label">TOTAL MARKS</span>
                                    <span className="node-value mono">
                                        {exam.totalMarks || "N/A"}
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
