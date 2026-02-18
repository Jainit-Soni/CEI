"use client";

import React, { useState, useEffect, useMemo } from 'react';
import Container from '@/components/Container';
import GlassPanel from '@/components/GlassPanel';
import { fetchHypeStats, postHypeVote, fetchColleges } from '@/lib/api';
import { Trophy, Search, Flame, ArrowUp, Activity } from 'lucide-react';
import { RevealOnScroll } from "@/lib/useIntersectionObserver";
import "../colleges/page.css";

export default function HypePage() {
    const [stats, setStats] = useState({ leaderboard: [], recentVotes: [] });
    const [allColleges, setAllColleges] = useState([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isVoting, setIsVoting] = useState(false);
    const [userVotedId, setUserVotedId] = useState(null); // Simple session tracking

    // Load initial data
    useEffect(() => {
        const load = async () => {
            try {
                // 1. Get real stats from backend
                const statsData = await fetchHypeStats();
                setStats(statsData);

                // 2. Get all colleges for the search dropdown
                const collegesData = await fetchColleges();
                const list = Array.isArray(collegesData) ? collegesData : (Array.isArray(collegesData?.data) ? collegesData.data : []);
                setAllColleges(list);
            } catch (err) {
                console.error("Failed to load hype data:", err);
            }
        };
        load();

        // Refresh stats every 10s to keep "Live" feel without fake data
        const interval = setInterval(() => {
            fetchHypeStats().then(setStats).catch(console.error);
        }, 10000);
        return () => clearInterval(interval);
    }, []);

    // Handle Vote
    const handleVote = async (college) => {
        if (isVoting) return;
        setIsVoting(true);

        // Optimistic Update
        const collegeId = college.id || college._id;
        setUserVotedId(collegeId);

        // Update local state immediately for responsiveness
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

            // Re-sort
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
            // Send to backend
            await postHypeVote({
                collegeId: collegeId,
                collegeName: college.name,
                userId: "session-user-" + Date.now(), // Simple anonymous ID
                userName: "Anonymous Student"
            });
            // Clear search after vote
            setSearchQuery("");
        } catch (err) {
            console.error("Vote failed:", err);
            // Revert on error (omitted for brevity in this MVP)
        } finally {
            setIsVoting(false);
        }
    };

    // Filter colleges for search
    const searchResults = useMemo(() => {
        if (!searchQuery) return [];
        return allColleges
            .filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
            .slice(0, 5);
    }, [allColleges, searchQuery]);

    const top3 = stats.leaderboard.slice(0, 3);
    const rest = stats.leaderboard.slice(3, 20); // Show top 20 max

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
                                Real-time votes. No fake numbers. Search your college and push it to the top.
                            </p>

                            {/* THE GIANT SEARCH BAR */}
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl blur opacity-25 group-focus-within:opacity-75 transition duration-500"></div>
                                <div className="relative flex items-center bg-white rounded-2xl shadow-2xl p-2 transition-transform transform group-focus-within:scale-[1.02]">
                                    <Search className="text-slate-400 ml-4 w-6 h-6" />
                                    <input
                                        type="text"
                                        className="w-full bg-transparent border-none text-xl p-4 placeholder-slate-400 focus:ring-0 text-slate-900 font-bold"
                                        placeholder="Type your college name to vote..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        autoFocus
                                    />
                                </div>

                                {/* Dropdown Results */}
                                {searchQuery && (
                                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2">
                                        {searchResults.length > 0 ? (
                                            searchResults.map(college => (
                                                <button
                                                    key={college.id || college._id}
                                                    onClick={() => handleVote(college)}
                                                    disabled={isVoting}
                                                    className="w-full text-left p-4 hover:bg-indigo-50 flex items-center justify-between group/item transition-colors"
                                                >
                                                    <div>
                                                        <div className="font-bold text-slate-900">{college.name}</div>
                                                        <div className="text-xs text-slate-500">{college.location}</div>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-indigo-600 font-bold opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                        <span>Vote</span>
                                                        <ArrowUp size={16} />
                                                    </div>
                                                </button>
                                            ))
                                        ) : (
                                            <div className="p-4 text-slate-500 text-sm">No colleges found. Try a different name.</div>
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
                            {/* Silver (2nd) */}
                            {top3[1] && (
                                <div className="order-2 md:order-1 w-full md:w-1/3 max-w-[280px] animate-in slide-in-from-bottom-8 duration-700 delay-100">
                                    <div className="relative bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-slate-200 shadow-xl flex flex-col items-center">
                                        <div className="absolute -top-6 w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center font-black text-slate-600 border-4 border-white shadow-md">2</div>
                                        <div className="h-16 w-16 mb-4 rounded-full bg-slate-50 border border-slate-100 p-2 flex items-center justify-center">
                                            <span className="text-2xl">🥈</span>
                                        </div>
                                        <h3 className="font-bold text-slate-900 text-center leading-tight mb-2">{top3[1].name}</h3>
                                        <span className="font-black text-2xl text-slate-700">{top3[1].votes}</span>
                                        <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Votes</span>
                                    </div>
                                </div>
                            )}

                            {/* Gold (1st) */}
                            {top3[0] && (
                                <div className="order-1 md:order-2 w-full md:w-1/3 max-w-[300px] z-10 -mt-12 md:-mt-16 animate-in slide-in-from-bottom-12 duration-700">
                                    <div className="relative bg-gradient-to-b from-yellow-50 to-white rounded-2xl p-8 border border-yellow-100 shadow-2xl shadow-yellow-500/10 flex flex-col items-center transform md:scale-110">
                                        <div className="absolute -top-8 w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center font-black text-yellow-900 border-4 border-white shadow-lg text-2xl">1</div>
                                        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-yellow-400 to-transparent opacity-50"></div>
                                        <div className="mt-6 mb-4">
                                            <Trophy size={48} className="text-yellow-500 drop-shadow-sm" />
                                        </div>
                                        <h3 className="text-xl font-black text-slate-900 text-center leading-tight mb-2">{top3[0].name}</h3>
                                        <div className="bg-yellow-100 text-yellow-800 px-4 py-1 rounded-full font-black text-3xl mb-1">{top3[0].votes}</div>
                                        <span className="text-xs text-yellow-700 uppercase tracking-wider font-bold">Votes</span>
                                    </div>
                                </div>
                            )}

                            {/* Bronze (3rd) */}
                            {top3[2] && (
                                <div className="order-3 md:order-3 w-full md:w-1/3 max-w-[280px] animate-in slide-in-from-bottom-8 duration-700 delay-200">
                                    <div className="relative bg-white/80 backdrop-blur-md rounded-2xl p-6 border border-orange-100 shadow-xl flex flex-col items-center">
                                        <div className="absolute -top-6 w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center font-black text-orange-700 border-4 border-white shadow-md">3</div>
                                        <div className="h-16 w-16 mb-4 rounded-full bg-orange-50 border border-orange-100 p-2 flex items-center justify-center">
                                            <span className="text-2xl">🥉</span>
                                        </div>
                                        <h3 className="font-bold text-slate-900 text-center leading-tight mb-2">{top3[2].name}</h3>
                                        <span className="font-black text-2xl text-slate-700">{top3[2].votes}</span>
                                        <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">Votes</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="text-center py-12 text-slate-400 bg-white rounded-2xl border border-slate-100">
                            Waiting for votes... be the first!
                        </div>
                    )}
                </Container>
            </section>

            {/* 3. The Rest (List) & Live Ticker */}
            <section className="pb-24">
                <Container>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Leaderboard List */}
                        <div className="lg:col-span-2 space-y-4">
                            <h3 className="font-bold text-slate-900 text-lg px-4">Trending Campuses</h3>
                            <GlassPanel className="p-0 overflow-hidden" variant="default">
                                {rest.map((college, idx) => (
                                    <div key={college.id} className="flex items-center gap-4 p-4 border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                                        <div className="w-8 font-bold text-slate-400 text-center">#{idx + 4}</div>
                                        <div className="flex-1">
                                            <h4 className="font-bold text-slate-900">{college.name}</h4>
                                        </div>
                                        <div className="font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">
                                            {college.votes}
                                        </div>
                                    </div>
                                ))}
                                {rest.length === 0 && top3.length === 0 && (
                                    <div className="p-8 text-center text-slate-400 text-sm">No data yet.</div>
                                )}
                            </GlassPanel>
                        </div>

                        {/* Live Activity Feed */}
                        <div>
                            <h3 className="font-bold text-slate-900 text-lg px-4 mb-4 flex items-center gap-2">
                                <Activity size={18} className="text-green-500" /> Live Feed
                            </h3>
                            <div className="space-y-3">
                                {stats.recentVotes.map((vote, i) => (
                                    <div key={i} className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm flex items-start gap-3 animate-in fade-in slide-in-from-right-4">
                                        <div className="w-2 h-2 mt-2 rounded-full bg-green-500 shrink-0 animate-pulse" />
                                        <div className="text-sm">
                                            <p className="text-slate-900 leading-snug">
                                                <span className="font-bold">{vote.userName || "Someone"}</span> voted for <span className="font-bold text-indigo-600">{vote.collegeName}</span>
                                            </p>
                                            <p className="text-xs text-slate-400 mt-1">Just now</p>
                                        </div>
                                    </div>
                                ))}
                                {stats.recentVotes.length === 0 && (
                                    <div className="text-slate-400 text-sm italic px-4">No recent activity.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </Container>
            </section>
        </div>
    );
}
