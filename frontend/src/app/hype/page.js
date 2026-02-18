"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Container from '@/components/Container';
import GlassPanel from '@/components/GlassPanel';
import Card from '@/components/Card';
import { fetchHypeStats, postHypeVote, searchAll } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { Search, Flame, ArrowUp, Zap, Lock, Filter } from 'lucide-react';
import { RevealOnScroll } from "@/lib/useIntersectionObserver";
import "@/app/colleges/page.css"; // Ensure we inherit global college styles

// -----------------------------------------------------------------------------
// V19-PREMIUM COMPONENTS (Restored & Enhanced)
// -----------------------------------------------------------------------------

function PodiumCard({ college, rank, onVote, isVoting }) {
    if (!college) return null;

    const isGold = rank === 1;
    const isSilver = rank === 2;
    const isBronze = rank === 3;

    let glowColor = "rgba(255, 255, 255, 0)";
    if (isGold) glowColor = "rgba(245, 158, 11, 0.4)"; // Amber
    if (isSilver) glowColor = "rgba(148, 163, 184, 0.4)"; // Slate
    if (isBronze) glowColor = "rgba(253, 186, 116, 0.4)"; // Orange

    return (
        <div className={`relative group ${isGold ? 'order-2 -mt-10 z-20' : isSilver ? 'order-1 mt-4 z-10' : 'order-3 mt-8 z-0'}`}>
            {/* Ambient Glow */}
            <div
                className="absolute inset-0 blur-3xl rounded-full opacity-60 pointer-events-none transition-all duration-1000 group-hover:opacity-100"
                style={{ background: glowColor, transform: 'scale(1.2)' }}
            />

            <div className={`relative flex flex-col items-center text-center p-6 rounded-3xl border backdrop-blur-2xl transition-all duration-300 group-hover:-translate-y-2
                ${isGold ? 'bg-white/60 border-amber-200/50 w-[320px] h-[400px] shadow-[0_20px_60px_-15px_rgba(245,158,11,0.3)]' : ''}
                ${isSilver ? 'bg-white/40 border-slate-200/50 w-[280px] h-[360px] shadow-[0_20px_60px_-15px_rgba(148,163,184,0.2)]' : ''}
                ${isBronze ? 'bg-white/40 border-orange-200/50 w-[280px] h-[340px] shadow-[0_20px_60px_-15px_rgba(253,186,116,0.2)]' : ''}
            `}>
                {/* RANK BADGE */}
                <div className={`absolute -top-6 px-6 py-2 rounded-full text-xs font-bold tracking-widest shadow-lg uppercase
                    ${isGold ? 'bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 text-white' : ''}
                    ${isSilver ? 'bg-gradient-to-r from-slate-300 via-slate-400 to-slate-500 text-white' : ''}
                    ${isBronze ? 'bg-gradient-to-r from-orange-300 via-orange-400 to-orange-500 text-white' : ''}
                `}>
                    {isGold ? 'Champion #1' : isSilver ? 'Silver #2' : 'Bronze #3'}
                </div>

                {/* CONTENT */}
                <div className="flex-1 flex flex-col justify-center items-center w-full mt-4">
                    <h3 className={`font-bold leading-tight line-clamp-2 mb-2 ${isGold ? 'text-2xl text-slate-800' : 'text-xl text-slate-700'}`}>
                        {college.name}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-slate-500 font-medium mb-6">
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                        {college.location || "India"}
                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                    </div>

                    <div className="flex flex-col items-center gap-1 mb-8">
                        <span className={`text-5xl font-black tracking-tighter ${isGold ? 'text-amber-500' : isSilver ? 'text-slate-500' : 'text-orange-500'}`}>
                            {college.votes}
                        </span>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Votes</span>
                    </div>
                </div>

                {/* VOTE BUTTON (FLOATING OVER EDGE) */}
                <button
                    onClick={(e) => onVote(e, college)}
                    disabled={isVoting}
                    className={`absolute -bottom-6 flex items-center gap-2 px-8 py-4 rounded-full text-sm font-bold shadow-xl transition-all active:scale-95 hover:shadow-2xl
                        ${isGold ? 'bg-slate-900 text-white hover:bg-black' : 'bg-white text-slate-900 border border-slate-100 hover:bg-slate-50'}
                    `}
                >
                    <ArrowUp size={16} className={isVoting ? 'animate-bounce' : ''} />
                    {isVoting ? 'Voting...' : 'VOTE NOW'}
                </button>
            </div>
        </div>
    );
}

