"use client";

import React, { useState, useEffect } from 'react';
import Container from '@/components/Container';
import { fetchHypeStats, postHypeVote, searchAll } from '@/lib/api';
import { Trophy, Search, Flame, ArrowUp, Zap, Activity } from 'lucide-react';
import { RevealOnScroll } from "@/lib/useIntersectionObserver";
import "../colleges/page.css";

// Simple debounce hook
function useDebounce(value, delay) {
    const [debouncedValue, setDebouncedValue] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);
        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);
    return debouncedValue;
}

export default function HypePage() {
    const [stats, setStats] = useState({ leaderboard: [], recentVotes: [] });
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isVoting, setIsVoting] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    const debouncedSearchQuery = useDebounce(searchQuery, 300);

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

    // Server-Side Search
    useEffect(() => {
        const performSearch = async () => {
            if (!debouncedSearchQuery.trim()) {
                setSearchResults([]);
                return;
            }
            setIsSearching(true);
            try {
                const data = await searchAll({ q: debouncedSearchQuery });
                setSearchResults(data.colleges || []);
            } catch (err) {
                console.error("Search failed:", err);
            } finally {
                setIsSearching(false);
            }
        };
        performSearch();
    }, [debouncedSearchQuery]);

    // Vote Handler
    const handleVote = async (college) => {
        if (isVoting) return;
        setIsVoting(true);
        const collegeId = college.id || college._id;

        // Optimistic Update
        setStats(prev => {
            const newLeaderboard = [...prev.leaderboard];
            const existingIndex = newLeaderboard.findIndex(c => c.id === collegeId);
            if (existingIndex >= 0) {
                newLeaderboard[existingIndex] = { ...newLeaderboard[existingIndex], votes: newLeaderboard[existingIndex].votes + 1 };
            } else {
                newLeaderboard.push({ id: collegeId, name: college.name, votes: 1 });
            }
            newLeaderboard.sort((a, b) => b.votes - a.votes);
            return {
                ...prev,
                leaderboard: newLeaderboard,
                recentVotes: [{ collegeName: college.name, userName: "You", timestamp: new Date().toISOString() }, ...prev.recentVotes].slice(0, 10)
            };
        });

        try {
            await postHypeVote({
                collegeId: collegeId,
                collegeName: college.name,
                userId: "session-user-" + Date.now(),
                userName: "Anonymous"
            });
            setSearchQuery("");
            setSearchResults([]);
        } catch (err) {
            console.error("Vote failed:", err);
        } finally {
            setIsVoting(false);
        }
    };

    const top3 = stats.leaderboard.slice(0, 3);
    const rest = stats.leaderboard.slice(3, 20);

    return (
        <div className="min-h-screen bg-[#020617] text-white selection:bg-indigo-500 selection:text-white font-sans overflow-hidden">
            {/* BACKGROUND EFFECTS */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[20%] w-[600px] h-[600px] bg-indigo-600/20 rounded-full blur-[120px] mix-blend-screen animate-pulse-slow" />
                <div className="absolute bottom-[-10%] right-[-5%] w-[500px] h-[500px] bg-purple-600/10 rounded-full blur-[100px] mix-blend-screen" />
            </div>

            <div className="relative z-10">
                <Container>
                    {/* HEADER & SEARCH */}
                    <div className="pt-24 pb-12 flex flex-col items-center text-center">
                        <RevealOnScroll>
                            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-indigo-400 text-xs font-black uppercase tracking-widest backdrop-blur-md mb-8 shadow-lg shadow-indigo-900/20">
                                <Flame size={12} className="text-orange-500 fill-orange-500 animate-pulse" /> Global Live Leaderboard
                            </span>

                            <h1 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400 mb-6 tracking-tight drop-shadow-sm">
                                Campus Legends
                            </h1>
                            <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-12 font-medium leading-relaxed">
                                Vote for your college and push it to the top. Real-time global rankings.
                            </p>

                            {/* NEON SEARCH BAR */}
                            <div className="relative w-full max-w-2xl mx-auto group z-50">
                                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 rounded-2xl blur opacity-30 group-hover:opacity-60 transition duration-500 group-focus-within:opacity-100 group-focus-within:blur-md"></div>
                                <div className="relative flex items-center bg-[#0B1121] rounded-2xl border border-white/10 shadow-2xl">
                                    <Search className={`ml-5 w-6 h-6 ${isSearching ? 'text-indigo-400 animate-pulse' : 'text-slate-500'}`} />
                                    <input
                                        type="text"
                                        className="w-full bg-transparent border-none text-xl py-5 px-4 placeholder-slate-600 focus:ring-0 text-white font-bold"
                                        placeholder="Type your college name..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        autoFocus
                                    />
                                </div>

                                {/* SEARCH DROPDOWN */}
                                {searchQuery && (
                                    <div className="absolute top-full left-0 right-0 mt-3 bg-[#0B1121]/95 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 ring-1 ring-white/5">
                                        {searchResults.length > 0 ? (
                                            <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                                {searchResults.map((college) => (
                                                    <button
                                                        key={college.id}
                                                        onClick={() => handleVote(college)}
                                                        className="w-full text-left p-4 hover:bg-white/5 flex items-center justify-between group/item transition-colors border-b border-white/5 last:border-0"
                                                    >
                                                        <div className="pr-4 min-w-0">
                                                            <div className="font-bold text-slate-100 truncate">{college.name}</div>
                                                            <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">{college.location || "India"}</div>
                                                        </div>
                                                        <div className="shrink-0 flex items-center gap-2 text-indigo-400 font-bold opacity-0 group-hover/item:opacity-100 transition-opacity translate-x-2 group-hover/item:translate-x-0">
                                                            <span>VOTE</span>
                                                            <ArrowUp size={16} />
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        ) : (
                                            !isSearching && (
                                                <div className="p-8 text-center text-slate-500">
                                                    <p className="text-sm font-medium">No colleges found matching "{searchQuery}"</p>
                                                </div>
                                            )
                                        )}
                                        {isSearching && (
                                            <div className="p-4 text-center text-indigo-400 text-sm font-bold animate-pulse">Searching global database...</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </RevealOnScroll>
                    </div>

                    {/* PODIUM SECTION */}
                    <div className="py-12 md:py-20 relative">
                        {top3.length > 0 ? (
                            <div className="flex flex-col md:flex-row items-end justify-center gap-6 md:gap-12 min-h-[350px]">
                                {/* 2ND PLACE (SILVER) */}
                                {top3[1] && (
                                    <div className="order-2 md:order-1 flex-1 max-w-[300px] group animate-in slide-in-from-bottom-8 duration-700 delay-100">
                                        <div className="relative bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700/50 rounded-2xl p-6 flex flex-col items-center hover:-translate-y-2 transition-transform duration-300">
                                            <div className="absolute -top-5 bg-slate-700 text-slate-300 font-black text-sm px-3 py-1 rounded-full border border-slate-600 shadow-xl">#2</div>
                                            <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center mb-4 text-3xl shadow-inner shadow-black/50">🥈</div>
                                            <h3 className="text-slate-100 font-bold text-center leading-tight mb-3 line-clamp-2 min-h-[3rem] w-full">{top3[1].name}</h3>
                                            <div className="px-4 py-1.5 bg-slate-800 rounded-lg text-slate-300 font-mono font-bold">{top3[1].votes}</div>
                                        </div>
                                    </div>
                                )}

                                {/* 1ST PLACE (GOLD) */}
                                {top3[0] && (
                                    <div className="order-1 md:order-2 flex-1 max-w-[340px] z-10 -mt-12 md:-mt-16 group animate-in slide-in-from-bottom-12 duration-700">
                                        <div className="relative bg-gradient-to-b from-amber-900/40 to-[#1a1205] border border-amber-500/30 rounded-3xl p-8 flex flex-col items-center shadow-2xl shadow-amber-900/20 hover:-translate-y-3 transition-transform duration-300">
                                            <div className="absolute -inset-1 bg-gradient-to-b from-amber-500/20 to-transparent rounded-3xl blur-md opacity-50"></div>
                                            <div className="absolute -top-6 bg-amber-500 text-amber-950 font-black text-lg px-4 py-2 rounded-full border border-amber-400 shadow-xl shadow-amber-500/40">#1</div>
                                            <div className="relative mb-6">
                                                <Trophy size={64} className="text-amber-400 drop-shadow-[0_0_15px_rgba(251,191,36,0.5)]" />
                                            </div>
                                            <h3 className="text-white text-xl md:text-2xl font-black text-center leading-tight mb-4 max-w-full break-words">{top3[0].name}</h3>
                                            <div className="px-6 py-2 bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-xl font-mono text-3xl font-black tracking-tight">{top3[0].votes}</div>
                                        </div>
                                    </div>
                                )}

                                {/* 3RD PLACE (BRONZE) */}
                                {top3[2] && (
                                    <div className="order-3 flex-1 max-w-[300px] group animate-in slide-in-from-bottom-8 duration-700 delay-200">
                                        <div className="relative bg-gradient-to-b from-[#3a2018] to-[#1a0f0d] border border-orange-800/50 rounded-2xl p-6 flex flex-col items-center hover:-translate-y-2 transition-transform duration-300">
                                            <div className="absolute -top-5 bg-orange-800 text-orange-200 font-black text-sm px-3 py-1 rounded-full border border-orange-700 shadow-xl">#3</div>
                                            <div className="w-16 h-16 rounded-full bg-orange-900/30 flex items-center justify-center mb-4 text-3xl shadow-inner shadow-black/50">🥉</div>
                                            <h3 className="text-slate-100 font-bold text-center leading-tight mb-3 line-clamp-2 min-h-[3rem] w-full">{top3[2].name}</h3>
                                            <div className="px-4 py-1.5 bg-orange-900/20 rounded-lg text-orange-300 font-mono font-bold">{top3[2].votes}</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-slate-600 text-center italic py-20">Leaderboard is waiting for the first champion...</div>
                        )}
                    </div>

                    {/* MAIN LIST & TICKER */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-24">
                        {/* LEFT: RANK LIST */}
                        <div className="lg:col-span-2 space-y-3">
                            <h3 className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-4 pl-2">The Challengers</h3>
                            {rest.map((college, idx) => (
                                <div key={college.id} className="group relative">
                                    <div className="absolute inset-0 bg-indigo-500/0 group-hover:bg-indigo-500/5 rounded-xl transition-colors"></div>
                                    <div className="relative flex items-center gap-4 p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:border-indigo-500/30 transition-all">
                                        <div className="w-10 text-center font-mono font-bold text-slate-500 group-hover:text-indigo-400">#{idx + 4}</div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-slate-200 truncate group-hover:text-white transition-colors">{college.name}</h4>
                                        </div>
                                        <div className="shrink-0 flex items-center gap-4">
                                            <span className="font-mono font-bold text-slate-400">{college.votes} <span className="text-[10px] uppercase">votes</span></span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {rest.length === 0 && top3.length === 0 && (
                                <div className="p-8 text-center text-slate-600 border border-white/5 rounded-xl bg-white/[0.02]">
                                    No data available.
                                </div>
                            )}
                        </div>

                        {/* RIGHT: LIVE FEED */}
                        <div>
                            <h3 className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-4 pl-2 flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Live Feed
                            </h3>
                            <div className="bg-[#0f172a] border border-white/5 rounded-2xl p-4 space-y-4 max-h-[600px] overflow-hidden relative">
                                <div className="absolute top-0 inset-x-0 h-8 bg-gradient-to-b from-[#0f172a] to-transparent z-10 pointer-events-none"></div>
                                <div className="space-y-4">
                                    {stats.recentVotes.map((vote, i) => (
                                        <div key={i} className="flex gap-3 text-sm animate-in fade-in slide-in-from-right-4">
                                            <div className="text-indigo-400 mt-0.5"><Zap size={14} /></div>
                                            <p className="text-slate-400 leading-snug">
                                                <span className="text-slate-200 font-bold">{vote.userName || "Someone"}</span> just voted for <span className="text-indigo-300 font-bold">{vote.collegeName}</span>
                                            </p>
                                        </div>
                                    ))}
                                </div>
                                <div className="absolute bottom-0 inset-x-0 h-24 bg-gradient-to-t from-[#0f172a] to-transparent z-10 pointer-events-none"></div>
                            </div>
                        </div>
                    </div>

                </Container>
            </div>
        </div>
    );
}
