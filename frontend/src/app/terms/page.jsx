"use client";

import Container from "@/components/Container";
import Link from "next/link";
import { FileText, AlertOctagon, Scale, ExternalLink } from "lucide-react";

export default function TermsPage() {
    return (
        <div className="legal-page" style={{ paddingTop: '120px', paddingBottom: '80px', background: '#f8fafc' }}>
            <Container>
                {/* EXTREME DEFENSE BOX */}
                <div className="legal-disclaimer-hero" style={{
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    padding: '28px',
                    borderRadius: '16px',
                    marginBottom: '40px',
                    display: 'flex',
                    gap: '16px'
                }}>
                    <AlertOctagon color="#dc2626" size={36} style={{ flexShrink: 0 }} />
                    <div>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 900, color: '#991b1b', margin: '0 0 8px 0', textTransform: 'uppercase' }}>Binding Legal Disclaimer & Liability Shield</h2>
                        <p style={{ fontSize: '0.95rem', color: '#b91c1c', margin: 0, fontWeight: 500, lineHeight: 1.6 }}>
                            BY ACCESSING THIS WEBSITE, YOU AGREE THAT ALL CONTENT IS PROVIDED "AS IS" AND "AS AVAILABLE". CEI IS DEVOID OF ANY LEGAL LIABILITY FOR DATA DISCREPANCIES.
                            THIS PLATFORM IS NOT A REPLACEMENT FOR OFFICIAL GOVERNMENT OR UNIVERSITY PORTALS. ANY ACTIONS TAKEN BASED ON OUR DATA ARE AT YOUR SOLE RISK.
                            <strong> WE ARE NOT LIABLE FOR ANY DIRECT, INDIRECT, OR CONSEQUENTIAL LOSSES RESULTING FROM YOUR USE OF THIS PLATFORM.</strong>
                        </p>
                    </div>
                </div>

                <div className="legal-header" style={{ marginBottom: '60px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <Scale color="#1e40af" size={28} />
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Usage Agreement</span>
                    </div>
                    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', fontWeight: 800, color: '#1e3a8a', marginBottom: '12px' }}>
                        Terms of <span style={{ color: '#2563eb' }}>Service</span>
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '1.1rem' }}>Effective Date: February 13, 2026</p>
                </div>

                <div className="legal-content" style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr',
                    gap: '40px',
                    color: '#334155',
                    lineHeight: 1.8,
                    fontSize: '1rem'
                }}>
                    <section>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginBottom: '20px' }}>1. Acceptance of Terms</h2>
                        <p>
                            CEI (the "Platform") provides educational data aggregation. By using this platform, you agree to these Terms of Service in their entirety. If you disagree with any part of these terms, your sole remedy is to cease using the Platform immediately.
                        </p>
                    </section>

                    <section>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginBottom: '20px' }}>2. "Reference Only" Nature of Services</h2>
                        <p>
                            All content on this website, including but not limited to college rankings, exam dates, cutoffs, and fee structures, is presented for <strong>reference purposes only</strong>. We act as a secondary information provider.
                            You are mandated to verify all information against original university prospects or government gazettes (e.g., MCC, AICTE, UGC, or State Counseling Authorities).
                        </p>
                    </section>

                    <section style={{ padding: '24px', background: '#f1f5f9', borderRadius: '16px', borderLeft: '4px solid #1e3a8a' }}>
                        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#0f172a', marginBottom: '12px' }}>3. Limitation of Liability (Absolute Shield)</h2>
                        <p style={{ fontSize: '0.95rem', fontStyle: 'italic' }}>
                            To the maximum extent permitted by the Indian Constitution and applicable laws:
                        </p>
                        <ul style={{ paddingLeft: '20px', marginTop: '12px' }}>
                            <li>CEI does not guarantee the completeness, accuracy, or timeliness of any data shown.</li>
                            <li>CEI is not responsible for missed deadlines, incorrect fee payments, or failed admission attempts based on our listings.</li>
                            <li>In no event shall CEI be liable for any legal action or damages arising from the use of its content.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginBottom: '20px' }}>4. Intellectual Property & Prohibited Use</h2>
                        <p>
                            The technology and unique interface of CEI are protected. Users may not scrape data or redistribution our aggregated content for commercial purposes without explicit written consent.
                        </p>
                    </section>

                    <section>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginBottom: '20px' }}>5. Legal Provisions (Indian Law)</h2>
                        <p>
                            These terms are governed by the laws of India. We reserve our rights under <strong>Article 19(1)(g) of the Constitution of India</strong> to carry out information services.
                            Under <strong>Section 79 of the IT Act, 2000</strong>, we claim safe harbor protection as an intermediary aggregator. Any legal disputes shall be subject to the exclusive jurisdiction of the courts located in our operating city.
                        </p>
                    </section>

                    <section style={{
                        marginTop: '40px',
                        padding: '32px',
                        background: 'white',
                        borderRadius: '24px',
                        border: '1px solid #e2e8f0',
                        textAlign: 'center'
                    }}>
                        <h3 style={{ marginBottom: '16px' }}>Understand your responsibility</h3>
                        <p style={{ color: '#64748b', marginBottom: '24px' }}>
                            Your academic future is important. Always rely on official directives for final decisions.
                        </p>
                        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center' }}>
                            <Link href="/privacy" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>Privacy Policy</Link>
                            <span style={{ color: '#cbd5e1' }}>|</span>
                            <Link href="/guide" style={{ color: '#2563eb', fontWeight: 600, textDecoration: 'none' }}>Admission Guide</Link>
                        </div>
                    </section>
                </div>
            </Container>

            <style jsx>{`
                .legal-content section p { margin-bottom: 20px; }
                .legal-content ul li { margin-bottom: 12px; }
            `}</style>
        </div>
    );
}
