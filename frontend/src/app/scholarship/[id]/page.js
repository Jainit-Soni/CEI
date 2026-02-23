"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Calendar, Award, BookOpen, CheckCircle, FileText, ShieldCheck, Zap, Globe, Share2 } from 'lucide-react';
import Button from '@/components/Button';
import Spinner from '@/components/Spinner';
import Container from '@/components/Container';
import GlassPanel from '@/components/GlassPanel';
import { fetchScholarship } from '@/lib/api';
import { RevealOnScroll } from '@/lib/useIntersectionObserver';
import "@/components/CollegeHero.css"; // Reuse Cinematic Hero styles
import "../../colleges/page.css";

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
        <div className="list-page min-h-screen flex items-center justify-center bg-slate-900">
            <Spinner />
        </div>
    );

    if (!scholarship || scholarship.msg) return (
        <div className="list-page min-h-screen flex flex-col items-center justify-center text-center px-4 bg-slate-50">
            <div className="bg-white p-6 rounded-full mb-6 shadow-xl">
                <BookOpen size={48} className="text-slate-400" />
            </div>
            <h1 className="text-3xl font-black text-slate-800 mb-2">Grant Information Not Found</h1>
            <p className="text-slate-500 mb-8 max-w-md">The scholarship record you're looking for might have been moved or archived.</p>
            <Button href="/scholarships" variant="primary">Back to Scholarships</Button>
        </div>
    );

    return (
        <div className="college-profile-v3 bg-slate-50 min-h-screen">
            {/* 1. CINEMATIC HERO (Reused Styles) */}
            <div className="cinematic-hero">
                <div className="cinematic-content">
                    <div className="hero-container">
                        <div className="hero-badge-row gap-4 mb-3">
                            <Link href="/scholarships" className="inline-flex items-center gap-2 text-indigo-300 hover:text-white transition-colors text-sm font-bold backdrop-blur-md bg-white/10 px-3 py-1.5 rounded-lg border border-white/10">
                                <ArrowLeft size={14} /> Back
                            </Link>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold uppercase tracking-widest backdrop-blur-md">
                                <ShieldCheck size={12} /> Verified Grant
                            </span>
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-bold uppercase tracking-widest backdrop-blur-md">
                                {scholarship.category}
                            </span>
                        </div>

                        <div className="hero-main">
                            <div className="hero-brand">
                                {scholarship.logo ? (
                                    <div className="w-24 h-24 bg-white rounded-2xl p-2 flex items-center justify-center shadow-2xl">
                                        <img src={scholarship.logo} alt={scholarship.provider} className="max-w-full max-h-full object-contain" />
                                    </div>
                                ) : (
                                    <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center text-white text-3xl font-black shadow-2xl border border-white/20">
                                        {scholarship.provider[0]}
                                    </div>
                                )}
                                <div className="hero-text text-left">
                                    <h1 className="hero-title text-4xl md:text-5xl lg:text-6xl">{scholarship.name}</h1>
                                    <p className="hero-subtitle text-lg md:text-xl text-indigo-200 mt-2 flex items-center gap-2">
                                        Provided by <span className="font-bold text-white">{scholarship.provider}</span>
                                    </p>
                                </div>
                            </div>

                        </div>
                    </div>
                </div>
            </div>

            <Container>
                {/* 2. PREMIUM CONTENT LAYOUT */}
                <div className="relative -mt-16 z-20 pb-24">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                        {/* LEFT COLUMN: Main Info */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Key Stats Row */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <GlassPanel className="p-6 flex items-center gap-4" variant="strong">
                                    <div className="p-4 bg-amber-100 text-amber-600 rounded-2xl">
                                        <Award size={32} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">Total Award</p>
                                        <p className="text-2xl font-black text-slate-800">{scholarship.amount}</p>
                                    </div>
                                </GlassPanel>
                                <GlassPanel className="p-6 flex items-center gap-4" variant="strong">
                                    <div className="p-4 bg-blue-100 text-blue-600 rounded-2xl">
                                        <Calendar size={32} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">Application Deadline</p>
                                        <p className="text-2xl font-black text-slate-800">{scholarship.deadline}</p>
                                    </div>
                                </GlassPanel>
                            </div>

                            {/* Eligibility */}
                            <RevealOnScroll delay={100}>
                                <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
                                    <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
                                        <ShieldCheck className="text-emerald-500" /> Eligibility Criteria
                                    </h2>
                                    <div className="space-y-4">
                                        {scholarship.eligibility.map((item, idx) => (
                                            <div key={idx} className="flex items-start gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                                                <CheckCircle className="text-emerald-500 mt-1 shrink-0" size={20} />
                                                <span className="text-slate-700 font-bold text-lg">{item}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </RevealOnScroll>

                            {/* Documents */}
                            <RevealOnScroll delay={200}>
                                <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm">
                                    <h2 className="text-2xl font-black text-slate-800 mb-6 flex items-center gap-3">
                                        <FileText className="text-purple-500" /> Required Documents
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {[
                                            "Government Issued ID (Aadhaar/PAN)",
                                            "Verified Income Certificate",
                                            "Academic Transcripts (Last Exam)",
                                            "Institutional Admission Proof",
                                            "Bank Account Verification"
                                        ].map((doc, idx) => (
                                            <div key={idx} className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-xl hover:border-purple-200 transition-colors cursor-default">
                                                <div className="w-2 h-2 rounded-full bg-purple-400" />
                                                <span className="text-slate-700 font-medium">{doc}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </RevealOnScroll>
                        </div>

                        {/* RIGHT COLUMN: Sidebar */}
                        <div className="space-y-6">
                            <RevealOnScroll delay={300}>
                                <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-xl shadow-slate-200/50 sticky top-24">
                                    <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-6">Quick Actions</h3>

                                    <div className="space-y-3">
                                        <Button href={scholarship.applicationUrl} target="_blank" variant="primary" className="w-full justify-center py-4 text-lg shadow-lg shadow-indigo-200">
                                            Apply on Official Site
                                        </Button>
                                    </div>

                                    <div className="mt-8 pt-8 border-t border-slate-100">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-amber-50 text-amber-600 rounded-lg">
                                                <Zap size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-900 text-sm mb-1">Application Tip</h4>
                                                <p className="text-xs text-slate-500 leading-relaxed">
                                                    Ensure your bank account is linked to Aadhaar for direct benefit transfer (DBT) to avoid rejection.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </RevealOnScroll>
                        </div>

                    </div>
                </div>
            </Container>
        </div>
    );
}
