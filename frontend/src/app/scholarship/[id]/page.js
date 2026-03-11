"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Calendar, Award, BookOpen, CheckCircle, FileText, ShieldCheck, Zap, Globe, Share2, GraduationCap } from 'lucide-react';
import Button from '@/components/Button';
import Spinner from '@/components/Spinner';
import Container from '@/components/Container';
import GlassPanel from '@/components/GlassPanel';
import { fetchScholarship } from '@/lib/api';
import { RevealOnScroll } from '@/lib/useIntersectionObserver';
import "./scholarship-detail.css";

export default function ScholarshipDetail() {
    const params = useParams();
    const [scholarship, setScholarship] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!params.id) return;

        setLoading(true);
        fetchScholarship(params.id)
            .then(data => {
                setScholarship(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load scholarship:", err);
                setLoading(false);
            });
    }, [params.id]);

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center bg-white">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                <p className="text-slate-500 font-medium font-sans">Curating Grant Details...</p>
            </div>
        </div>
    );

    if (!scholarship || scholarship.msg) return (
        <div className="min-h-screen flex flex-col items-center justify-center text-center px-4 bg-slate-50">
            <div className="bg-white p-6 rounded-full mb-6 shadow-xl border border-slate-100">
                <BookOpen size={48} className="text-slate-300" />
            </div>
            <h1 className="text-3xl font-black text-slate-800 mb-2">Scholarship Not Found</h1>
            <p className="text-slate-500 mb-8 max-w-md">This specific grant may have been archived or the link is expired.</p>
            <Link href="/scholarships">
                <Button variant="primary">Explore Other Scholarships</Button>
            </Link>
        </div>
    );

    return (
        <div className="scholarship-detail-page min-h-screen">
            {/* 1. MESH HERO BANDS */}
            <div className="scholarship-hero-bands">
                <Container>
                    <div className="flex flex-col items-start gap-8">
                        <Link href="/scholarships" className="group flex items-center gap-2 text-slate-600 hover:text-indigo-600 transition-all font-bold text-sm bg-white/50 backdrop-blur-md px-4 py-2 rounded-full border border-white/50 shadow-sm">
                            <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
                            Back to Discover
                        </Link>

                        <div className="flex flex-col md:flex-row items-center md:items-start gap-8 w-full">
                            {/* Brand Box */}
                            <div className="w-32 h-32 md:w-40 md:h-40 bg-white rounded-[32px] p-6 flex items-center justify-center shadow-2xl shadow-indigo-100 border border-white shrink-0">
                                {scholarship.logo ? (
                                    <img src={scholarship.logo} alt={scholarship.provider} className="max-w-full max-h-full object-contain" />
                                ) : (
                                    <GraduationCap size={64} className="text-indigo-500" />
                                )}
                            </div>

                            <div className="flex-1 text-center md:text-left">
                                <div className="flex flex-wrap justify-center md:justify-start gap-3 mb-4">
                                    <span className="badge-emerald px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                                        Verified Grant
                                    </span>
                                    <span className="badge-indigo px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                                        {scholarship.category}
                                    </span>
                                </div>
                                <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tight leading-[1.1] mb-4">
                                    {scholarship.name}
                                </h1>
                                <p className="text-xl text-slate-600 font-medium">
                                    Administered by <span className="text-indigo-600 font-bold">{scholarship.provider}</span>
                                </p>
                            </div>
                        </div>
                    </div>
                </Container>
            </div>

            <Container>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mt-[-40px] relative z-10 pb-20">
                    {/* Main Content */}
                    <div className="lg:col-span-8 space-y-8">
                        {/* Quick Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="stat-box">
                                <div className="p-3 bg-amber-50 text-amber-600 w-fit rounded-xl">
                                    <Award size={24} />
                                </div>
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Scholarship Amount</span>
                                <span className="text-3xl font-black text-slate-800">{scholarship.amount}</span>
                            </div>
                            <div className="stat-box">
                                <div className="p-3 bg-blue-50 text-blue-600 w-fit rounded-xl">
                                    <Calendar size={24} />
                                </div>
                                <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Application Deadline</span>
                                <span className="text-3xl font-black text-slate-800">{scholarship.deadline}</span>
                            </div>
                        </div>

                        {/* Eligibility Section */}
                        <RevealOnScroll>
                            <div className="scholarship-glass-card p-8 md:p-10">
                                <h2 className="section-title-premium mb-8">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center">
                                        <ShieldCheck size={22} />
                                    </div>
                                    Who can apply?
                                </h2>
                                <div className="grid gap-4">
                                    {scholarship.eligibility.map((item, idx) => (
                                        <div key={idx} className="criteria-item flex items-start gap-4">
                                            <div className="mt-1">
                                                <CheckCircle className="text-emerald-500" size={20} />
                                            </div>
                                            <p className="text-slate-700 font-bold text-lg leading-relaxed">{item}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </RevealOnScroll>

                        {/* Documents Section */}
                        <RevealOnScroll>
                            <div className="scholarship-glass-card p-8 md:p-10">
                                <h2 className="section-title-premium mb-8">
                                    <div className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center">
                                        <FileText size={22} />
                                    </div>
                                    Required Documents
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {[
                                        "Academic Marksheets (Previous Year)",
                                        "Identity Proof (Aadhaar/PAN)",
                                        "Family Income Certificate",
                                        "Admission Confirmation Letter",
                                        "Bank Account Passbook Copy"
                                    ].map((doc, idx) => (
                                        <div key={idx} className="flex items-center gap-3 p-4 bg-white/50 rounded-2xl border border-slate-100">
                                            <div className="w-2 h-2 rounded-full bg-purple-400" />
                                            <span className="text-slate-600 font-bold">{doc}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </RevealOnScroll>
                    </div>

                    {/* Sidebar Actions */}
                    <div className="lg:col-span-4">
                        <div className="sticky top-24 space-y-6">
                            <div className="scholarship-glass-card p-8">
                                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Execution</h3>
                                <a
                                    href={scholarship.applicationUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="apply-button-premium text-decoration-none"
                                >
                                    Apply on Official Portal
                                    <ExternalLink size={20} />
                                </a>

                                <div className="mt-10 pt-8 border-t border-slate-200/50">
                                    <div className="flex gap-4">
                                        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
                                            <Zap size={24} />
                                        </div>
                                        <div>
                                            <p className="font-black text-slate-900 text-sm mb-1 uppercase tracking-tight">Pro Tip</p>
                                            <p className="text-slate-500 text-xs font-medium leading-relaxed">
                                                Double-check your income certificate validity. Most state scholarships require certificates issued after 1st April of the current financial year.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-indigo-600 rounded-[32px] p-8 text-white shadow-xl shadow-indigo-200 relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:scale-110 transition-transform">
                                    <Globe size={120} />
                                </div>
                                <h4 className="text-xl font-black mb-3 relative z-10">Need Assistance?</h4>
                                <p className="text-indigo-100 text-sm font-bold mb-6 relative z-10 leading-relaxed">
                                    Our counselors can help you navigate the application process for state and national schemes.
                                </p>
                                <button className="w-full bg-white text-indigo-600 py-3 rounded-xl font-black text-sm relative z-10 hover:bg-slate-50 transition-colors">
                                    Get Expert Guidance
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </Container>
        </div>
    );
}
