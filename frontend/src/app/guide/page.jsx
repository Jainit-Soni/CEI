"use client";

import Container from "@/components/Container";
import Link from "next/link";
import {
    BookOpen,
    Map as MapIcon,
    Target,
    TrendingUp,
    Calendar,
    AlertTriangle,
    ArrowRight,
    ExternalLink
} from "lucide-react";

export default function GuidePage() {
    const steps = [
        {
            icon: <MapIcon size={24} color="#6366f1" />,
            title: "Discovery & Exploration",
            desc: "Start with our Interactive Map to find colleges geographically. Explore states, districts, and local opportunities you might have missed.",
            link: "/map",
            linkText: "Open Map"
        },
        {
            icon: <Target size={24} color="#10b981" />,
            title: "Strategic Selection",
            desc: "Use the College Catalog to filter by fees, courses, and ranking tiers. Look for 'Tier 1' benchmarks but cross-verify with official reports.",
            link: "/colleges",
            linkText: "Browse Colleges"
        },
        {
            icon: <TrendingUp size={24} color="#f59e0b" />,
            title: "ROI Simulation",
            desc: "Use our ROI Calculator to simulate your financial future. Calculate the value of your education based on average placement packages.",
            link: "/roi-calculator",
            linkText: "Try ROI Tool"
        },
        {
            icon: <Calendar size={24} color="#ec4899" />,
            title: "Exam Intelligence",
            desc: "Track critical entrance exam dates and past cutoff patterns. Never miss a deadline by utilizing our centralized exam tracking.",
            link: "/exams",
            linkText: "Track Exams"
        }
    ];

    return (
        <div className="guide-page" style={{ paddingTop: '120px', paddingBottom: '100px', background: 'linear-gradient(180deg, #f8fafc 0%, #ffffff 100%)' }}>
            <Container>
                {/* MANDATORY LEGAL BANNER */}
                <div style={{
                    background: 'rgba(255, 255, 255, 0.8)',
                    border: '1px solid #e2e8f0',
                    borderRadius: '20px',
                    padding: '20px',
                    marginBottom: '60px',
                    backdropFilter: 'blur(10px)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px'
                }}>
                    <div style={{ background: '#fef3c7', padding: '10px', borderRadius: '12px' }}>
                        <AlertTriangle color="#d97706" size={20} />
                    </div>
                    <p style={{ fontSize: '0.85rem', color: '#92400e', margin: 0, fontWeight: 500 }}>
                        <strong>ADVISORY:</strong> This guide provides a workflow for using CEI tools. All dates, cutoffs, and data points must be verified against
                        <strong> Official Exam Notifications</strong> and University Gazettes. We provide intelligence for reference, not for finality.
                    </p>
                </div>

                <div className="guide-header" style={{ textAlign: 'center', marginBottom: '80px', maxWidth: '800px', margin: '0 auto 80px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#eef2ff', color: '#4f46e5', padding: '8px 16px', borderRadius: '99px', fontSize: '0.85rem', fontWeight: 700, marginBottom: '24px' }}>
                        <BookOpen size={16} />
                        STUDENT SUCCESS BLUEPRINT
                    </div>
                    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '3.5rem', fontWeight: 800, color: '#1e3a8a', marginBottom: '20px', lineHeight: 1.1 }}>
                        How to Navigate Your <span style={{ color: '#4f46e5' }}>Admission Journey</span>
                    </h1>
                    <p style={{ fontSize: '1.25rem', color: '#64748b', lineHeight: 1.6 }}>
                        A systematic approach to discovering, strategizing, and evaluating your future college using CEI Intelligence.
                    </p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', marginBottom: '80px' }}>
                    {steps.map((step, i) => (
                        <div key={i} style={{
                            background: 'white',
                            padding: '32px',
                            borderRadius: '24px',
                            border: '1px solid #e2e8f0',
                            transition: 'all 0.3s ease',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '16px'
                        }}>
                            <div style={{
                                width: '48px',
                                height: '48px',
                                borderRadius: '14px',
                                background: '#f8fafc',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                {step.icon}
                            </div>
                            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#0f172a' }}>{step.title}</h2>
                            <p style={{ fontSize: '0.95rem', color: '#64748b', lineHeight: 1.6, flexGrow: 1 }}>{step.desc}</p>
                            <Link href={step.link} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                color: '#4f46e5',
                                fontWeight: 600,
                                fontSize: '0.9rem',
                                textDecoration: 'none'
                            }}>
                                {step.linkText} <ArrowRight size={16} />
                            </Link>
                        </div>
                    ))}
                </div>

                {/* THE FINAL CHECKLIST */}
                <div style={{
                    background: '#1e293b',
                    borderRadius: '32px',
                    padding: '48px',
                    color: 'white',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div style={{ position: 'absolute', top: '-100px', right: '-100px', width: '300px', height: '300px', background: 'rgba(79, 70, 229, 0.2)', filter: 'blur(80px)', borderRadius: '50%' }} />

                    <div style={{ maxWidth: '600px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 800, marginBottom: '24px' }}>The "Safe-Admission" Checklist</h2>
                        <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {[
                                "Cross-verify cutoff ranks with official counseling bulletins (MCC/JOSAA).",
                                "Check for the most recent Fee Revision notices on college websites.",
                                "Validate accreditation status (NAAC/NIRF) through government portals.",
                                "Calculate total cost of living vs placements using our ROI Tool.",
                                "Finalize your Strategic Priority List and save it to your cloud dashboard."
                            ].map((text, i) => (
                                <li key={i} style={{ display: 'flex', gap: '16px', fontSize: '1.05rem', opacity: 0.9 }}>
                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 800 }}>{i + 1}</div>
                                    {text}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div style={{ marginTop: '40px', paddingTop: '32px', borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px' }}>
                        <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.6 }}>Rely only on official data for final decisions.</p>
                        <Link href="/terms" style={{ color: 'white', fontWeight: 600, textDecoration: 'underline' }}>View Full Terms of Service</Link>
                    </div>
                </div>
            </Container>
        </div>
    );
}
