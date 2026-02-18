"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Calendar, Award, BookOpen, CheckCircle, FileText, ShieldCheck, Zap } from 'lucide-react';
import Button from '@/components/Button';
import Spinner from '@/components/Spinner';
import Container from '@/components/Container';
import GlassPanel from '@/components/GlassPanel';
import { fetchScholarship } from '@/lib/api';
import { RevealOnScroll } from '@/lib/useIntersectionObserver';
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
        <div className="list-page min-h-screen flex items-center justify-center">
            <Spinner />
        </div>
    );

    if (!scholarship || scholarship.msg) return (
        <div className="list-page min-h-screen flex flex-col items-center justify-center text-center px-4">
            <div className="bg-slate-100 p-6 rounded-full mb-6">
                <BookOpen size={48} className="text-slate-400" />
            </div>
            <h1 className="text-3xl font-black text-slate-800 mb-2">Grant Information Not Found</h1>
            <p className="text-slate-500 mb-8 max-w-md">The scholarship record you're looking for might have been moved or archived.</p>
            <Button href="/scholarships" variant="primary">Back to Scholarships</Button>
        </div>
    );

    return (
        <div className="list-page">
            {/* Hero Section - Standard Pattern */}
            <section className="list-hero !pb-32">
                <div className="list-hero-bg" aria-hidden="true">
                    <div className="hero-orb hero-orb--1" />
                    <div className="hero-orb hero-orb--2" />
                </div>

                <Container>
                    <div className="list-hero-content">
                        <RevealOnScroll>
                            <Link href="/scholarships" className="inline-flex items-center gap-2 text-indigo-600 font-bold mb-8 hover:gap-3 transition-all">
                                <ArrowLeft size={16} /> Internal Directory
                            </Link>

                            <div className="flex flex-wrap gap-3 mb-6">
                                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-xs font-black uppercase tracking-widest">{scholarship.category}</span>
                                <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">{scholarship.provider}</span>
                            </div>

                            <h1 className="list-hero-title text-5xl md:text-6xl">{scholarship.name}</h1>

                            <div className="flex flex-wrap gap-8 mt-10">
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-amber-100 text-amber-600 rounded-2xl">
                                        <Award size={24} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">Total Award</p>
                                        <p className="text-xl font-black text-slate-800">{scholarship.amount}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
                                        <Calendar size={24} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] uppercase tracking-widest font-black text-slate-400">Final Deadline</p>
                                        <p className="text-xl font-black text-slate-800">{scholarship.deadline}</p>
                                    </div>
                                </div>
                            </div>
                        </RevealOnScroll>
                    </div>
                </Container>
            </section>

            {/* Content Section */}
            <section className="list-content-section !mt-[-80px] pb-24">
                <Container>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                        {/* Main Details */}
                        <div className="lg:col-span-2 space-y-8">
                            <RevealOnScroll delay={100}>
                                <GlassPanel className="p-10" variant="strong">
                                    <div className="flex items-center gap-4 mb-8">
                                        <div className="p-3 bg-emerald-100 text-emerald-600 rounded-2xl">
                                            <ShieldCheck size={28} />
                                        </div>
                                        <h2 className="text-2xl font-black text-slate-800">Eligibility Criteria</h2>
                                    </div>
                                    <ul className="space-y-4">
                                        {scholarship.eligibility.map((item, idx) => (
                                            <li key={idx} className="flex items-start gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-indigo-200 transition-all">
                                                <div className="mt-1.5 w-2 h-2 rounded-full bg-indigo-400 flex-shrink-0" />
                                                <span className="text-slate-700 font-bold leading-relaxed">{item}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </GlassPanel>
                            </RevealOnScroll>

                            <RevealOnScroll delay={200}>
                                <GlassPanel className="p-10" variant="strong">
                                    <div className="flex items-center gap-4 mb-8">
                                        <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl">
                                            <FileText size={28} />
                                        </div>
                                        <h2 className="text-2xl font-black text-slate-800">Documentation Needed</h2>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {[
                                            "Government Issued ID (Aadhaar/PAN)",
                                            "Verified Income Certificate",
                                            "Academic Transcripts (Last Exam)",
                                            "Institutional Admission Proof",
                                            "Bank Account Verification"
                                        ].map((doc, idx) => (
                                            <div key={idx} className="flex items-center gap-3 p-4 bg-white border border-slate-100 rounded-2xl shadow-sm">
                                                <div className="text-purple-500"><FileText size={18} /></div>
                                                <span className="text-slate-700 font-bold text-sm tracking-tight">{doc}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="mt-6 text-slate-400 text-sm font-medium italic">* Verified digital copies via DigiLocker preferred by most providers.</p>
                                </GlassPanel>
                            </RevealOnScroll>
                        </div>

                        {/* Sidebar Actions */}
                        <div className="space-y-8">
                            <RevealOnScroll delay={300}>
                                <GlassPanel className="p-8" variant="strong">
                                    <div className="text-center">
                                        {scholarship.logo ? (
                                            <div className="w-24 h-24 bg-white rounded-3xl p-4 mx-auto mb-6 shadow-xl shadow-slate-200/50 border border-slate-100 flex items-center justify-center">
                                                <img src={scholarship.logo} alt={scholarship.provider} className="max-w-full max-h-full object-contain" />
                                            </div>
                                        ) : (
                                            <div className="w-24 h-24 bg-indigo-600 rounded-3xl mx-auto mb-6 flex items-center justify-center text-white text-4xl font-black shadow-xl shadow-indigo-100">
                                                {scholarship.provider[0]}
                                            </div>
                                        )}
                                        <h3 className="text-xl font-black text-slate-800 mb-2">{scholarship.provider}</h3>
                                        <p className="text-slate-500 font-bold text-sm uppercase tracking-widest mb-8">Official Provider</p>

                                        <div className="space-y-3">
                                            <Button href={scholarship.applicationUrl} target="_blank" variant="primary" className="w-full justify-center py-4 rounded-2xl text-lg font-black shadow-lg shadow-indigo-100">
                                                Start Application
                                            </Button>
                                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Redirects to Official Portal</p>
                                        </div>
                                    </div>
                                </GlassPanel>
                            </RevealOnScroll>

                            <RevealOnScroll delay={400}>
                                <div className="bg-white/70 backdrop-blur-xl border border-indigo-100 rounded-[32px] p-8 relative overflow-hidden shadow-xl shadow-indigo-100/50">
                                    <div className="absolute top-0 right-0 p-4 opacity-5 text-indigo-900">
                                        <Zap size={80} />
                                    </div>
                                    <h4 className="text-xl font-black mb-4 flex items-center gap-2 text-indigo-600">
                                        <Zap size={20} className="text-amber-500" /> Pro Tip
                                    </h4>
                                    <p className="text-slate-600 font-bold leading-relaxed mb-6">
                                        Keep your income certificate updated (post-April for each financial year) for smoother verification on the NSP portal.
                                    </p>
                                    <Link href="https://scholarships.gov.in" target="_blank" className="inline-flex items-center gap-2 text-indigo-600 font-black text-xs uppercase tracking-widest hover:translate-x-1 transition-transform border-b-2 border-indigo-100 pb-1">
                                        Visit NSP Portal <ExternalLink size={14} />
                                    </Link>
                                </div>
                            </RevealOnScroll>
                        </div>
                    </div>
                </Container>
            </section>
        </div>
    );
}
