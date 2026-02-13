"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Container from "@/components/Container";
import { fetchSharedList } from "@/lib/api";
import { GraduationCap, MapPin, TrendingUp, Shield, Share2, Clipboard } from "lucide-react";
import Link from "next/link";

export default function SharePage() {
    const { id } = useParams();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!id) return;
        const load = async () => {
            try {
                const list = await fetchSharedList(id);
                setData(list);
            } catch (err) {
                setError("Shared roadmap not found or has expired.");
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [id]);

    if (loading) {
        return (
            <div style={{ paddingTop: '150px', textAlign: 'center' }}>
                <div className="spinner" style={{ margin: '0 auto' }}></div>
                <p style={{ marginTop: '20px', color: '#64748b' }}>Retrieving Strategic Roadmap...</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div style={{ paddingTop: '150px', textAlign: 'center' }}>
                <h1 style={{ fontSize: '3rem' }}>🔍</h1>
                <h2>Roadmap Not Found</h2>
                <p style={{ color: '#64748b' }}>{error}</p>
                <Link href="/" style={{ color: '#2563eb', fontWeight: 600 }}>Back to CEI Home</Link>
            </div>
        );
    }

    return (
        <div className="share-page" style={{ paddingTop: '120px', paddingBottom: '100px', background: '#f8fafc' }}>
            <Container>
                {/* Header Section */}
                <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                    <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        background: '#eff6ff',
                        color: '#2563eb',
                        padding: '8px 16px',
                        borderRadius: '99px',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        marginBottom: '20px'
                    }}>
                        <Shield size={16} />
                        VERIFIED STRATEGIC ROADMAP
                    </div>
                    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '3rem', fontWeight: 800, color: '#1e3a8a', marginBottom: '16px' }}>
                        {data.userName.split(' ')[0]}'s <span style={{ color: '#2563eb' }}>Choice List</span>
                    </h1>
                    <p style={{ fontSize: '1.2rem', color: '#64748b', maxWidth: '600px', margin: '0 auto' }}>
                        A curated selection of colleges optimized for ROI and academic excellence.
                        Snapshot taken on {new Date(data.createdAt).toLocaleDateString()}.
                    </p>
                </div>

                {/* List Content */}
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    {data.choices.map((item, index) => {
                        // Helper to format exams properly and avoid [object Object]
                        const formatExams = (exams) => {
                            if (!exams) return "N/A";
                            if (Array.isArray(exams)) {
                                return exams.map(e => (typeof e === 'object' ? (e.name || e.code || JSON.stringify(e)) : e)).join(", ");
                            }
                            return typeof exams === 'object' ? (exams.name || "Multiple") : exams;
                        };

                        const avgPackage = item.placements?.averagePackage || item.avgPackage || "N/A";
                        const tuition = item.tuition || item.fees || "See Website";

                        return (
                            <div key={index} style={{
                                background: 'white',
                                borderRadius: '24px',
                                padding: '40px',
                                marginBottom: '32px',
                                border: '1px solid #e2e8f0',
                                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.03)',
                                position: 'relative',
                                overflow: 'hidden'
                            }}>
                                {/* Decorative Index Accent */}
                                <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '6px',
                                    height: '100%',
                                    background: '#1e3a8a'
                                }} />

                                <div style={{ marginBottom: '32px' }}>
                                    <h3 style={{ fontSize: '1.75rem', fontWeight: 800, color: '#1e3a8a', marginBottom: '8px' }}>
                                        {index + 1}. {item.name || item.shortName}
                                    </h3>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '1.1rem' }}>
                                        <MapPin size={18} />
                                        <span>{item.location}</span>
                                    </div>
                                </div>

                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                                    gap: '32px',
                                    borderTop: '1px solid #f1f5f9',
                                    paddingTop: '32px'
                                }}>
                                    <div className="report-field">
                                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>EST. TUITION</span>
                                        <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', marginTop: '4px' }}>
                                            {typeof tuition === 'object' ? "Variable" : tuition}
                                        </p>
                                    </div>

                                    <div className="report-field">
                                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>AVG PACKAGE</span>
                                        <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#059669', marginTop: '4px' }}>
                                            {typeof avgPackage === 'object' ? "High ROI" : avgPackage}
                                        </p>
                                    </div>

                                    <div className="report-field">
                                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>KEY EXAMS</span>
                                        <p style={{ fontSize: '1.1rem', fontWeight: 700, color: '#1e293b', marginTop: '4px' }}>
                                            {formatExams(item.acceptedExams)}
                                        </p>
                                    </div>

                                    <div className="report-field">
                                        <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Strategic Choice</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                            <Shield size={16} color="#2563eb" />
                                            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: '#2563eb' }}>
                                                Tier {item.rankingTier || "Tier 1"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* CTA / Footer */}
                <div style={{
                    marginTop: '80px',
                    textAlign: 'center',
                    padding: '60px 40px',
                    background: 'linear-gradient(135deg, #1e3a8a 0%, #1e40af 100%)',
                    borderRadius: '40px',
                    color: 'white',
                    boxShadow: '0 20px 25px -5px rgba(30, 58, 138, 0.2)'
                }}>
                    <TrendingUp size={48} style={{ marginBottom: '24px', opacity: 0.9 }} />
                    <h2 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: '20px' }}>Build Your Own Roadmap</h2>
                    <p style={{ fontSize: '1.1rem', opacity: 0.8, marginBottom: '40px', maxWidth: '600px', margin: '0 auto 40px' }}>
                        Architect your future with CEI Intelligence. Get verified data, real-time sync, and strategic ROI projections.
                    </p>
                    <Link href="/colleges" style={{
                        background: 'white',
                        color: '#1e3a8a',
                        padding: '20px 48px',
                        borderRadius: '99px',
                        fontWeight: 800,
                        textDecoration: 'none',
                        fontSize: '1.1rem',
                        display: 'inline-block',
                        transition: 'transform 0.2s',
                    }}
                        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                        Start Your Journey
                    </Link>
                </div>
            </Container>

            <style jsx>{`
                .report-field p {
                    margin: 0;
                }
                .spinner {
                    width: 48px;
                    height: 48px;
                    border: 5px solid #e2e8f0;
                    border-top: 5px solid #2563eb;
                    border-radius: 50%;
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
}