function RankRow({ college, index, onVote, isVoting }) {
    return (
        <div className="group relative flex items-center gap-4 p-4 rounded-2xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:scale-[1.01] transition-all duration-300">
            <div className="w-12 h-12 flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 font-bold text-lg">
                #{index + 4}
            </div>

            <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-800 truncate text-lg">{college.name}</div>
                <div className="text-sm text-slate-500 flex items-center gap-2">
                    {college.location}
                    <span className="w-1 h-1 bg-slate-300 rounded-full" />
                    <span className="text-slate-400">{college.votes} Votes</span>
                </div>
            </div>

            <button
                onClick={(e) => onVote(e, college)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-indigo-600 hover:text-white transition-colors"
                title="Vote"
            >
                <ArrowUp size={18} />
            </button>
        </div>
    );
}

// -----------------------------------------------------------------------------
// MAIN PAGE
// -----------------------------------------------------------------------------

export default function HypePage() {
    const { user, signInWithGoogle } = useAuth();
    const [stats, setStats] = useState({ leaderboard: [], recentVotes: [] });
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isVoting, setIsVoting] = useState(false);

    // Initial Data Load
    useEffect(() => {
        const load = async () => {
            try {
                const statsData = await fetchHypeStats();
                setStats(statsData);
            } catch (err) {
                console.error("Failed to load hype data:", err);
            }
        };
        load();
        const interval = setInterval(() => {
            fetchHypeStats().then(setStats).catch(console.error);
        }, 10000); // 10s refresh
        return () => clearInterval(interval);
    }, []);

    // Debounce Search
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearchQuery(searchQuery);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    // Search Logic
    useEffect(() => {
        const performSearch = async () => {
            if (!debouncedSearchQuery.trim()) {
                setSearchResults([]);
                return;
            }
            try {
                const data = await searchAll({ q: debouncedSearchQuery });
                setSearchResults((data.colleges || []).slice(0, 8)); // Limit to 8
            } catch (err) {
                console.error("Search failed:", err);
            }
        };
        performSearch();
    }, [debouncedSearchQuery]);

    const handleVote = async (e, college) => {
        e.preventDefault();
        e.stopPropagation();

        if (!user) {
            try {
                await signInWithGoogle();
            } catch (err) { console.error(err); }
            return;
        }

        if (isVoting) return;
        setIsVoting(true);

        const collegeId = college.id || college._id;
        const userName = user.displayName || user.email.split('@')[0] || "User";

        // Optimistic Update
        setStats(prev => {
            const newLeaderboard = [...prev.leaderboard];
            const existingIndex = newLeaderboard.findIndex(c => c.id === collegeId);

            if (existingIndex >= 0) {
                newLeaderboard[existingIndex] = { ...newLeaderboard[existingIndex], votes: newLeaderboard[existingIndex].votes + 1 };
            } else {
                newLeaderboard.push({ id: collegeId, name: college.name, votes: 1, location: college.location });
            }

            // Re-sort
            newLeaderboard.sort((a, b) => b.votes - a.votes);

            return {
                ...prev,
                leaderboard: newLeaderboard,
                recentVotes: [{ collegeName: college.name, userName: userName, timestamp: new Date().toISOString() }, ...prev.recentVotes].slice(0, 10)
            };
        });

        try {
            await postHypeVote({ collegeId, collegeName: college.name, userId: user.uid, userName });
            setSearchQuery("");
            setSearchResults([]);
        } catch (err) {
            console.error("Vote failed:", err);
        } finally {
            setIsVoting(false);
        }
    };

    const top3 = stats.leaderboard.slice(0, 3);
    const rest = stats.leaderboard.slice(3, 50); // Limit total to 50

    // DERIVED STATS FOR TICKER
    const totalVotes = stats.leaderboard.reduce((acc, curr) => acc + (curr.votes || 0), 0);
    const activeColleges = stats.leaderboard.length;
    // const topState = top3[0]?.location?.split(',').pop()?.trim() || "India"; // REMOVED as per user request

    return (
        <div className="min-h-screen bg-[#F8FAFC] relative overflow-hidden font-sans text-slate-900 selection:bg-amber-100 selection:text-amber-900">

            {/* GLOBAL BACKGROUND FX */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[70vw] h-[70vw] bg-purple-200/30 rounded-full mix-blend-multiply filter blur-[100px] animate-blob"></div>
                <div className="absolute top-[-20%] right-[-10%] w-[70vw] h-[70vw] bg-blue-200/30 rounded-full mix-blend-multiply filter blur-[100px] animate-blob animation-delay-2000"></div>
                <div className="absolute bottom-[-20%] left-[20%] w-[70vw] h-[70vw] bg-pink-200/30 rounded-full mix-blend-multiply filter blur-[100px] animate-blob animation-delay-4000"></div>
            </div>

            <div className="relative z-10 pb-32">
                {/* 1. HERO - ENHANCED WITH STATS (EXAMS STYLE) */}
                <section className="pt-32 pb-12 flex flex-col items-center text-center px-4 overflow-hidden">
                    <RevealOnScroll>
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/50 border border-white/50 backdrop-blur-md shadow-sm mb-8">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                            </span>
                            <span className="text-xs font-bold tracking-widest uppercase text-slate-500">Live Popularity Contest</span>
                        </div>

                        <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-slate-900 via-slate-800 to-slate-500 drop-shadow-sm">
                            Campus Legends
                        </h1>
                        <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto leading-relaxed mb-12">
                            Who runs this city? Vote for your college and prove that your campus has the strongest community in India.
                        </p>

                        {/* LIVE STATS TICKER (EXAMS STYLE) */}
                        <div className="flex flex-col items-center w-full">
                            <div className="flex flex-wrap justify-center gap-8 md:gap-16 border-t border-slate-200/60 pt-8 max-w-4xl mx-auto mb-8">
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-3xl font-black text-slate-800 tracking-tight">{totalVotes.toLocaleString()}</span>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Votes</span>
                                </div>
                                <div className="w-px h-12 bg-slate-200/60 hidden md:block"></div>
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-3xl font-black text-slate-800 tracking-tight">{activeColleges}</span>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Colleges Active</span>
                                </div>
                            </div>

                            {/* DOPAMINE TICKER (MARQUEE) */}
                            {stats.recentVotes && stats.recentVotes.length > 0 && (
                                <div className="w-full overflow-hidden bg-slate-900/5 py-3 border-y border-slate-200/50 backdrop-blur-sm">
                                    <div className="relative flex items-center gap-8 whitespace-nowrap animate-marquee">
                                        {[...stats.recentVotes, ...stats.recentVotes, ...stats.recentVotes].map((vote, i) => (
                                            <div key={i} className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                                                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                                <span className="font-bold text-slate-900">{vote.userName}</span>
                                                <span className="text-slate-400">voted for</span>
                                                <span className="font-bold text-indigo-600">{vote.collegeName}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <style jsx>{`
                                        @keyframes marquee {
                                            0% { transform: translateX(0); }
                                            100% { transform: translateX(-50%); }
                                        }
                                        .animate-marquee {
                                            animation: marquee 30s linear infinite;
                                        }
                                        .animate-marquee:hover {
                                            animation-play-state: paused;
                                        }
                                    `}</style>
                                </div>
                            )}
                        </div>
                    </RevealOnScroll>
                </section>

                <Container className="max-w-6xl">

                    {/* 2. STANDARD SEARCH PANEL (Reverted from Floating Pill) */}
                    <div className="mb-12">
                        <GlassPanel className="filters-panel !p-6" variant="strong">
                            <div className="filter-search">
                                <Search className="text-slate-400 w-5 h-5 shrink-0" />
                                <input
                                    type="text"
                                    className="filter-search-input w-full bg-transparent border-none focus:ring-0 text-lg font-medium placeholder-slate-400 text-slate-800 ml-4"
                                    placeholder="Search for your college to vote..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            {/* DROPDOWN RESULTS */}
                            {searchQuery && (
                                <div className="mt-2 bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                    {searchResults.length > 0 ? (
                                        searchResults.map(college => (
                                            <div
                                                key={college.id}
                                                onClick={(e) => handleVote(e, college)}
                                                className="p-4 hover:bg-slate-50 cursor-pointer flex justify-between items-center border-b border-slate-100 last:border-0 group/item transition-colors"
                                            >
                                                <div>
                                                    <div className="font-bold text-slate-800 group-hover/item:text-indigo-600 transition-colors">{college.name}</div>
                                                    <div className="text-xs text-slate-500">{college.location}</div>
                                                </div>
                                                <div className="px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-lg opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                    VOTE
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-8 text-center text-slate-400">
                                            No colleges found matching "{searchQuery}"
                                        </div>
                                    )}
                                </div>
                            )}
                        </GlassPanel>
                    </div>

                    {/* 3. THE PODIUM (TOP 3) */}
                    {top3.length > 0 && (
                        <div className="mb-24 flex flex-col md:flex-row justify-center items-end gap-6 md:gap-8 min-h-[450px]">
                            {/* SILVER (2) */}
                            {top3[1] && <PodiumCard college={top3[1]} rank={2} onVote={handleVote} isVoting={isVoting} />}

                            {/* GOLD (1) */}
                            <RevealOnScroll>
                                <PodiumCard college={top3[0]} rank={1} onVote={handleVote} isVoting={isVoting} />
                            </RevealOnScroll>

                            {/* BRONZE (3) */}
                            {top3[2] && <PodiumCard college={top3[2]} rank={3} onVote={handleVote} isVoting={isVoting} />}
                        </div>
                    )}

                    {/* 4. THE REST (#4 - #50) - BENTO WRAPPED (EXAMS STYLE) */}
                    <RevealOnScroll>
                        <GlassPanel className="filters-panel !p-8 !rounded-[2.5rem] !bg-white/40 !border-white/50 !backdrop-blur-xl !shadow-sm" variant="strong">
                            <div className="flex items-center justify-between mb-8 px-4">
                                <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Challengers</h3>
                                <div className="text-sm font-medium text-slate-500">
                                    {rest.length > 0 ? `Showing Top ${rest.length}` : 'Loading Challengers...'}
                                </div>
                            </div>

                            <div className="space-y-3">
                                {rest.map((college, i) => (
                                    <RankRow key={college.id} college={college} index={i} onVote={handleVote} isVoting={isVoting} />
                                ))}

                                {stats.leaderboard.length === 0 && (
                                    <div className="py-20 text-center text-slate-400 animate-pulse">
                                        Calculating popularity scores...
                                    </div>
                                )}
                            </div>
                        </GlassPanel>
                    </RevealOnScroll>
                </Container>
            </div>

            {/* VERSION MARKER - V26 DOPAMINE */}
            <div className="fixed bottom-2 right-2 text-[10px] text-slate-300 pointer-events-none z-50 opacity-50">
                v2.6-dopamine-fixed
            </div>
        </div>
    );
}
