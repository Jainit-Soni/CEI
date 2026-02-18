"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import NewsCard from '@/components/NewsCard';
import NewsTicker from '@/components/NewsTicker';
import Spinner from '@/components/Spinner';
import Container from '@/components/Container';
import GlassPanel from '@/components/GlassPanel';
import { fetchNews } from '@/lib/api';
import { RevealOnScroll } from '@/lib/useIntersectionObserver';
import { Flame, Bell, TrendingUp, Clock, ChevronRight, Zap } from 'lucide-react';
import "../colleges/page.css";

const CATEGORIES = ["All", "Exam Alert", "Results", "Admissions", "Policy"];

export default function NewsPage() {
    const [news, setNews] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("All");
    const [liveUpdate, setLiveUpdate] = useState(null);

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

        // SIMULATION: Fake "Live Update" to create excitement
        const timer = setTimeout(() => {
            setLiveUpdate({
                title: "JUST IN: JEE Advanced Syllabus Revised!",
                time: "Now"
            });
        }, 15000); // Trigger after 15s

        return () => clearTimeout(timer);
    }, []);

    const filteredNews = filter === "All"
        ? news
        : news.filter(item => item.category === filter);

    const heroNews = news.length > 0 ? news[0] : null;
    const listNews = news.length > 0 ? filteredNews.filter(n => n.id !== heroNews?.id) : [];

    return (
        <div className="news-page min-h-screen bg-transparent">
            <NewsTicker />

            {/* Live Toast */}
            {liveUpdate && (
                <div className="fixed bottom-8 right-8 z-50 animate-in slide-in-from-bottom-5 duration-500">
                    <div className="bg-slate-900 text-white p-4 rounded-xl shadow-2xl border border-indigo-500/50 flex items-center gap-4 max-w-xs cursor-pointer hover:scale-105 transition-transform">
                        <div className="p-2 bg-red-600 rounded-full animate-pulse">
                            <Bell size={16} fill="currentColor" />
                        </div>
                        <div>
                            <div className="text-[10px] font-bold text-red-400 uppercase tracking-widest mb-1 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span> LIVE UPDATE
                            </div>
                            <div className="font-bold text-sm leading-tight">{liveUpdate.title}</div>
                        </div>
                        <button
                            onClick={() => setLiveUpdate(null)}
                            className="ml-auto text-slate-500 hover:text-white"
                        >
                            ×
                        </button>
                    </div>
                </div>
            )}

            <Container className="pt-12 pb-24">
                {/* Header */}
                <div className="flex flex-col md:flex-row justify-between items-end mb-12 border-b border-white/20 pb-6">
                    <div>
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-600 text-xs font-black uppercase tracking-widest mb-4">
                            <Flame size={12} fill="currentColor" /> Trending Now
                        </div>
                        <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tighter">
                            Education <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-orange-500">Pulse</span>
                        </h1>
                    </div>
                    <div className="text-right hidden md:block">
                        <div className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">Last Updated</div>
                        <div className="text-2xl font-black text-slate-900 flex items-center gap-2 justify-end">
                            <Clock size={20} className="text-red-500" />
                            {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="flex justify-center py-20"><Spinner /></div>
                ) : (
                    <>
                        {/* HERO SECTION */}
                        {heroNews && filter === "All" && (
                            <section className="mb-16">
                                <RevealOnScroll>
                                    <div className="group relative h-[500px] rounded-[3rem] overflow-hidden shadow-2xl cursor-pointer">
                                        <div className="absolute inset-0 bg-slate-900">
                                            <img
                                                src={heroNews.image || "https://images.unsplash.com/photo-1523050854058-8df90110c9f1?q=80&w=2070"}
                                                alt={heroNews.title}
                                                className="w-full h-full object-cover opacity-60 group-hover:opacity-40 group-hover:scale-105 transition-all duration-700"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent" />
                                        </div>

                                        <div className="absolute bottom-0 left-0 right-0 p-8 md:p-16">
                                            <div className="mb-4 flex items-center gap-3">
                                                <span className="px-3 py-1 bg-red-600 text-white text-xs font-black uppercase tracking-widest rounded-md">
                                                    Breaking
                                                </span>
                                                <span className="text-white/80 text-sm font-bold flex items-center gap-2">
                                                    <Zap size={14} className="text-yellow-400" fill="currentColor" />
                                                    High Impact
                                                </span>
                                            </div>
                                            <h2 className="text-3xl md:text-5xl font-black text-white mb-6 leading-tight max-w-4xl group-hover:text-red-400 transition-colors">
                                                {heroNews.title}
                                            </h2>
                                            <p className="text-lg text-slate-300 max-w-2xl mb-8 line-clamp-2">
                                                {heroNews.summary}
                                            </p>
                                            <div className="flex items-center gap-4">
                                                <button className="px-8 py-3 bg-white text-slate-900 font-bold rounded-full hover:bg-red-500 hover:text-white transition-all flex items-center gap-2">
                                                    Read Full Story <ChevronRight size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </RevealOnScroll>
                            </section>
                        )}

                        {/* Filter Tabs */}
                        <div className="flex flex-wrap gap-2 mb-10">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setFilter(cat)}
                                    className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${filter === cat
                                            ? 'bg-slate-900 text-white shadow-lg scale-105'
                                            : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'
                                        }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>

                        {/* MASONRY GRID */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {listNews.map((item, idx) => (
                                <RevealOnScroll key={item.id} delay={idx * 50}>
                                    <GlassPanel className="h-full flex flex-col group cursor-pointer hover:-translate-y-2 transition-transform duration-300" variant="strong">
                                        <div className="relative h-48 -mx-6 -mt-6 mb-6 overflow-hidden rounded-t-2xl">
                                            <img
                                                src={item.image || `https://source.unsplash.com/random/800x600?education,${idx}`}
                                                alt={item.title}
                                                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                                            />
                                            <div className="absolute top-4 left-4">
                                                <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest
                                                    ${item.category === 'Exam Alert' ? 'bg-red-500 text-white' : 'bg-white/90 text-slate-900 backdrop-blur'}
                                                `}>
                                                    {item.category}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex-1 flex flex-col">
                                            <div className="flex items-center gap-2 text-xs text-slate-400 font-bold mb-3 uppercase tracking-wider">
                                                <span>{new Date(item.date).toLocaleDateString()}</span>
                                                <span>•</span>
                                                <span>{item.source}</span>
                                            </div>
                                            <h3 className="text-xl font-bold text-slate-900 mb-3 group-hover:text-indigo-600 transition-colors line-clamp-2">
                                                {item.title}
                                            </h3>
                                            <p className="text-slate-500 text-sm leading-relaxed line-clamp-3 mb-6 flex-1">
                                                {item.summary}
                                            </p>

                                            <div className="flex items-center text-xs font-bold text-indigo-600 uppercase tracking-widest group-hover:translate-x-1 transition-transform">
                                                Read More <ChevronRight size={12} />
                                            </div>
                                        </div>
                                    </GlassPanel>
                                </RevealOnScroll>
                            ))}
                        </div>

                        {listNews.length === 0 && (
                            <div className="text-center py-20 text-slate-400 italic">No news updates in this category.</div>
                        )}
                    </>
                )}
            </Container>
        </div>
    );
}
