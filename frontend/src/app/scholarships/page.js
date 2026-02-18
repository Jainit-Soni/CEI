"use client";

import React, { useState, useEffect } from 'react';
import ScholarshipCard from '@/components/ScholarshipCard';
import Spinner from '@/components/Spinner';
import Container from '@/components/Container';
import { fetchScholarships } from '@/lib/api';
import { RevealOnScroll } from '@/lib/useIntersectionObserver';
import { BookOpen, Filter, ArrowRight } from 'lucide-react';
import "../colleges/page.css"; // Ensure global styles are loaded

const CATEGORIES = ["All", "State Govt", "Central Govt", "Private", "Merit-Based", "Means-Based"];

export default function ScholarshipsPage() {
    const [scholarships, setScholarships] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("All");

    useEffect(() => {
        fetchScholarships()
            .then(data => {
                setScholarships(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load scholarships:", err);
                setLoading(false);
            });
    }, []);

    const filteredScholarships = filter === "All"
        ? scholarships
        : scholarships.filter(s => s.category?.toLowerCase() === filter.toLowerCase() || s.category === filter);

    return (
        <div className="min-h-screen bg-transparent pt-32 pb-20">
            {/* Header - Minimalist */}
            <Container>
                <RevealOnScroll>
                    <div className="text-center mb-20">
                        <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-slate-900 mb-6">
                            The Grant Ledger
                        </h1>
                        <p className="text-xl text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed">
                            Curated financial opportunities for the ambitious student.
                        </p>
                    </div>
                </RevealOnScroll>

                {/* Filters - Floating Pills */}
                <div className="flex justify-center mb-16">
                    <div className="flex flex-wrap gap-3 justify-center">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setFilter(cat)}
                                className={`px-6 py-2 rounded-full text-sm font-semibold transition-all duration-300 border ${filter === cat
                                        ? 'bg-slate-900 text-white border-slate-900 shadow-lg'
                                        : 'bg-white/50 text-slate-500 border-transparent hover:bg-white hover:shadow-sm'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Grid - Clean & Structured */}
                {loading ? (
                    <div className="flex justify-center py-20"><Spinner /></div>
                ) : filteredScholarships.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {filteredScholarships.map((scholarship, idx) => (
                            <RevealOnScroll key={scholarship.id} delay={idx * 50}>
                                <ScholarshipCard scholarship={scholarship} />
                            </RevealOnScroll>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-24">
                        <p className="text-slate-400 text-lg">No entries found for "{filter}".</p>
                        <button
                            onClick={() => setFilter("All")}
                            className="mt-4 text-slate-900 font-bold hover:underline"
                        >
                            Reset View
                        </button>
                    </div>
                )}

                {/* Internal Directory - Sleek Bottom Banner */}
                <div className="mt-32">
                    <RevealOnScroll>
                        <div className="relative overflow-hidden rounded-3xl bg-slate-900 text-white p-12 md:p-16 flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl">
                            <div className="relative z-10">
                                <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Exclusive Access</div>
                                <h2 className="text-3xl md:text-4xl font-bold mb-4">The Internal Database</h2>
                                <p className="text-slate-400 max-w-md text-lg">
                                    Our proprietary list of micro-scholarships and alumni grants.
                                </p>
                            </div>
                            <div className="relative z-10 flex-shrink-0">
                                <button className="px-8 py-4 bg-white text-slate-900 rounded-xl font-bold hover:bg-slate-100 transition-colors flex items-center gap-3">
                                    Access Database <ArrowRight size={18} />
                                </button>
                            </div>

                            {/* Subtle texture */}
                            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10" />
                        </div>
                    </RevealOnScroll>
                </div>
            </Container>
        </div>
    );
}
