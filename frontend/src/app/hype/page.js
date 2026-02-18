"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Container from '@/components/Container';
import GlassPanel from '@/components/GlassPanel';
import { fetchHypeStats, postHypeVote, searchAll } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { Trophy, Search, Flame, ArrowUp, Zap, Activity, Lock, ExternalLink } from 'lucide-react';
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
    const { user, signInWithGoogle } = useAuth();
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
    const handleVote = async (e, college) => {
        e.preventDefault();
        e.stopPropagation();

        if (!user) {
            try {
                await signInWithGoogle();
            } catch (err) {
                console.error("Login failed", err);
            }
            return;
        }

        if (isVoting) return;
        setIsVoting(true);
        const collegeId = college.id || college._id;
        const userName = user.displayName || user.email.split('@')[0] || "Verified User";

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
                recentVotes: [{ collegeName: college.name, userName: userName, timestamp: new Date().toISOString() }, ...prev.recentVotes].slice(0, 10)
            };
        });

        try {
            await postHypeVote({
                collegeId: collegeId,
                collegeName: college.name,
                userId: user.uid,
                userName: userName
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
        <div className="list-page min-h-screen text-slate-900 font-sans">
            {/* Note: 'list-page' class naturally allows global bands to show. No dark overrides here. */}

            <Container>
                {/* HERO SECTION */}
                <div className="pt-12 pb-12 flex flex-col items-center text-center">
                    <RevealOnScroll>
                        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-black uppercase tracking-widest mb-6 shadow-sm">
                            <Flame size={12} className="text-orange-500 fill-orange-500 animate-pulse" /> Live Popularity Contest
                        </span>

                        <h1 className="text-4xl md:text-6xl font-black text-slate-900 mb-6 tracking-tight">
                            Campus Legends
                        </h1>
                        <p className="text-lg text-slate-600 max-w-2xl mx-auto mb-10 font-medium leading-relaxed">
                            Vote for your college and push it to the top. Login required to ensure real votes.
                        </p>

                        {/* PREMIUM SEARCH BAR (Colleges Style) */}
                        <div className="w-full max-w-2xl mx-auto relative z-50">
                            <GlassPanel className="p-2 flex items-center gap-3 shadow-lg hover:shadow-xl transition-shadow duration-300" variant="strong">
                                <Search className={`ml-3 w-5 h-5 ${isSearching ? 'text-indigo-600 animate-pulse' : 'text-slate-400'}`} />
                                <input
                                    type="text"
                                    className="flex-1 bg-transparent border-none text-lg py-3 px-2 placeholder-slate-400 focus:ring-0 text-slate-900 font-medium outline-none"
                                    placeholder="Search college to vote..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                {!user && searchQuery.length > 0 && (
                                    <div className="hidden sm:flex mr-3 text-xs text-amber-600 font-bold items-center gap-1 bg-amber-50 px-2 py-1 rounded">
                                        <Lock size={12} /> Login to Vote
                                    </div>
                                )}
                            </GlassPanel>

                            {/* SEARCH DROPDOWN */}
                            {searchQuery && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl border border-slate-100 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-50">
                                    {searchResults.length > 0 ? (
                                        <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                            {searchResults.map((college) => (
                                                <div
                                                    key={college.id}
                                                    className="w-full text-left p-4 hover:bg-slate-50 flex items-center justify-between group/item transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                                                    onClick={(e) => handleVote(e, college)}
                                                >
                                                    <div className="pr-4 min-w-0 flex-1">
                                                        <div className="font-bold text-slate-900 truncate">{college.name}</div>
                                                        <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">{college.location || "India"}</div>
                                                    </div>
                                                    <div className="shrink-0 flex items-center gap-3">
                                                        <Link
                                                            href={`/college/${college.id}`}
                                                            className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"
                                                            onClick={(e) => e.stopPropagation()}
                                                            title="View Details"
                                                        >
                                                            <ExternalLink size={16} />
                                                        </Link>
                                                        <button
                                                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 font-bold hover:bg-indigo-600 hover:text-white transition-all"
                                                            onClick={(e) => handleVote(e, college)}
                                                        >
                                                            <span>Vote</span>
                                                            <ArrowUp size={16} />
                                                        </button>
                                                    </div>
                                                </div>
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
                                        <div className="p-4 text-center text-indigo-600 text-sm font-bold animate-pulse">Searching global database...</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </RevealOnScroll>
                </div>

                {/* PODIUM SECTION (Light Mode) */}
                <div className="py-8 md:py-16 relative">
                    {top3.length > 0 ? (
                        <div className="flex flex-col md:flex-row items-end justify-center gap-6 md:gap-8 min-h-[350px]">
                            {/* 2ND PLACE (SILVER) */}
                            {top3[1] && (
                                <div className="order-2 md:order-1 flex-1 max-w-[300px] group animate-in slide-in-from-bottom-8 duration-700 delay-100">
                                    <Link href={`/college/${top3[1].id}`} className="block relative bg-white/70 backdrop-blur-md border border-slate-200 rounded-2xl p-6 flex flex-col items-center hover:-translate-y-2 transition-transform duration-300 shadow-xl shadow-slate-200/50">
                                        <div className="absolute -top-4 bg-slate-100 text-slate-600 font-black text-sm px-3 py-1 rounded-full border border-slate-200 shadow-sm">#2</div>
                                        <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-4 text-3xl shadow-inner">🥈</div>
                                        <h3 className="text-slate-900 font-bold text-center leading-tight mb-3 line-clamp-2 min-h-[3rem] w-full">{top3[1].name}</h3>
                                        <div className="px-4 py-1.5 bg-slate-100 rounded-lg text-slate-700 font-mono font-bold">{top3[1].votes}</div>
                                        <button
                                            onClick={(e) => handleVote(e, top3[1])}
                                            className="mt-4 w-full py-2 bg-white border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 rounded-lg text-sm font-bold transition-all text-slate-500"
                                        >
                                            Vote Included
                                        </button>
                                    </Link>
                                </div>
                            )}

                            {/* 1ST PLACE (GOLD) */}
                            {top3[0] && (
                                <div className="order-1 md:order-2 flex-1 max-w-[340px] z-10 -mt-12 md:-mt-16 group animate-in slide-in-from-bottom-12 duration-700">
                                    <Link href={`/college/${top3[0].id}`} className="block relative bg-gradient-to-b from-amber-50 to-white border border-amber-200 rounded-3xl p-8 flex flex-col items-center shadow-2xl shadow-amber-500/10 hover:-translate-y-3 transition-transform duration-300">
                                        <div className="absolute -top-6 bg-amber-400 text-amber-950 font-black text-lg px-4 py-2 rounded-full border-4 border-white shadow-lg">#1</div>
                                        <div className="relative mb-6">
                                            <Trophy size={64} className="text-amber-400 drop-shadow-sm" />
                                        </div>
                                        <h3 className="text-slate-900 text-xl md:text-2xl font-black text-center leading-tight mb-4 max-w-full break-words">{top3[0].name}</h3>
                                        <div className="px-6 py-2 bg-amber-100 text-amber-800 rounded-xl font-mono text-3xl font-black tracking-tight">{top3[0].votes}</div>
                                        <button
                                            onClick={(e) => handleVote(e, top3[0])}
                                            className="mt-6 w-full py-3 bg-amber-400 hover:bg-amber-500 text-amber-950 rounded-xl font-black transition-colors shadow-lg shadow-amber-500/20"
                                        >
                                            VOTE +1
                                        </button>
                                    </Link>
                                </div>
                            )}

                            {/* 3RD PLACE (BRONZE) */}
                            {top3[2] && (
                                <div className="order-3 flex-1 max-w-[300px] group animate-in slide-in-from-bottom-8 duration-700 delay-200">
                                    <Link href={`/college/${top3[2].id}`} className="block relative bg-white/70 backdrop-blur-md border border-orange-100 rounded-2xl p-6 flex flex-col items-center hover:-translate-y-2 transition-transform duration-300 shadow-xl shadow-orange-100/50">
                                        <div className="absolute -top-4 bg-orange-50 text-orange-800 font-black text-sm px-3 py-1 rounded-full border border-orange-100 shadow-sm">#3</div>
                                        <div className="w-16 h-16 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center mb-4 text-3xl shadow-inner">🥉</div>
                                        <h3 className="text-slate-900 font-bold text-center leading-tight mb-3 line-clamp-2 min-h-[3rem] w-full">{top3[2].name}</h3>
                                        <div className="px-4 py-1.5 bg-orange-50/50 rounded-lg text-orange-800 font-mono font-bold">{top3[2].votes}</div>
                                        <button
                                            onClick={(e) => handleVote(e, top3[2])}
                                            className="mt-4 w-full py-2 bg-white border border-slate-200 hover:border-indigo-500 hover:text-indigo-600 rounded-lg text-sm font-bold transition-all text-slate-500"
                                        >
                                            Vote Included
                                        </button>
                                    </Link>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-slate-400 text-center italic py-20">Leaderboard is waiting for the first champion...</div>
                    )}
                </div>

                {/* MAIN LIST & TICKER */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-24">
                    {/* LEFT: RANK LIST */}
                    <div className="lg:col-span-2 space-y-3">
                        <h3 className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-4 pl-2">The Challengers</h3>
                        {rest.map((college, idx) => (
                            <Link
                                key={college.id}
                                href={`/college/${college.id}`}
                                className="block group relative"
                            >
                                <div className="relative flex items-center gap-4 p-4 rounded-xl bg-white/60 hover:bg-white border border-slate-100 hover:border-indigo-200 shadow-sm hover:shadow-md transition-all">
                                    <div className="w-10 text-center font-mono font-bold text-slate-400 group-hover:text-indigo-600">#{idx + 4}</div>
                                    <div className="flex-1 min-w-0">
                                        <h4 className="font-bold text-slate-800 truncate group-hover:text-indigo-700 transition-colors">{college.name}</h4>
                                    </div>
                                    <div className="shrink-0 flex items-center gap-4">
                                        <span className="font-mono font-bold text-slate-500">{college.votes} <span className="text-[10px] uppercase">votes</span></span>
                                        <button
                                            onClick={(e) => handleVote(e, college)}
                                            className="p-2 rounded-lg bg-slate-50 hover:bg-indigo-600 text-slate-400 hover:text-white transition-all"
                                            title="Vote"
                                        >
                                            <ArrowUp size={16} />
                                        </button>
                                    </div>
                                </div>
                            </Link>
                        ))}
                        {rest.length === 0 && top3.length === 0 && (
                            <div className="p-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                                No data available.
                            </div>
                        )}
                    </div>

                    {/* RIGHT: LIVE FEED */}
                    <div>
                        <h3 className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-4 pl-2 flex items-center gap-2">
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Live Feed
                        </h3>
                        <GlassPanel className="p-4 space-y-4 max-h-[600px] overflow-hidden relative" variant="strong">
                            <div className="absolute top-0 inset-x-0 h-4 bg-gradient-to-b from-white to-transparent z-10 pointer-events-none"></div>
                            <div className="space-y-4">
                                {stats.recentVotes.map((vote, i) => (
                                    <div key={i} className="flex gap-3 text-sm animate-in fade-in slide-in-from-right-4 border-b border-slate-100 pb-2 last:border-0">
                                        <div className="text-indigo-500 mt-0.5"><Zap size={14} /></div>
                                        <p className="text-slate-600 leading-snug">
                                            <span className="text-slate-900 font-bold">{vote.userName || "Verified User"}</span> voted for <span className="text-indigo-600 font-bold">{vote.collegeName}</span>
                                        </p>
                                    </div>
                                ))}
                                {stats.recentVotes.length === 0 && (
                                    <div className="text-center text-slate-400 py-8 italic">No recent activity. Be the first!</div>
                                )}
                            </div>
                            <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-white to-transparent z-10 pointer-events-none"></div>
                        </GlassPanel>
                    </div>
                </div>

            </Container>
        </div>
    );
}
