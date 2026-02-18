"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Container from '@/components/Container';
import GlassPanel from '@/components/GlassPanel';
import Card from '@/components/Card'; // Import Premium Card
import { fetchHypeStats, postHypeVote, searchAll } from '@/lib/api'; // Added searchAll
import { Trophy, Search, Flame, ArrowUp, Activity } from 'lucide-react';
import { RevealOnScroll } from "@/lib/useIntersectionObserver";

import "../colleges/page.css";

// Simple debounce function if lodash is not available, but usually it is in Next.js projects or we can write one.
// Writing a simple hook-friendly debounce here to be safe and dependency-free for this file.
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
    // Removed allColleges (client-side list)
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]); // Server-side results
    const [isVoting, setIsVoting] = useState(false);
    const [isSearching, setIsSearching] = useState(false);

    // Debounce search query
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
        }, 10000);
        return () => clearInterval(interval);
    }, []);

    // Perform Server-Side Search
    useEffect(() => {
        const performSearch = async () => {
            if (!debouncedSearchQuery.trim()) {
                setSearchResults([]);
                return;
            }

            setIsSearching(true);
            try {
                // Use the main search API which searches the FULL database
                const data = await searchAll({ q: debouncedSearchQuery });
                // API returns { colleges: [], exams: [] }
                setSearchResults(data.colleges || []);
            } catch (err) {
                console.error("Search failed:", err);
            } finally {
                setIsSearching(false);
            }
        };

        performSearch();
    }, [debouncedSearchQuery]);


    // Handle Vote
    const handleVote = async (college) => {
        if (isVoting) return;
        setIsVoting(true);

        const collegeId = college.id || college._id;

        // Optimistic Update
        setStats(prev => {
            const newLeaderboard = [...prev.leaderboard];
            const existingIndex = newLeaderboard.findIndex(c => c.id === collegeId);

            if (existingIndex >= 0) {
                newLeaderboard[existingIndex] = {
                    ...newLeaderboard[existingIndex],
                    votes: newLeaderboard[existingIndex].votes + 1
                };
            } else {
                newLeaderboard.push({ id: collegeId, name: college.name, votes: 1 });
            }

            newLeaderboard.sort((a, b) => b.votes - a.votes);

            return {
                ...prev,
                leaderboard: newLeaderboard,
                recentVotes: [
                    {
                        collegeName: college.name,
                        userName: "You",
                        timestamp: new Date().toISOString()
                    },
                    ...prev.recentVotes
                ].slice(0, 10)
            };
        });

        try {
            await postHypeVote({
                collegeId: collegeId,
                collegeName: college.name,
                userId: "session-user-" + Date.now(),
                userName: "Anonymous Student"
            });
            setSearchQuery(""); // Clear search
            setSearchResults([]);
        } catch (err) {
            console.error("Vote failed:", err);
        } finally {
            setIsVoting(false);
        }
    };

    const top3 = stats.leaderboard.slice(0, 3);
    const rest = stats.leaderboard.slice(3, 15); // Show Top 4-15 (smaller batch for cleaner UI)

    return (
        <div className="list-page min-h-screen bg-slate-50">
            {/* 1. HERO: Huge Search Input */}
            <section className="relative pt-24 pb-12 px-4 overflow-visible">
                <div className="absolute inset-0 z-0 bg-gradient-to-b from-indigo-900 via-slate-900 to-slate-900 rounded-b-[3rem] overflow-hidden">
                    <div className="hero-orb hero-orb--1 opacity-40" />
                    <div className="hero-orb hero-orb--2 opacity-40" />
                </div>

                <Container className="relative z-10">
                    <div className="max-w-3xl mx-auto text-center mb-12">
                        <RevealOnScroll>
                            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-indigo-300 text-xs font-bold uppercase tracking-widest backdrop-blur-md border border-white/10 mb-6">
                                <Flame size={12} className="text-orange-500" /> Live Popularity Contest
                            </span>
                            <h1 className="text-4xl md:text-6xl font-black text-white mb-6 tracking-tight">
                                Who runs the campus?
                            </h1>
                            <p className="text-lg text-slate-300 mb-10">
                                Real-time votes. No fake numbers. Search your college from the <b>entire database</b> and push it to the top.
                            </p>

                            {/* SEARCH BAR */}
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-25 group-focus-within:opacity-75 transition duration-500"></div>
                                <div className="relative flex items-center bg-white rounded-2xl shadow-2xl p-2 transition-transform transform group-focus-within:scale-[1.02]">
                                    <Search className={`text-slate-400 ml-4 w-6 h-6 ${isSearching ? 'animate-pulse text-indigo-500' : ''}`} />
                                    <input
                                        type="text"
                                        className="w-full bg-transparent border-none text-xl p-4 placeholder-slate-400 focus:ring-0 text-slate-900 font-bold"
                                        placeholder="Search any college to vote..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        autoFocus
                                    />
                                </div>

                                {/* Results Dropdown */}
                                {searchQuery && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                                        {searchResults.length > 0 ? (
                                            searchResults.map(college => (
                                                <button
                                                    key={college.id || college._id}
                                                    onClick={() => handleVote(college)}
                                                    disabled={isVoting}
                                                    className="w-full text-left p-4 hover:bg-indigo-50 flex items-center justify-between group/item transition-colors border-b border-slate-50 last:border-0"
                                                >
                                                    <div>
                                                        <div className="font-bold text-slate-900 text-lg">{college.name}</div>
                                                        <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">{college.location || "India"}</div>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-indigo-600 font-bold opacity-0 group-hover/item:opacity-100 transition-opacity translate-x-2 group-hover/item:translate-x-0">
                                                        <span>Vote</span>
                                                        <ArrowUp size={16} />
                                                    </div>
                                                </button>
                                            ))
                                        ) : (
                                            !isSearching && (
                                                <div className="p-8 text-center text-slate-500">
                                                    <p className="font-bold text-slate-700 mb-1">No colleges found</p>
                                                    <p className="text-xs">Try searching for the full name or city.</p>
                                                </div>
                                            )
                                        )}
                                        {isSearching && (
                                            <div className="p-4 text-center text-slate-400 text-sm animate-pulse">Searching database...</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </RevealOnScroll>
                    </div>
                </Container>
            </section>

            {/* 2. PODIUM (Top 3) */}
            <section className="pt-20 pb-12 -mt-20 relative z-20">
                <Container>
                    {top3.length > 0 ? (
                        <div className="flex flex-col md:flex-row items-end justify-center gap-4 md:gap-8 min-h-[300px] mb-16">
                            {/* Silver */}
                            {top3[1] && (
                                <div className="order-2 md:order-1 w-full md:w-1/3 max-w-[280px] animate-in slide-in-from-bottom-8 duration-700 delay-100">
                                    <div className="relative bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-slate-200 shadow-xl flex flex-col items-center hover:scale-105 transition-transform">
                                        <div className="absolute -top-6 w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center font-black text-slate-600 border-4 border-white shadow-md">2</div>
                                        <div className="h-16 w-16 mb-4 rounded-full bg-slate-50 border border-slate-100 p-2 flex items-center justify-center">
                                            <span className="text-4xl">🥈</span>
                                        </div>
                                        <h3 className="font-bold text-slate-900 text-center leading-tight mb-2">{top3[1].name}</h3>
                                        <span className="font-black text-2xl text-slate-700">{top3[1].votes}</span>
                                        <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Votes</span>
                                    </div>
                                </div>
                            )}

                            {/* Gold */}
                            {top3[0] && (
                                <div className="order-1 md:order-2 w-full md:w-1/3 max-w-[300px] z-10 -mt-12 md:-mt-16 animate-in slide-in-from-bottom-12 duration-700">
                                    <div className="relative bg-gradient-to-b from-yellow-50 to-white rounded-2xl p-8 border border-yellow-100 shadow-2xl shadow-yellow-500/10 flex flex-col items-center transform md:scale-110 hover:scale-115 transition-transform">
                                        <div className="absolute -top-8 w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center font-black text-yellow-900 border-4 border-white shadow-lg text-2xl">1</div>
                                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-50"></div>
                                        <div className="mt-6 mb-4">
                                            <Trophy size={56} className="text-yellow-500 drop-shadow-sm" />
                                        </div>
                                        <h3 className="text-2xl font-black text-slate-900 text-center leading-tight mb-3">{top3[0].name}</h3>
                                        <div className="bg-yellow-100 text-yellow-800 px-6 py-2 rounded-full font-black text-3xl mb-1">{top3[0].votes}</div>
                                        <span className="text-xs text-yellow-700 uppercase tracking-wider font-bold">Votes</span>
                                    </div>
                                </div>
                            )}

                            {/* Bronze */}
                            {top3[2] && (
                                <div className="order-3 md:order-3 w-full md:w-1/3 max-w-[280px] animate-in slide-in-from-bottom-8 duration-700 delay-200">
                                    <div className="relative bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-orange-100 shadow-xl flex flex-col items-center hover:scale-105 transition-transform">
                                        <div className="absolute -top-6 w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center font-black text-orange-700 border-4 border-white shadow-md">3</div>
                                        <div className="h-16 w-16 mb-4 rounded-full bg-orange-50 border border-orange-100 p-2 flex items-center justify-center">
                                            <span className="text-4xl">🥉</span>
                                        </div>
                                        <h3 className="font-bold text-slate-900 text-center leading-tight mb-2">{top3[2].name}</h3>
                                        <span className="font-black text-2xl text-slate-700">{top3[2].votes}</span>
                                        <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Votes</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-100 shadow-sm">
                            <Activity className="mx-auto mb-2 opacity-50" />
                            <p>Leaderboard loading or empty...</p>
                        </div>
                    )}
                </Container>
            </section>

            {/* 3. TRENDING GRID (Like Colleges Page) & TICKER */}
            <section className="pb-24">
                <Container>
                    <div className="flex flex-col lg:flex-row gap-8">
                        {/* Main Grid: Top 4+ */}
                        <div className="flex-1">
                            <h3 className="font-bold text-slate-900 text-xl mb-6 flex items-center gap-2">
                                <ArrowUp className="text-green-500" /> Trending Campuses
                            </h3>

                            <div className="results-grid">
                                {rest.map((college, idx) => (
                                    <div key={college.id} className="card-wrapper">
                                        <Card
                                            title={college.name}
                                            subtitle={`Rank #${idx + 4}`}
                                            // Using 'tags' to show vote count prominently
                                            tags={[`${college.votes} Votes`]}
                                            meta={"Trending Now"}
                                            // Mock generic image or no image, Card handles placeholder
                                            href="#"
                                        />
                                    </div>
                                ))}
                            </div>

                            {rest.length === 0 && top3.length === 0 && (
                                <div className="p-12 text-center text-slate-400">No data found</div>
                            )}
                        </div>

                        {/* Sidebar: Live Ticker */}
                        <div className="w-full lg:w-80 space-y-6">
                            <GlassPanel className="p-6 sticky top-24" variant="strong">
                                <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 mb-4 flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" /> Live Activity
                                </h3>
                                <div className="space-y-4">
                                    {stats.recentVotes.slice(0, 8).map((vote, i) => (
                                        <div key={i} className="flex gap-3 text-sm animate-in fade-in slide-in-from-right-4 border-b border-slate-100/50 last:border-0 pb-2 last:pb-0">
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs shrink-0">
                                                {vote.userName ? vote.userName.charAt(0) : "A"}
                                            </div>
                                            <div>
                                                <p className="text-slate-700 leading-snug">
                                                    <span className="font-bold">{vote.userName || "User"}</span> voted for <span className="font-bold text-indigo-600">{vote.collegeName}</span>
                                                </p>
                                                <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">Just now</span>
                                            </div>
                                        </div>
                                    ))}
                                    {stats.recentVotes.length === 0 && (
                                        <div className="text-slate-400 text-sm italic">No recent votes. Start the fire!</div>
                                    )}
                                </div>
                            </GlassPanel>
                        </div>
                    </div>
                </Container>
            </section>
        </div>
    );
}
