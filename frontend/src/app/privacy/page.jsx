"use client";

import Container from "@/components/Container";
import Link from "next/link";
import { Shield, AlertTriangle, ExternalLink } from "lucide-react";

export default function PrivacyPage() {
    return (
        <div className="legal-page" style={{ paddingTop: '120px', paddingBottom: '80px', background: '#f8fafc' }}>
            <Container>
                {/* HIGH-LEVEL DISCLOSURE BOX */}
                <div className="legal-disclaimer-hero" style={{
                    background: '#fff7ed',
                    border: '1px solid #fed7aa',
                    padding: '24px',
                    borderRadius: '16px',
                    marginBottom: '40px',
                    display: 'flex',
                    gap: '16px'
                }}>
                    <AlertTriangle color="#f97316" size={32} style={{ flexShrink: 0 }} />
                    <div>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#9a3412', margin: '0 0 8px 0' }}>Data Accuracy & Liability Disclaimer</h2>
                        <p style={{ fontSize: '0.9rem', color: '#c2410c', margin: 0, lineHeight: 1.6 }}>
                            The information provided on CEI (the "Platform") is for **reference and general informational purposes ONLY**.
                            While we strive for accuracy, educational data like cutoffs and fees change frequently.
                            Users are strictly advised to cross-verify all details with the **official university/college websites** before making any academic or financial decisions.
                            CEI and its operators are not liable for any discrepancies or losses arising from the use of this information.
                        </p>
                    </div>
                </div>

                <div className="legal-header" style={{ marginBottom: '60px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <Shield color="#2563eb" size={28} />
                        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Legal Framework</span>
                    </div>
                    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', fontWeight: 800, color: '#1e3a8a', marginBottom: '12px' }}>
                        Privacy <span style={{ color: '#2563eb' }}>Policy</span>
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '1.1rem' }}>Last Updated: February 13, 2026</p>
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
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginBottom: '20px' }}>1. Introduction</h2>
                        <p>
                            Welcome to CEI. This Privacy Policy outlines how we handle your information. As an educational data aggregator, our primary goal is to provide institutional insights to Indian students. By using this platform, you acknowledge that you have read and understood this policy.
                        </p>
                    </section>

                    <section>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginBottom: '20px' }}>2. Information Collection</h2>
                        <p>We collect minimal data necessary to provide our services:</p>
                        <ul style={{ paddingLeft: '20px', marginTop: '12px' }}>
                            <li><strong>Account Data:</strong> If you sign up, we use Firebase Authentication to securely store your email and name.</li>
                            <li><strong>Preference Data:</strong> Your "Strategic Priority List" and "Favorites" are stored to enable cross-device synchronization.</li>
                            <li><strong>Analytics:</strong> Anonymous usage data is collected via Vercel Analytics to improve platform performance.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginBottom: '20px' }}>3. Professional Reference & Official Data</h2>
                        <p>
                            CEI acts as an intermediary information portal. We do not represent any college or university officially.
                            Pursuant to <strong>Section 79 of the Information Technology Act, 2000 (India)</strong>, CEI operates as an intermediary providing access to third-party information.
                            The decision-making process for admissions remains the sole responsibility of the user, who must refer to official government bulletins for finality.
                        </p>
                    </section>

                    <section>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginBottom: '20px' }}>4. Data Security</h2>
                        <p>
                            Your data security is paramount. We leverage Firebase's enterprise-grade security protocols.
                            However, no platform can guarantee absolute security. Since we do not collect sensitive financial information (we are an information portal, not an exchange), risk to users is significantly minimized.
                        </p>
                    </section>

                    <section>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#0f172a', marginBottom: '20px' }}>5. User Rights</h2>
                        <p>
                            You have the right to access, modify, or delete your account data at any time through the dashboard.
                            For any specific data requests under Indian Digital Personal Data Protection (DPDP) norms, please contact support.
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
                        <h3 style={{ marginBottom: '16px' }}>Need official assistance?</h3>
                        <p style={{ color: '#64748b', marginBottom: '24px' }}>
                            Always cross-reference with official counseling portals like MCC, JOSAA, or specific State Examination Boards.
                        </p>
                        <Link href="/colleges" style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            background: '#2563eb',
                            color: 'white',
                            padding: '12px 24px',
                            borderRadius: '99px',
                            fontWeight: 600,
                            textDecoration: 'none'
                        }}>
                            Back to Discovery <ExternalLink size={16} />
                        </Link>
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
