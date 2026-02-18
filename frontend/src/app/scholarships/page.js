"use client";

import React, { useState, useEffect } from 'react';
import ScholarshipCard from '@/components/ScholarshipCard';
import Spinner from '@/components/Spinner';
import Container from '@/components/Container';
import { fetchScholarships } from '@/lib/api';
// NO EXTERNAL CSS IMPORT to ensure perfect control

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
        <div className="min-h-screen bg-transparent pt-32 pb-32">
            <Container>
                {/* 1. Minimalist Header */}
                <div className="text-center mb-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 mb-6 font-display">
                        The Grant Ledger.
                    </h1>
                    <p className="text-lg md:text-xl text-slate-500 font-medium max-w-2xl mx-auto leading-relaxed">
                        Curated financial opportunities for the ambitious student.
                    </p>
                </div>

                {/* 2. Floating Filter Pills */}
                <div className="flex justify-center mb-20 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-100">
                    <div className="inline-flex flex-wrap justify-center gap-3 p-2 bg-white/50 backdrop-blur-xl rounded-full border border-slate-200/60 shadow-sm">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setFilter(cat)}
                                className={`px-6 py-2.5 rounded-full text-sm font-semibold transition-all duration-300 ${filter === cat
                                        ? 'bg-slate-900 text-white shadow-md transform scale-105'
                                        : 'text-slate-500 hover:text-slate-900 hover:bg-white/80'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* 3. The Crystal Grid */}
                {loading ? (
                    <div className="flex justify-center py-32"><Spinner /></div>
                ) : filteredScholarships.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
                        {filteredScholarships.map((scholarship) => (
                            <ScholarshipCard key={scholarship.id} scholarship={scholarship} />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-32">
                        <p className="text-slate-400 text-lg">No entries found for "{filter}".</p>
                        <button
                            onClick={() => setFilter("All")}
                            className="mt-4 text-slate-900 font-bold hover:underline"
                        >
                            Reset View
                        </button>
                    </div>
                )}

                {/* 4. Directory Access (Bottom Banner) - Minimalist */}
                <div className="mt-40 animate-in fade-in duration-1000 delay-500">
                    <div className="group relative overflow-hidden rounded-3xl bg-slate-900 text-white p-12 md:p-20 text-center shadow-2xl transition-transform hover:scale-[1.01] duration-500">
                        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.05)_50%,transparent_75%,transparent_100%)] bg-[length:250%_250%,100%_100%] animate-[shimmer_8s_infinite] pointer-events-none" />

                        <h2 className="text-3xl md:text-5xl font-bold mb-6 tracking-tight relative z-10">The Internal Database</h2>
                        <p className="text-slate-400 max-w-xl mx-auto text-lg mb-10 relative z-10">
                            Access our proprietary list of micro-scholarships and alumni grants not listed publicly.
                        </p>

                        <button className="relative z-10 px-8 py-4 bg-white text-slate-900 rounded-full font-bold hover:bg-slate-100 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1">
                            Request Access
                        </button>
                    </div>
                </div>
            </Container>
        </div>
    );
}
