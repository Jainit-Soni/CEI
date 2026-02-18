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

export default function HypePage() {
    const { user, signInWithGoogle } = useAuth();
    const [stats, setStats] = useState({ leaderboard: [], recentVotes: [] });
    const [searchQuery, setSearchQuery] = useState("");
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

    // Search Logic
    useEffect(() => {
        const performSearch = async () => {
            if (!searchQuery.trim()) {
                setSearchResults([]);
                return;
            }
            try {
                const data = await searchAll({ q: searchQuery });
                setSearchResults((data.colleges || []).slice(0, 8)); // Limit to 8
            } catch (err) {
                console.error("Search failed:", err);
            }
        };
        const timeoutId = setTimeout(performSearch, 300);
        return () => clearTimeout(timeoutId);
    }, [searchQuery]);

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

    return (
        <div className="list-page min-h-screen">
            {/* 1. HERO SECTION - MATCHING COLLEGES PAGE EXACTLY */}
            <section className="list-hero list-hero--colleges">
                <div className="list-hero-bg" aria-hidden="true">
                    <div className="hero-orb hero-orb--1" />
                    <div className="hero-orb hero-orb--2" />
                </div>

                <Container>
                    <div className="list-hero-content">
                        <RevealOnScroll>
                            <span className="list-hero-kicker flex items-center justify-center gap-2">
                                <Flame size={14} className="text-orange-500 fill-orange-500" /> Live Leaderboard
                            </span>
                            <h1 className="list-hero-title">
                                Campus Legends
                            </h1>
                            <p className="list-hero-subtitle">
                                The ultimate popularity contest. Vote for your college to prove which campus has the strongest community in India.
                            </p>
                        </RevealOnScroll>
                    </div>
                </Container>
            </section>

            {/* 2. SEARCH BAR - MATCHING GLASS PANEL STANDARDS */}
            <section className="list-filters-section" style={{ display: 'block', position: 'relative', marginTop: '-40px', zIndex: 20 }}>
                <Container>
                    <GlassPanel className="filter-bar !p-2" variant="default">
                        <div className="flex-1 relative">
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                                <Search size={20} />
                            </div>
                            <input
                                type="search"
                                className="w-full h-12 pl-12 pr-4 bg-transparent border-none focus:ring-0 text-slate-900 placeholder-slate-400 font-medium"
                                placeholder="Search for your college to vote..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {/* SEARCH DROPDOWN */}
                            {searchQuery && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-slate-100 overflow-hidden z-50 overflow-y-auto" style={{ maxHeight: '300px' }}>
                                    {searchResults.length > 0 ? (
                                        searchResults.map(college => (
                                            <div
                                                key={college.id}
                                                onClick={(e) => handleVote(e, college)}
                                                className="p-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center border-b border-slate-50 last:border-0"
                                            >
                                                <div>
                                                    <div className="font-bold text-slate-800">{college.name}</div>
                                                    <div className="text-xs text-slate-500">{college.location}</div>
                                                </div>
                                                <div className="text-xs font-bold text-indigo-600">Vote</div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="p-4 text-center text-slate-500">No colleges found</div>
                                    )}
                                </div>
                            )}
                        </div>
                        {!user && (
                            <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg border border-amber-100 whitespace-nowrap">
                                <Lock size={12} /> Login to Vote
                            </div>
                        )}
                    </GlassPanel>
                </Container>
            </section>

            {/* 3. RESULTS GRID - MATCHING COLLEGES PAGE GRID */}
            <section className="list-results pt-12 pb-24">
                <Container>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {stats.leaderboard.slice(0, 50).map((college, index) => {
                            // Determine Badge
                            let badge = null;
                            if (index === 0) badge = { text: "🏆 CHAMPION", color: "#f59e0b" }; // Amber 500
                            else if (index === 1) badge = { text: "🥈 SILVER", color: "#94a3b8" }; // Slate 400
                            else if (index === 2) badge = { text: "🥉 BRONZE", color: "#fdba74" }; // Orange 300
                            else badge = { text: `#${index + 1}`, color: "#e2e8f0", textColor: "#64748b" }; // Slate 200

                            return (
                                <RevealOnScroll key={college.id} delay={index * 50}>
                                    <div className="relative group h-full">
                                        <Card
                                            type="college"
                                            title={college.name}
                                            subtitle={college.location || "India"}
                                            href={`/college/${college.id}`}
                                            badge={badge}
                                            data={college}
                                            // Customizing the subtitle area to show votes clearly
                                            tags={[`${college.votes} Votes`]}
                                            hideFooter={index < 3} // Hide footer for top 3 to focus on winning
                                        />

                                        {/* Floating Vote Button for ALL cards for consistency */}
                                        <div className="absolute bottom-4 right-4 z-20">
                                            <button
                                                onClick={(e) => handleVote(e, college)}
                                                className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 text-white text-xs font-bold shadow-lg hover:scale-105 active:scale-95 transition-transform"
                                            >
                                                <ArrowUp size={14} /> Vote
                                            </button>
                                        </div>
                                    </div>
                                </RevealOnScroll>
                            );
                        })}

                        {stats.leaderboard.length === 0 && (
                            <div className="col-span-full py-20 text-center text-slate-400">
                                <p>Loading the leaderboard...</p>
                            </div>
                        )}
                    </div>
                </Container>
            </section>

            {/* VERSION MARKER - V21 CONSISTENCY */}
            <div className="fixed bottom-2 right-2 text-[10px] text-slate-300 pointer-events-none z-50 opacity-50">
                v2.1-consistent
            </div>
        </div>
    );
}
