"use client";

import React, { useState, useEffect } from 'react';
import NewsTicker from '@/components/NewsTicker';
import Spinner from '@/components/Spinner';
import Container from '@/components/Container';
import { fetchNews } from '@/lib/api';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
// NO EXTERNAL CSS to prevent conflicts

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

    // Split for magazine layout
    const featuredStory = filteredNews[0];
    const subStories = filteredNews.slice(1);

    return (
        <div className="min-h-screen bg-transparent pt-32 pb-32">
            <Container>
                {/* 1. Header & Ticker */}
                <div className="border-b border-slate-200 pb-8 mb-12 flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-4">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Live Intelligence</span>
                        </div>
                        <h1 className="text-6xl md:text-9xl font-black tracking-tighter text-slate-900 leading-[0.8]">
                            THE NEWS.
                        </h1>
                    </div>
                    {/* Categories as clean text links */}
                    <div className="flex flex-wrap gap-6 mb-2">
                        {CATEGORIES.map(cat => (
                            <button
                                key={cat}
                                onClick={() => setFilter(cat)}
                                className={`text-sm font-bold uppercase tracking-widest transition-colors ${filter === cat
                                        ? 'text-slate-900 decoration-2 underline underline-offset-4'
                                        : 'text-slate-400 hover:text-slate-600'
                                    }`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-24"><Spinner /></div>
                ) : filteredNews.length > 0 ? (
                    <div className="space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-1000">

                        {/* 2. Featured Story (Magazine Style) */}
                        {featuredStory && (
                            <div className="group cursor-pointer grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                <div className="lg:col-span-8 overflow-hidden rounded-[32px] bg-slate-100 aspect-[16/9] relative">
                                    <img
                                        src={featuredStory.image || `https://source.unsplash.com/random/1200x800?university`}
                                        alt={featuredStory.title}
                                        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-105"
                                    />
                                </div>
                                <div className="lg:col-span-4 flex flex-col h-full justify-center pt-4">
                                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-indigo-600 mb-4">
                                        <span>{featuredStory.category}</span>
                                        <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                        <span className="text-slate-400">{new Date(featuredStory.date).toLocaleDateString()}</span>
                                    </div>
                                    <h2 className="text-4xl md:text-5xl font-bold text-slate-900 leading-[1.1] mb-6 group-hover:text-indigo-900 transition-colors">
                                        {featuredStory.title}
                                    </h2>
                                    <p className="text-lg text-slate-500 leading-relaxed mb-8">
                                        {featuredStory.summary}
                                    </p>
                                    <div className="flex items-center gap-3 text-sm font-bold text-slate-900 group-hover:gap-4 transition-all">
                                        Read Full Story <ArrowRight size={18} />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 3. Sub Grid (Strict 3-Col) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-8 gap-y-16 border-t border-slate-200 pt-16">
                            {subStories.map((item) => (
                                <div key={item.id} className="group cursor-pointer flex flex-col">
                                    <div className="aspect-[3/2] overflow-hidden rounded-2xl bg-slate-100 mb-6 font-display">
                                        <img
                                            src={item.image || `https://source.unsplash.com/random/800x600?campus,${item.id}`}
                                            alt={item.title}
                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
                                        <span className="text-indigo-600">{item.category}</span>
                                    </div>
                                    <h3 className="text-2xl font-bold text-slate-900 leading-tight mb-3 group-hover:underline decoration-2 underline-offset-4">
                                        {item.title}
                                    </h3>
                                    <p className="text-slate-500 text-sm leading-relaxed mb-4 line-clamp-2">
                                        {item.summary}
                                    </p>
                                    <div className="mt-auto pt-4 border-t border-slate-100 flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-400">{item.source}</span>
                                        <ArrowUpRight size={16} className="text-slate-300 group-hover:text-indigo-600 transition-colors" />
                                    </div>
                                </div>
                            ))}
                        </div>

                    </div>
                ) : (
                    <div className="text-center py-32 text-slate-400 italic">No updates available.</div>
                )}
            </Container>
        </div>
    );
}
