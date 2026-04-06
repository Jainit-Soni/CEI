"use client";

import { useEffect, useState } from "react";
import { 
    Database, 
    ShieldCheck, 
    BarChart3, 
    Users, 
    GraduationCap, 
    MapPin, 
    Globe, 
    IndianRupee 
} from "lucide-react";
import pulseData from "../data/metadata_pulse.json";
import ScrollReveal from "./animations/ScrollReveal";
import "./TransparencyPulse.css";

const StatCard = ({ icon: Icon, label, value, percentage, delay }) => (
    <div className={`pulse-card fadeIn delay-${delay}`}>
        <div className="pulse-card-header">
            <div className="pulse-icon-wrapper">
                <Icon size={20} />
            </div>
            <div className="pulse-percentage">
                {percentage}% <span className="pulse-cov">COV</span>
            </div>
        </div>
        <div className="pulse-card-body">
            <div className="pulse-value">{value.toLocaleString()}</div>
            <div className="pulse-label">{label}</div>
        </div>
        <div className="pulse-progress-mini">
            <div className="pulse-bar" style={{ width: `${percentage}%` }} />
        </div>
    </div>
);

export default function TransparencyPulse() {
    const [stats, setStats] = useState(null);

    useEffect(() => {
        if (pulseData) {
            setStats(pulseData);
        }
    }, []);

    if (!stats) return null;

    return (
        <section className="transparency-pulse-nexus">
            <div className="pulse-container">
                <div className="pulse-header">
                    <div className="pulse-badge">
                        <Database size={14} />
                        <span>LIVE_DATA_AUDIT</span>
                    </div>
                    <ScrollReveal as="h2" containerClassName="pulse-title" baseRotation={0.5} blurStrength={10}>
                        The Transparency <span className="serif-accent">Pulse</span>.
                    </ScrollReveal>
                    <p className="pulse-subtitle">
                        Real-time audit of India's most comprehensive institutional dataset. 
                        No black boxes. Total accountability.
                    </p>
                </div>

                <div className="pulse-summary-banner">
                    <div className="summary-item">
                        <span className="summary-label">TOTAL UNIVERSITIES & COLLEGES</span>
                        <span className="summary-value neon-text">{stats.overall.totalColleges.toLocaleString()}</span>
                    </div>
                    <div className="summary-separator" />
                    <div className="summary-item">
                        <span className="summary-label">GEO-MAPPED LOCATIONS</span>
                        <span className="summary-value">{stats.overall.gpsMapped.toLocaleString()}</span>
                    </div>
                </div>

                <div className="pulse-grid">
                    <StatCard 
                        icon={GraduationCap} 
                        label="Verified Seat Intake" 
                        value={stats.overall.verifiedSeats} 
                        percentage={stats.percentages.verifiedSeats}
                        delay={1}
                    />
                    <StatCard 
                        icon={BarChart3} 
                        label="Historical Cutoffs" 
                        value={stats.overall.cutoffsTracked} 
                        percentage={stats.percentages.cutoffsTracked}
                        delay={2}
                    />
                    <StatCard 
                        icon={IndianRupee} 
                        label="Fee Structures" 
                        value={stats.overall.feeStructures} 
                        percentage={stats.percentages.feeStructures}
                        delay={3}
                    />
                    <StatCard 
                        icon={ShieldCheck} 
                        label="Placement Statistics" 
                        value={stats.overall.placementData} 
                        percentage={stats.percentages.placementData}
                        delay={4}
                    />
                     <StatCard 
                        icon={Globe} 
                        label="Official Websites" 
                        value={stats.overall.websitesVerified} 
                        percentage={stats.percentages.websitesVerified}
                        delay={5}
                    />
                     <StatCard 
                        icon={Users} 
                        label="Rankings (NIRF/Global)" 
                        value={stats.overall.nirfRanked} 
                        percentage={stats.percentages.nirfRanked}
                        delay={6}
                    />
                </div>

                <div className="pulse-footer">
                    <span className="pulse-timestamp">LAST_AUDIT_STAMP: {new Date(stats.timestamp).toLocaleString()}</span>
                    <div className="pulse-verified-seal">
                        <ShieldCheck size={16} />
                        <span>AISHE & AICTE ALIGNED</span>
                    </div>
                </div>
            </div>
        </section>
    );
}
