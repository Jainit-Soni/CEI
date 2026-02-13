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
                <div style={{ maxWidth: '900px', margin: '0 auto' }}>
                    {data.choices.map((item, index) => (
                        <div key={index} style={{
                            background: 'white',
                            borderRadius: '24px',
                            padding: '32px',
                            marginBottom: '20px',
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '24px',
                            boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
                        }}>
                            <div style={{
                                width: '40px',
                                height: '40px',
                                background: '#1e3a8a',
                                color: 'white',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.2rem',
                                fontWeight: 800
                            }}>
                                {index + 1}
                            </div>

                            <div style={{ flex: 1 }}>
                                <h3 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#1e293b', marginBottom: '8px' }}>
                                    {item.name}
                                </h3>
                                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#64748b' }}>
                                        <MapPin size={14} /> {item.location}
                                    </span>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#059669', fontWeight: 600 }}>
                                        <TrendingUp size={14} /> ROI Projection: {item.placements?.averagePackage || "High"}
                                    </span>
                                </div>
                            </div>

                            <div style={{ textAlign: 'right' }}>
                                <div style={{
                                    background: '#f1f5f9',
                                    padding: '6px 12px',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem',
                                    fontWeight: 700,
                                    color: '#475569',
                                    textTransform: 'uppercase'
                                }}>
                                    {item.rankingTier || "Tier 1"}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* CTA / Footer */}
                <div style={{
                    marginTop: '60px',
                    textAlign: 'center',
                    padding: '40px',
                    background: '#1e3a8a',
                    borderRadius: '32px',
                    color: 'white'
                }}>
                    <h2 style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: '16px' }}>Build Your Own Roadmap</h2>
                    <p style={{ opacity: 0.8, marginBottom: '32px', maxWidth: '500px', margin: '0 auto 32px' }}>
                        Join 2,000+ students using CEI Intelligence to architect their academic futures.
                    </p>
                    <Link href="/colleges" style={{
                        background: 'white',
                        color: '#1e3a8a',
                        padding: '16px 32px',
                        borderRadius: '99px',
                        fontWeight: 700,
                        textDecoration: 'none',
                        display: 'inline-block'
                    }}>
                        Get Started with CEI
                    </Link>
                </div>
            </Container>

            <style jsx>{`
                .spinner {
                    width: 40px;
                    height: 40px;
                    border: 4px solid #e2e8f0;
                    border-top: 4px solid #2563eb;
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
