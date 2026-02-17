"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Calendar, Award, BookOpen, CheckCircle, FileText } from 'lucide-react';
import Button from '@/components/Button';
import Spinner from '@/components/Spinner';

export default function ScholarshipDetail() {
    const params = useParams();
    const [scholarship, setScholarship] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/scholarships/${params.id}`)
            .then(res => res.json())
            .then(data => {
                setScholarship(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load scholarship:", err);
                setLoading(false);
            });
    }, [params.id]);

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-900"><Spinner /></div>;
    if (!scholarship || scholarship.msg) return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white">
            <h1 className="text-2xl font-bold mb-4">Scholarship Not Found</h1>
            <Button href="/scholarships">Back to List</Button>
        </div>
    );

    return (
        <div className="scholarship-detail-page">
            {/* Header / Hero */}
            <div className="detail-hero">
                <div className="container mx-auto px-4 py-8">
                    <Link href="/scholarships" className="back-link">
                        <ArrowLeft size={16} /> Back to Scholarships
                    </Link>

                    <div className="hero-content">
                        <div className="logo-container">
                            {scholarship.logo ? (
                                <img src={scholarship.logo} alt={scholarship.provider} />
                            ) : (
                                <div className="logo-placeholder">{scholarship.provider[0]}</div>
                            )}
                        </div>
                        <div className="hero-text">
                            <div className="badges-row">
                                <span className="cat-badge">{scholarship.category}</span>
                                <span className="provider-badge">{scholarship.provider}</span>
                            </div>
                            <h1 className="detail-title">{scholarship.name}</h1>
                            <div className="hero-meta">
                                <span className="meta-pill"><Award size={16} className="text-yellow-400" /> {scholarship.amount}</span>
                                <span className="meta-pill"><Calendar size={16} className="text-blue-400" /> Deadline: {scholarship.deadline}</span>
                            </div>
                        </div>
                        <div className="hero-action">
                            <Button href={scholarship.applicationUrl} target="_blank" variant="gradient" size="lg">
                                Apply Now <ExternalLink size={16} className="ml-2" />
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="container mx-auto px-4 py-12">
                <div className="detail-grid">
                    {/* Left Column: Info */}
                    <div className="detail-main">
                        <section className="detail-section glass-panel">
                            <h2 className="section-title"><CheckCircle size={24} className="text-emerald-400" /> Eligibility Criteria</h2>
                            <ul className="eligibility-list">
                                {scholarship.eligibility.map((item, idx) => (
                                    <li key={idx}>{item}</li>
                                ))}
                            </ul>
                        </section>

                        <section className="detail-section glass-panel">
                            <h2 className="section-title"><FileText size={24} className="text-purple-400" /> Documents Required</h2>
                            <ul className="doc-list">
                                <li>Aadhaar Card / ID Proof</li>
                                <li>Income Certificate (if applicable)</li>
                                <li>Previous Year Marksheet</li>
                                <li>Admission Proof / Fee Receipt</li>
                                <li>Bank Account Passbook</li>
                            </ul>
                            <p className="text-slate-400 text-sm mt-4 italic">* Additional documents may be required based on specific category rules.</p>
                        </section>
                    </div>

                    {/* Right Column: Sidebar */}
                    <div className="detail-sidebar">
                        <div className="sidebar-card glass-panel">
                            <h3>Overview</h3>
                            <p className="text-slate-400 text-sm mb-4">
                                This scholarship is provided by <strong>{scholarship.provider}</strong> to support students from <strong>{scholarship.category}</strong> backgrounds.
                            </p>
                            <div className="sidebar-stat">
                                <span className="label">Award Type</span>
                                <span className="val">{scholarship.amount.includes("One-time") ? "One Time" : "Recurring"}</span>
                            </div>
                            <div className="sidebar-stat">
                                <span className="label">Category</span>
                                <span className="val">{scholarship.category}</span>
                            </div>
                        </div>

                        <div className="sidebar-card glass-panel bg-blue-900/20 border-blue-500/30">
                            <h3>Need Help?</h3>
                            <p className="text-slate-400 text-sm mb-4">
                                Most government scholarships require registration on the National Scholarship Portal (NSP).
                            </p>
                            <Button href="https://scholarships.gov.in" target="_blank" variant="outline" size="sm" className="w-full">
                                Visit NSP Portal
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <style jsx>{`
                .scholarship-detail-page {
                    min-height: 100vh;
                    background: #0f172a;
                    color: white;
                }

                .detail-hero {
                    background: linear-gradient(to bottom, #1e293b, #0f172a);
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    padding-bottom: 40px;
                }

                .back-link {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    color: #94a3b8;
                    margin-bottom: 32px;
                    transition: color 0.2s;
                }
                .back-link:hover { color: white; }

                .hero-content {
                    display: flex;
                    align-items: center;
                    gap: 32px;
                }

                .logo-container {
                    width: 100px;
                    height: 100px;
                    background: white;
                    border-radius: 20px;
                    padding: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 20px 40px -10px rgba(0,0,0,0.3);
                }
                .logo-container img { width: 100%; height: 100%; object-fit: contain; }
                .logo-placeholder { font-size: 3rem; font-weight: 900; color: #0f172a; }

                .hero-text { flex: 1; }

                .badges-row { display: flex; gap: 12px; margin-bottom: 12px; }
                .cat-badge { background: rgba(59, 130, 246, 0.2); color: #60a5fa; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; }
                .provider-badge { background: rgba(255, 255, 255, 0.1); color: #cbd5e1; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; }

                .detail-title {
                    font-family: var(--font-display);
                    font-size: 2.5rem;
                    line-height: 1.2;
                    margin-bottom: 16px;
                }

                .hero-meta { display: flex; gap: 24px; }
                .meta-pill { display: flex; align-items: center; gap: 8px; color: #cbd5e1; font-size: 1.1rem; }

                /* Layout */
                .detail-grid {
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 40px;
                }

                .detail-section {
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 24px;
                    padding: 32px;
                    margin-bottom: 32px;
                }

                .section-title {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    font-size: 1.5rem;
                    margin-bottom: 24px;
                    font-family: var(--font-display);
                    color: white;
                }

                .eligibility-list, .doc-list {
                    list-style: none;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .eligibility-list li, .doc-list li {
                    position: relative;
                    padding-left: 24px;
                    color: #cbd5e1;
                    font-size: 1.1rem;
                }
                .eligibility-list li::before {
                    content: "•";
                    color: #10b981;
                    font-size: 1.5rem;
                    position: absolute;
                    left: 0;
                    top: -6px;
                }
                .doc-list li::before {
                    content: "📄";
                    font-size: 1rem;
                    position: absolute;
                    left: 0;
                    top: 4px;
                }

                .sidebar-card {
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 20px;
                    padding: 24px;
                    margin-bottom: 24px;
                }
                .sidebar-card h3 { font-size: 1.2rem; margin-bottom: 12px; font-weight: 700; color: white; }
                
                .sidebar-stat {
                    display: flex;
                    justify-content: space-between;
                    padding: 12px 0;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    font-size: 0.9rem;
                }
                .sidebar-stat:last-child { border-bottom: none; }
                .sidebar-stat .label { color: #94a3b8; }
                .sidebar-stat .val { color: white; font-weight: 600; }

                @media (max-width: 1024px) {
                    .detail-grid { grid-template-columns: 1fr; }
                    .hero-content { flex-direction: column; align-items: flex-start; }
                    .logo-container { margin-bottom: 16px; }
                    .hero-action { width: 100%; margin-top: 24px; }
                    .hero-action button { width: 100%; }
                }
            `}</style>
        </div>
    );
}
