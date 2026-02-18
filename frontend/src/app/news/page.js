"use client";

import React, { useState, useEffect } from 'react';
import NewsTicker from '@/components/NewsTicker';
import Spinner from '@/components/Spinner';
import Container from '@/components/Container';
import { fetchNews } from '@/lib/api';
import { RevealOnScroll } from '@/lib/useIntersectionObserver';
import { ArrowRight, Clock } from 'lucide-react';
import "../colleges/page.css";

const CATEGORIES = ["All", "Exam Alert", "Results", "Admissions", "Policy"];

export default function NewsPage() {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("All");

    useEffect(() => {
        fetchNews()
            .then(data => {
                setNews(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load news:", err);
                setLoading(false);
            });
    }, []);

    const filteredNews = filter === "All"
        ? news
        : news.filter(item => item.category === filter);

    return (
        <div className="min-h-screen bg-transparent pt-32 pb-20">
            {/* Minimalist Ticker - embedded in page flow, not generic component if needed, 
                but re-using component if it can be styled. For "peak", let's use the component 
                but likely user wants it CLEAN. We'll use the existing but maybe refine it separately.
                For now, placing it at top.
            */}
            <div className="mb-20">
                <NewsTicker />
            </div>

            <Container>
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-20 gap-8">
                    <div>
                        <h1 className="text-6xl md:text-8xl font-semibold tracking-tighter text-slate-900 mb-2">
                            The Feed
                        </h1>
                        <p className="text-xl text-slate-500 font-medium">Real-time intelligence for the academic world.</p>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex flex-wrap gap-4">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setFilter(cat)}
                                className={`text-sm font-bold uppercase tracking-widest transition-colors ${filter === cat
                                        ? 'text-slate-900 border-b-2 border-slate-900 pb-1'
                                        : 'text-slate-400 hover:text-slate-600'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Masonry Grid - Strict Spacing */}
                {loading ? (
                    <div className="flex justify-center py-20"><Spinner /></div>
                ) : filteredNews.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 md:gap-12">
                        {filteredNews.map((item, idx) => (
                            <RevealOnScroll key={item.id} delay={idx * 50}>
                                <div className="group cursor-pointer flex flex-col h-full bg-white rounded-2xl overflow-hidden border border-slate-200 hover:shadow-xl transition-all duration-300">
                                    {/* Image Top - Fixed Ratio */}
                                    <div className="aspect-[4/3] overflow-hidden bg-slate-100 relative">
                                        <img
                                            src={item.image || `https://source.unsplash.com/random/800x600?education,${idx}`}
                                            alt={item.title}
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                        />
                                        <div className="absolute top-4 left-4 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-900">
                                            {item.category}
                                        </div>
                                    </div>

                                    {/* Text Bottom - Clean White Background */}
                                    <div className="p-8 flex-1 flex flex-col">
                                        <div className="flex items-center gap-2 text-xs text-slate-400 font-bold uppercase tracking-widest mb-4">
                                            <span>{new Date(item.date).toLocaleDateString()}</span>
                                            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                            <span>{item.source}</span>
                                        </div>

                                        <h3 className="text-2xl font-bold text-slate-900 mb-4 leading-tight group-hover:text-indigo-600 transition-colors">
                                            {item.title}
                                        </h3>

                                        <p className="text-slate-500 leading-relaxed mb-8 line-clamp-3">
                                            {item.summary}
                                        </p>

                                        <div className="mt-auto flex items-center gap-2 text-sm font-bold text-slate-900 group-hover:gap-3 transition-all">
                                            Read Story <ArrowRight size={16} />
                                        </div>
                                    </div>
                                </div>
                            </RevealOnScroll>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-32 text-slate-400 italic">No updates available.</div>
                )}
            </Container>
        </div>
    );
}
