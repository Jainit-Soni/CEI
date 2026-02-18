"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Container from '@/components/Container';
import GlassPanel from '@/components/GlassPanel';
import Card from '@/components/Card';
import { fetchHypeStats, postHypeVote, searchAll } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { Search, Flame, ArrowUp, Zap, Lock } from 'lucide-react';
import { RevealOnScroll } from "@/lib/useIntersectionObserver";
import "../colleges/page.css"; // IMPORTANT: Inherit all styles from Colleges page

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
            try {
                const data = await searchAll({ q: debouncedSearchQuery });
                setSearchResults(data.colleges || []);
            } catch (err) {
                console.error("Search failed:", err);
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
        <div className="list-page min-h-screen">
            {/* HERO SECTION MATCHING COLLEGES PAGE EXACTLY */}
            <section className="list-hero list-hero--colleges">
                <div className="list-hero-bg" aria-hidden="true">
                    <div className="hero-orb hero-orb--1" />
                    <div className="hero-orb hero-orb--2" />
                </div>

                <Container>
                    <div className="list-hero-content">
                        <RevealOnScroll>
                            <span className="list-hero-kicker flex items-center justify-center gap-2">
                                <Flame size={12} className="text-orange-500 fill-orange-500 animate-pulse" /> Live Popularity Contest
                            </span>
                            <h1 className="list-hero-title">
                                Campus Legends
                            </h1>
                            <p className="list-hero-subtitle">
                                Vote for your college and push it to the top. Login required to ensure real votes.
                            </p>
                        </RevealOnScroll>
                    </div>
                </Container>
            </section>

            {/* SEARCH SECTION - MIRRORING COLLEGES FILTERS PANEL */}
            <section className="list-filters-section" style={{ display: 'block', position: 'relative', marginTop: '-40px' }}>
                <Container>
                    <GlassPanel className="filters-panel" variant="strong">
                        {/* EXACT SEARCH STRUCTURE FROM COLLEGES PAGE */}
                        <div className="filter-search">
                            <input
                                type="search"
                                className="filter-search-input"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search college to vote..."
                            />
                            {!user && searchQuery.length > 0 && (
                                <div className="text-xs text-amber-600 font-bold flex items-center gap-1 bg-amber-50 px-2 py-1 rounded">
                                    <Lock size={12} /> Login to Vote
                                </div>
                            )}
                        </div>

                        {/* DROPDOWN RESULTS (If searching) */}
                        {searchQuery && (
                            <div className="absolute top-full left-0 right-0 mx-6 mt-2 bg-white rounded-xl border border-slate-100 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-50">
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
                                                <button
                                                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 font-bold hover:bg-indigo-600 hover:text-white transition-all"
                                                    onClick={(e) => handleVote(e, college)}
                                                >
                                                    <span>Vote</span>
                                                    <ArrowUp size={16} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="p-4 text-center text-slate-500 text-sm">No matches found.</div>
                                )}
                            </div>
                        )}

                        <div className="filter-meta justify-center mt-4">
                            <span className="filter-count text-center w-full">
                                <strong>{stats.recentVotes.length > 0 ? stats.recentVotes.length : "0"}</strong> Recent Votes Cast
                            </span>
                        </div>
                    </GlassPanel>
                </Container>
            </section>

            {/* RESULTS SECTION */}
            <section className="list-results pt-12">
                <Container>
                    {/* TOP 3 AS CARDS (Fixed Grid) */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 items-end">
                        {/* 2ND PLACE */}
                        {top3[1] && (
                            <div className="order-2 md:order-1 relative group">
                                <div className="absolute -top-3 left-4 z-10 bg-slate-100 text-slate-600 font-black text-xs px-2 py-1 rounded border border-slate-200 shadow-sm">#2 SILVER</div>
                                <Card
                                    type="college"
                                    title={top3[1].name}
                                    subtitle={`🥈 ${top3[1].votes} Votes`}
                                    href={`/college/${top3[1].id}`}
                                    data={top3[1]}
                                    badge={{ text: "Silver", color: "#94a3b8" }}
                                />
                                <button
                                    onClick={(e) => handleVote(e, top3[1])}
                                    className="absolute bottom-4 right-4 z-20 px-3 py-1 bg-slate-900 text-white text-xs font-bold rounded shadow-lg hover:bg-indigo-600 transition-colors"
                                >
                                    VOTE
                                </button>
                            </div>
                        )}

                        {/* 1ST PLACE */}
                        {top3[0] && (
                            <div className="order-1 md:order-2 relative group -mt-8 md:-mt-12 z-10 transform scale-105">
                                <div className="absolute -top-3 left-4 z-10 bg-amber-400 text-amber-950 font-black text-xs px-2 py-1 rounded border border-amber-500 shadow-sm">#1 GOLD</div>
                                <Card
                                    type="college"
                                    title={top3[0].name}
                                    subtitle={`🏆 ${top3[0].votes} Votes`}
                                    href={`/college/${top3[0].id}`}
                                    data={top3[0]}
                                    badge={{ text: "CHAMPION", color: "#f59e0b" }}
                                />
                                <button
                                    onClick={(e) => handleVote(e, top3[0])}
                                    className="absolute bottom-4 right-4 z-20 px-4 py-2 bg-amber-500 text-white text-sm font-black roundedShadow-lg hover:bg-amber-600 transition-colors shadow-amber-500/20"
                                >
                                    VOTE +1
                                </button>
                            </div>
                        )}

                        {/* 3RD PLACE */}
                        {top3[2] && (
                            <div className="order-3 md:order-3 relative group">
                                <div className="absolute -top-3 left-4 z-10 bg-orange-100 text-orange-800 font-black text-xs px-2 py-1 rounded border border-orange-200 shadow-sm">#3 BRONZE</div>
                                <Card
                                    type="college"
                                    title={top3[2].name}
                                    subtitle={`🥉 ${top3[2].votes} Votes`}
                                    href={`/college/${top3[2].id}`}
                                    data={top3[2]}
                                    badge={{ text: "Bronze", color: "#fdba74" }}
                                />
                                <button
                                    onClick={(e) => handleVote(e, top3[2])}
                                    className="absolute bottom-4 right-4 z-20 px-3 py-1 bg-slate-900 text-white text-xs font-bold rounded shadow-lg hover:bg-indigo-600 transition-colors"
                                >
                                    VOTE
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-24">
                        {/* LEFT: RANK LIST (Compact Rows) */}
                        <div className="lg:col-span-2 space-y-4">
                            <h3 className="text-slate-400 font-bold uppercase tracking-widest text-xs mb-4 pl-2">The Challengers</h3>
                            {rest.map((college, idx) => (
                                <Link
                                    key={college.id}
                                    href={`/college/${college.id}`}
                                    className="block group relative"
                                >
                                    <div className="relative flex items-center gap-4 p-4 rounded-xl bg-white border border-slate-100 hover:border-indigo-200 shadow-sm hover:shadow-md transition-all">
                                        <div className="w-8 text-center font-mono font-bold text-slate-400 group-hover:text-indigo-600">#{idx + 4}</div>
                                        <div className="flex-1 min-w-0">
                                            <h4 className="font-bold text-slate-900 truncate group-hover:text-indigo-700 transition-colors">{college.name}</h4>
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
            </section>
        </div>
    );
}
