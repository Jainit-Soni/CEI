"use client";

import Container from "@/components/Container";
import Link from "next/link";
import { ShieldCheck, Scale, Gavel, Lock, Info, ExternalLink, ChevronRight } from "lucide-react";

export default function TermsAndConditionsPage() {
    const lastUpdated = "February 13, 2026";

    return (
        <div className="legal-page" style={{
            paddingTop: '120px',
            paddingBottom: '100px',
            background: '#f8fafc',
            color: '#334155'
        }}>
            <Container>
                <div className="legal-layout" style={{
                    maxWidth: '900px',
                    margin: '0 auto'
                }}>
                    {/* Header Section */}
                    <div className="legal-header" style={{ marginBottom: '60px', textAlign: 'center' }}>
                        <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '10px',
                            background: '#eff6ff',
                            color: '#2563eb',
                            padding: '8px 20px',
                            borderRadius: '99px',
                            fontSize: '0.9rem',
                            fontWeight: 700,
                            marginBottom: '24px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em'
                        }}>
                            <ShieldCheck size={18} />
                            Universal Legal Framework
                        </div>
                        <h1 style={{
                            fontSize: '3.5rem',
                            fontWeight: 900,
                            color: '#1e3a8a',
                            marginBottom: '16px',
                            letterSpacing: '-0.02em'
                        }}>
                            Terms & <span style={{ color: '#2563eb' }}>Conditions</span>
                        </h1>
                        <p style={{ color: '#64748b', fontSize: '1.1rem', fontWeight: 500 }}>
                            Incorporating Privacy Policy & Usage Guidelines • Last Updated: {lastUpdated}
                        </p>
                    </div>

                    {/* Quick Access Grid */}
                    <div className="legal-nav-grid" style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '16px',
                        marginBottom: '60px'
                    }}>
                        {[
                            { icon: Info, label: "Usage Terms", id: "usage" },
                            { icon: Lock, label: "Privacy & Data", id: "privacy" },
                            { icon: Scale, label: "Liability Shield", id: "liability" },
                            { icon: Gavel, label: "Jurisdiction", id: "legal" }
                        ].map((item, i) => (
                            <a key={i} href={`#${item.id}`} style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '16px',
                                background: 'white',
                                borderRadius: '12px',
                                border: '1px solid #e2e8f0',
                                textDecoration: 'none',
                                color: '#1e3a8a',
                                fontWeight: 700,
                                transition: 'all 0.2s'
                            }} className="legal-nav-item">
                                <item.icon size={20} color="#2563eb" />
                                {item.label}
                            </a>
                        ))}
                    </div>

                    {/* Main Content */}
                    <div className="legal-body" style={{
                        background: 'white',
                        padding: '60px',
                        borderRadius: '32px',
                        border: '1px solid #e2e8f0',
                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                        lineHeight: 1.8,
                        fontSize: '1.05rem'
                    }}>

                        {/* 1. INTRODUCTION */}
                        <section id="introduction" style={{ marginBottom: '60px' }}>
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <ChevronRight color="#2563eb" /> 1. Overview and Acceptance
                            </h2>
                            <p>
                                Welcome to CEI (the "Platform"). By accessing or using our websites, services, applications, and tools, you acknowledge that you have read, understood, and agreed to be bound by the terms and conditions set forth in this document (the "Agreement").
                            </p>
                            <p style={{ marginTop: '16px', background: '#fff7ed', padding: '20px', borderRadius: '12px', borderLeft: '4px solid #f97316', fontWeight: 600, color: '#9a3412' }}>
                                MANDATORY NOTICE: This is a legally binding agreement. If you do not agree to any part of these terms, you are NOT authorized to use the Platform and must cease all usage immediately.
                            </p>
                        </section>

                        {/* 2. NATURE OF SERVICE */}
                        <section id="usage" style={{ marginBottom: '60px' }}>
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <ChevronRight color="#2563eb" /> 2. "Reference Only" Nature of Service
                            </h2>
                            <p>
                                CEI operates as an automated data aggregator and information intermediary. We collect, synthesize, and present educational data—including but not limited to college rankings, fee structures, cutoffs, and placement statistics—for **general reference purposes only**.
                            </p>
                            <ul style={{ paddingLeft: '20px', marginTop: '16px' }}>
                                <li style={{ marginBottom: '12px' }}><strong>Intermediary Status:</strong> Pursuant to Section 79 of the Information Technology Act (India), 2000, CEI claims safe harbor protection as an intermediary providing access to third-party information.</li>
                                <li style={{ marginBottom: '12px' }}><strong>No Representation:</strong> CEI is not an official representative, affiliate, or agent of any listed institution, university, or government board.</li>
                                <li style={{ marginBottom: '12px' }}><strong>Verification Mandate:</strong> Users are expressly mandated to cross-verify all Platform data with official government gazettes, university websites, or counseling portals (e.g., MCC, JOSAA, AICTE) before making any academic or financial commitments.</li>
                            </ul>
                        </section>

                        {/* 3. PRIVACY & DATA POLICY */}
                        <section id="privacy" style={{ marginBottom: '60px' }}>
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <ChevronRight color="#2563eb" /> 3. Comprehensive Privacy Policy
                            </h2>
                            <p>
                                Your privacy is integral to our operation. This section outlines our data practices in compliance with global standards and the Digital Personal Data Protection (DPDP) norms.
                            </p>
                            <div style={{ marginTop: '20px', padding: '24px', background: '#f8fafc', borderRadius: '16px' }}>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '12px' }}>A. Data We Collect</h3>
                                <p style={{ fontSize: '0.95rem' }}>
                                    • <strong>Registration Data:</strong> Email addresses and names provided during account creation, managed via Firebase Authentication.<br />
                                    • <strong>User Preferences:</strong> Stored lists, selections, and filtered choices saved to our Redis high-performance synchronization layer.<br />
                                    • <strong>Technical Logs:</strong> IP addresses, browser types, and navigation paths collected for security audit and performance optimization.
                                </p>
                            </div>
                            <div style={{ marginTop: '20px', padding: '24px', background: '#f8fafc', borderRadius: '16px' }}>
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '12px' }}>B. Usage of Data</h3>
                                <p style={{ fontSize: '0.95rem' }}>
                                    We do NOT sell personal user data to third-party advertisers. Collected data is used exclusively to:
                                    <br />1. Facilitate cloud-sync for your college priority lists.
                                    <br />2. Provide personalized "Strategic Choice" suggestions.
                                    <br />3. Maintain the integrity of our voting and rating systems.
                                </p>
                            </div>
                        </section>

                        {/* 4. LIABILITY SHIELD */}
                        <section id="liability" style={{ marginBottom: '60px' }}>
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <ChevronRight color="#2563eb" /> 4. Disclaimers and Liability Shield
                            </h2>
                            <div style={{ background: '#f1f5f9', padding: '30px', borderRadius: '20px', borderLeft: '8px solid #1e3a8a' }}>
                                <p style={{ fontWeight: 700, textTransform: 'uppercase', fontSize: '0.9rem', marginBottom: '16px', color: '#1e3a8a' }}>Absolute Limitation of Liability</p>
                                <p style={{ fontSize: '0.95rem', lineHeight: 2 }}>
                                    TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, CEI AND ITS OPERATORS SHAL NOT BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, OR EXEMPLARY DAMAGES, INCLUDING BUT NOT LIMITED TO:
                                    (I) ERRORS IN FEE CALCULATIONS, (II) MISSED ADMISSION DEADLINES, (III) LOSS OF SEAT IN ANY INSTITUTION, OR (IV) ANY ACADEMIC DISRUPTIONS.
                                    ALL DATA IS PROVIDED "AS IS" AND "AS AVAILABLE". WE EXPRESSLY DISCLAIM ANY WARRANTIES OF ACCURACY, COMPLETENESS, OR FITNESS FOR A PARTICULAR PURPOSE.
                                </p>
                            </div>
                        </section>

                        {/* 5. LEGAL JURISDICTION */}
                        <section id="legal">
                            <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <ChevronRight color="#2563eb" /> 5. Intellectual Property & Jurisdiction
                            </h2>
                            <p>
                                The proprietary algorithms, "Selection Intelligence" UI, and synthesized data sets are the intellectual property of CEI. Unauthorized automated scraping or commercial redistribution of this data is strictly prohibited and will be prosecuted to the fullest extent of the law.
                            </p>
                            <p style={{ marginTop: '16px' }}>
                                <strong>Jurisdiction:</strong> These terms are governed by the laws of India. Any litigation or legal proceeding shall be subject to the exclusive jurisdiction of the courts located within our primary city of operations.
                            </p>
                        </section>

                    </div>

                    {/* Footer CTA */}
                    <div style={{
                        marginTop: '40px',
                        textAlign: 'center',
                        padding: '40px',
                        background: '#1e3a8a',
                        borderRadius: '24px',
                        color: 'white'
                    }}>
                        <ShieldCheck size={48} style={{ marginBottom: '20px', opacity: 0.8 }} />
                        <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '12px' }}>Committed to Transparency</h3>
                        <p style={{ opacity: 0.8, marginBottom: '32px', maxWidth: '500px', margin: '0 auto 32px' }}>
                            We believe in empowering students through data while maintaining the highest standards of legal and ethical conduct.
                        </p>
                        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                            <Link href="/" style={{
                                background: 'white',
                                color: '#1e3a8a',
                                padding: '12px 32px',
                                borderRadius: '12px',
                                fontWeight: 700,
                                textDecoration: 'none'
                            }}>Return Home</Link>
                            <Link href="/guide" style={{
                                border: '1px solid rgba(255,255,255,0.3)',
                                color: 'white',
                                padding: '12px 32px',
                                borderRadius: '12px',
                                fontWeight: 600,
                                textDecoration: 'none'
                            }}>Read Guide</Link>
                        </div>
                    </div>
                </div>
            </Container>

            <style jsx>{`
                .legal-nav-item:hover {
                    border-color: #2563eb !important;
                    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
                    transform: translateY(-2px);
                }
                section { scroll-margin-top: 140px; }
                p { margin-bottom: 20px; }
            `}</style>
        </div>
    );
}
