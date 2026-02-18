"use client";

import React, { useState, useEffect } from 'react';
import ScholarshipCard from '@/components/ScholarshipCard';
import Spinner from '@/components/Spinner';
import Container from '@/components/Container';
import GlassPanel from '@/components/GlassPanel';
import { fetchScholarships } from '@/lib/api';
import { RevealOnScroll } from '@/lib/useIntersectionObserver';
import { GraduationCap, Search, Globe, Award, BookOpen } from 'lucide-react';
import "../colleges/page.css";

const CATEGORIES = ["All", "State Govt", "Central Govt", "Private", "Merit-based", "Means-based"];

export default function ScholarshipsPage() {
    const [scholarships, setScholarships] = useState([]);
    const [filteredScholarships, setFilteredScholarships] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("All");

    useEffect(() => {
        fetchScholarships()
            .then(data => {
                setScholarships(data);
                setFilteredScholarships(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load scholarships:", err);
                setLoading(false);
            });
    }, []);

    useEffect(() => {
        let result = scholarships;
        if (filter !== "All") {
            result = result.filter(s => s.category?.includes(filter) || s.type === filter);
        }
        setFilteredScholarships(result);
    }, [filter, scholarships]);

    return (
        <div className="list-page min-h-screen bg-transparent">
            {/* Hero Section */}
            <section className="relative pt-32 pb-20 overflow-hidden">
                {/* Global orbs provide background */}

                <Container className="relative z-10 text-center">
                    <RevealOnScroll>
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 border border-slate-200 text-emerald-600 text-xs font-bold uppercase tracking-widest mb-6 backdrop-blur-md shadow-sm">
                            <Award size={14} /> Financial Aid Portal
                        </div>
                        <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter mb-8">
                            Scholarship <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-cyan-500">Directory</span>
                        </h1>
                        <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed mb-8">
                            Access over ₹500 Cr+ in educational grants. From government schemes to private fellowships.
                        </p>

                        <button className="px-8 py-4 rounded-full bg-slate-900 text-white font-bold tracking-wide hover:bg-slate-800 transition-all shadow-lg hover:shadow-slate-900/25 flex items-center gap-2 mx-auto">
                            <BookOpen size={18} /> Internal Directory
                        </button>
                    </RevealOnScroll>
                </Container>
            </section>

            <Container className="pb-24">
                {/* Filter Bar */}
                <div className="mb-12 sticky top-24 z-30">
                    <GlassPanel className="p-2 border-white/60 backdrop-blur-xl bg-white/80 shadow-2xl flex justify-center" variant="strong">
                        <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto custom-scrollbar justify-center">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setFilter(cat)}
                                    className={`px-6 py-3 rounded-xl text-sm font-bold whitespace-nowrap transition-all duration-300 ${filter === cat
                                        ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 scale-105'
                                        : 'bg-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                                        }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </GlassPanel>
                </div>

                {/* All Scholarships Grid */}
                {loading ? (
                    <div className="flex justify-center py-20"><Spinner /></div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredScholarships.map(scholarship => (
                            <ScholarshipCard key={scholarship.id} scholarship={scholarship} />
                        ))}
                    </div>
                )}
            </Container>
        </div>
    );
}
