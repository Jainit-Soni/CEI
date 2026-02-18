"use client";

import React, { useState, useEffect } from 'react';
import { Search, Trophy, TrendingUp, ThumbsUp, Sparkles, Zap } from 'lucide-react';
import Container from '@/components/Container';
import GlassPanel from '@/components/GlassPanel';
import { fetchHypeStats, postHypeVote, fetchColleges } from '@/lib/api';
import { RevealOnScroll } from '@/lib/useIntersectionObserver';
import "../colleges/page.css";

export default function HypePage() {
    const [leaderboard, setLeaderboard] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [votingFor, setVotingFor] = useState(null);

    // Mock User
    const mockUser = { uid: "user-x", name: "Student" };

    const fetchStats = async () => {
        setLoading(true);
        try {
            const data = await fetchHypeStats();
            // Ensure data.leaderboard exists
            setLeaderboard(data.leaderboard || []);
        } catch (err) {
            console.error("Failed to fetch hype stats:", err);
            // Fallback for visual testing if API fails
            setLeaderboard([
                { collegeId: "1", collegeName: "IIT Bombay", votes: 2450 },
                { collegeId: "2", collegeName: "IIT Delhi", votes: 2100 },
                { collegeId: "3", collegeName: "BITS Pilani", votes: 1950 },
            ]);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchStats();
    }, []);

    useEffect(() => {
        let isMounted = true;
        if (search.length > 2) {
            fetchColleges({ q: search }) // Changed 'search' to 'q' to match likely API param
                .then(data => {
                    if (isMounted) {
                        // Handle both array/object return types from fetchColleges
                        const results = Array.isArray(data) ? data : (data.data || []);
                        setSearchResults(results.slice(0, 5));
                    }
                })
                .catch(err => console.error(err));
        } else {
            setSearchResults([]);
        }
        return () => { isMounted = false; };
    }, [search]);

    const handleVote = async (college) => {
        setVotingFor(college.id);
        try {
            await postHypeVote({
                collegeId: college.id,
                collegeName: college.name,
                userId: mockUser.uid,
                userName: mockUser.name
            });
            setSearch("");
            setSearchResults([]);
            fetchStats();
        } catch (err) {
            console.error(err);
            alert("Vote failed. Please try again.");
        }
        setVotingFor(null);
    };

    return (
        <div className="list-page min-h-screen bg-transparent text-slate-900">
            {/* Hero */}
            <section className="relative pt-32 pb-20 overflow-hidden">
                {/* Global orbs provide background */}

                <Container className="relative z-10 text-center">
                    <RevealOnScroll>
                        <div className="inline-flex items-center justify-center p-4 bg-white/60 rounded-full shadow-xl mb-8 border border-white/60 backdrop-blur-md">
                            <Trophy size={32} className="text-yellow-500 drop-shadow-sm" />
                        </div>
                        <h1 className="text-5xl md:text-8xl font-black text-slate-900 tracking-tighter mb-8">
                            Campus <span className="text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-orange-600">Wars</span>
                        </h1>
                        <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed font-medium">
                            The ultimate popularity leaderboard. Vote for your college to push it to the top of the charts.
                        </p>
                    </RevealOnScroll>

                    {/* Vote Search */}
                    <div className="mt-12 relative max-w-xl mx-auto z-50">
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search & Vote for your college..."
                                className="w-full pl-6 pr-4 py-5 rounded-2xl bg-white/80 border border-slate-200 shadow-xl backdrop-blur-xl focus:ring-2 focus:ring-yellow-500/50 outline-none text-lg font-bold text-slate-900 placeholder:text-slate-400 transition-all focus:bg-white"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-yellow-500 text-white rounded-xl shadow-lg shadow-yellow-500/30">
                                <Search size={20} />
                            </div>
                        </div>

                        {searchResults.length > 0 && (
                            <div className="absolute top-full left-0 right-0 mt-4 bg-white/95 border border-slate-200 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-top-2 text-left">
                                {searchResults.map(college => (
                                    <button
                                        key={college.id || college._id || Math.random()} // Fallback key
                                        className="w-full text-left p-4 hover:bg-slate-50 border-b border-slate-100 last:border-0 flex justify-between items-center group transition-colors"
                                        onClick={() => handleVote(college)}
                                        disabled={votingFor === college.id}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-xs font-bold group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                                                {college.name.substring(0, 1)}
                                            </div>
                                            <span className="font-bold text-slate-900 group-hover:text-indigo-700 transition-colors">{college.name}</span>
                                        </div>
                                        {votingFor === college.id ? (
                                            <span className="text-xs font-bold text-yellow-600 animate-pulse">VOTING...</span>
                                        ) : (
                                            <span className="flex items-center gap-2 text-xs font-black px-3 py-1 bg-yellow-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0 shadow-sm">
                                                <Zap size={12} fill="white" /> VOTE
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </Container>
            </section>

            {/* Leaderboard */}
            <section className="pb-24">
                <Container>
                    <div className="max-w-4xl mx-auto">
                        <GlassPanel className="p-0 overflow-hidden border-white/60 shadow-2xl backdrop-blur-xl bg-white/60" variant="strong">
                            <div className="bg-slate-50/80 p-4 grid grid-cols-12 gap-4 text-xs font-black uppercase tracking-[0.2em] text-slate-500 border-b border-slate-100">
                                <div className="col-span-2 text-center">Rank</div>
                                <div className="col-span-7">Institution</div>
                                <div className="col-span-3 text-right pr-4">Hype Score</div>
                            </div>

                            {loading ? (
                                <div className="p-20 text-center">
                                    <div className="w-12 h-12 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                    <div className="text-slate-500 font-mono text-xs">CALCULATING HYPE...</div>
                                </div>
                            ) : leaderboard.length > 0 ? (
                                <div className="divide-y divide-slate-100">
                                    {leaderboard.map((item, idx) => (
                                        <div key={item.collegeId || idx} className="grid grid-cols-12 gap-4 p-5 items-center hover:bg-white/80 transition-colors group">
                                            <div className="col-span-2 text-center flex justify-center">
                                                {idx === 0 ? <div className="text-3xl drop-shadow-sm">🥇</div> :
                                                    idx === 1 ? <div className="text-3xl drop-shadow-sm">🥈</div> :
                                                        idx === 2 ? <div className="text-3xl drop-shadow-sm">🥉</div> :
                                                            <span className="font-black text-slate-400 text-lg group-hover:text-slate-600">#{idx + 1}</span>}
                                            </div>
                                            <div className="col-span-7">
                                                <div className="font-bold text-lg text-slate-900 group-hover:text-indigo-900 transition-colors">{item.collegeName}</div>
                                                {idx < 3 && <div className="text-[10px] text-yellow-600 font-bold uppercase tracking-widest flex items-center gap-1 mt-1"><TrendingUp size={10} /> Trending</div>}
                                            </div>
                                            <div className="col-span-3 text-right">
                                                <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-slate-100 rounded-full border border-slate-200 font-black text-slate-600 group-hover:text-yellow-600 group-hover:border-yellow-200 group-hover:bg-yellow-50 transition-all shadow-sm">
                                                    <ThumbsUp size={14} className={idx < 3 ? "text-yellow-500" : "text-slate-400"} /> {item.votes}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-20 text-center text-slate-400">
                                    <Sparkles size={48} className="mx-auto mb-4 opacity-20" />
                                    <p className="text-lg font-bold text-slate-600">No votes recorded yet.</p>
                                    <p className="text-sm">Be the first to create hype for your college!</p>
                                </div>
                            )}
                        </GlassPanel>
                    </div>
                </Container>
            </section>
        </div>
    );
}
