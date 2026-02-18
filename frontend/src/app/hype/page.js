"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Container from '@/components/Container';
import GlassPanel from '@/components/GlassPanel';
import { fetchColleges } from '@/lib/api';
import { Trophy, TrendingUp, ArrowUp, Clock, Activity } from 'lucide-react';
import { RevealOnScroll } from "@/lib/useIntersectionObserver";
import "../colleges/page.css";

// Simulated "Live" Activity Feed
const MOCK_ACTIVITIES = [
    { user: "Rahul S.", action: "voted for", college: "IIT Bombay", time: "2s ago" },
    { user: "Ananya M.", action: "voted for", college: "SRCC Delhi", time: "12s ago" },
    { user: "Vikram", action: "voted for", college: "BITS Pilani", time: "45s ago" },
    { user: "Sarah J.", action: "voted for", college: "IIM Ahmedabad", time: "1m ago" },
    { user: "Karan", action: "voted for", college: "FMS Delhi", time: "2m ago" },
];

export default function HypePage() {
    const [colleges, setColleges] = useState([]);
    const [timeFilter, setTimeFilter] = useState("today"); // today, week, all-time
    const [votes, setVotes] = useState({}); // Local vote state simulation

    useEffect(() => {
        const load = async () => {
            try {
                const data = await fetchColleges();
                const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
                setColleges(list);

                // Initialize mock votes based on placement/rating to simulate "hype"
                const initialVotes = {};
                list.forEach(c => {
                    // Random base votes for simulation + reliable metric boost
                    const base = Math.floor(Math.random() * 50) + 10;
                    const boost = (c.rating || 0) * 20;
                    initialVotes[c.id || c._id] = Math.floor(base + boost);
                });
                setVotes(initialVotes);
            } catch (err) {
                console.error("Failed to load leaderboard:", err);
            }
        };
        load();
    }, []);

    // Simulate "Real-time" vote updates
    useEffect(() => {
        const interval = setInterval(() => {
            if (colleges.length === 0) return;
            const randomCollege = colleges[Math.floor(Math.random() * colleges.length)];
            const id = randomCollege.id || randomCollege._id;

            setVotes(prev => ({
                ...prev,
                [id]: (prev[id] || 0) + 1
            }));
        }, 5000); // New vote every 5 seconds

        return () => clearInterval(interval);
    }, [colleges]);

    const handleVote = (id) => {
        setVotes(prev => ({
            ...prev,
            [id]: (prev[id] || 0) + 1
        }));
    };

    const sortedColleges = useMemo(() => {
        return [...colleges].sort((a, b) => {
            const idA = a.id || a._id;
            const idB = b.id || b._id;
            return (votes[idB] || 0) - (votes[idA] || 0);
        }).slice(0, 10); // Top 10
    }, [colleges, votes]);

    return (
        <div className="list-page min-h-screen">
            <section className="list-hero list-hero--scholarships">
                <div className="list-hero-bg" aria-hidden="true">
                    <div className="hero-orb hero-orb--1" />
                    <div className="hero-orb hero-orb--2" />
                </div>

                <Container>
                    <div className="list-hero-content text-center">
                        <RevealOnScroll>
                            <span className="list-hero-kicker"><Activity size={16} className="inline mr-2" /> Live Voting</span>
                            <h1 className="list-hero-title">Campus Hype Board</h1>
                            <p className="list-hero-subtitle mx-auto max-w-2xl">
                                The daily leaderboard of India's most trending colleges. Upvote your campus to the top.
                            </p>
                        </RevealOnScroll>
                    </div>
                </Container>
            </section>

            <section className="list-results pt-8 pb-24">
                <Container>
                    <div className="flex flex-col lg:flex-row gap-8">
                        {/* Main Leaderboard */}
                        <div className="flex-1">
                            <GlassPanel className="p-0 overflow-hidden" variant="default">
                                {/* Tabs */}
                                <div className="flex items-center gap-1 p-2 border-b border-slate-100 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
                                    {['today', 'week', 'all-time'].map((t) => (
                                        <button
                                            key={t}
                                            onClick={() => setTimeFilter(t)}
                                            className={`px-4 py-2 rounded-lg text-sm font-bold capitalize transition-all ${timeFilter === t ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:bg-white/50'}`}
                                        >
                                            {t.replace('-', ' ')}
                                        </button>
                                    ))}
                                </div>

                                <div className="divide-y divide-slate-100">
                                    {sortedColleges.map((college, idx) => {
                                        const id = college.id || college._id;
                                        const voteCount = votes[id] || 0;
                                        const rank = idx + 1;

                                        return (
                                            <div key={id} className="group flex items-center gap-4 p-4 hover:bg-white/60 transition-colors">
                                                <div className="text-xl font-black text-slate-300 w-8 text-center">{rank}</div>

                                                <div className="w-12 h-12 rounded-xl bg-white border border-slate-100 p-2 flex items-center justify-center shadow-sm">
                                                    <img src={college.logo || "/placeholder-logo.png"} alt="logo" className="w-full h-full object-contain" />
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <h3 className="font-bold text-slate-900 text-lg truncate">{college.name}</h3>
                                                    <p className="text-sm text-slate-500 truncate">{college.subtitle || college.location || "Top Tier Institute"}</p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {rank <= 3 && <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-100 flex items-center gap-1"><Trophy size={10} /> Trending</span>}
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">ROI: {Math.floor((college.rating || 4) * 20)}%</span>
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => handleVote(id)}
                                                    className="flex flex-col items-center justify-center w-16 h-16 border border-slate-200 rounded-xl bg-gradient-to-b from-white to-slate-50 hover:to-white hover:border-indigo-300 hover:shadow-md active:scale-95 transition-all group"
                                                >
                                                    <ArrowUp size={20} className="text-slate-400 group-hover:text-indigo-600 transition-colors" />
                                                    <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-900">{voteCount}</span>
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>

                                {colleges.length === 0 && (
                                    <div className="p-12 text-center text-slate-400">Loading Leaderboard...</div>
                                )}
                            </GlassPanel>
                        </div>

                        {/* Sidebar: Live Feed */}
                        <div className="w-full lg:w-80 space-y-6">
                            <GlassPanel className="p-6" variant="strong">
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Live Activity
                                </h3>
                                <div className="space-y-4">
                                    {MOCK_ACTIVITIES.map((act, i) => (
                                        <div key={i} className="flex gap-3 text-sm animate-in fade-in slide-in-from-right-4" style={{ animationDelay: `${i * 100}ms` }}>
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0">
                                                {act.user.charAt(0)}
                                            </div>
                                            <div>
                                                <p className="text-slate-700 leading-snug">
                                                    <span className="font-bold">{act.user}</span> {act.action} <span className="font-bold text-indigo-600">{act.college}</span>
                                                </p>
                                                <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5"><Clock size={10} /> {act.time}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </GlassPanel>

                            <div className="p-4 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-xl relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-8 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <Trophy size={120} />
                                </div>
                                <h3 className="text-lg font-bold mb-2 relative z-10">Add Your College?</h3>
                                <p className="text-indigo-100 text-sm mb-4 relative z-10">Don't see your campus listed? Submit it for the next daily cycle.</p>
                                <button className="w-full py-2 bg-white text-indigo-600 font-bold rounded-lg hover:bg-indigo-50 transition-colors relative z-10">Submit Campus</button>
                            </div>
                        </div>
                    </div>
                </Container>
            </section>
        </div>
    );
}
