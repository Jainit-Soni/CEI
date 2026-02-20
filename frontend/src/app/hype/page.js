"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Container from '@/components/Container';
import GlassPanel from '@/components/GlassPanel';
import Card from '@/components/Card';
import { fetchHypeStats, postHypeVote, searchAll } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from "@/components/Toast";
import { Share2, TrendingUp, Trophy, ArrowRight, Activity, Users, MapPin, Zap, ChevronRight, Loader2, Sparkles, Heart, Search, Flame, ArrowUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { RevealOnScroll } from "@/lib/useIntersectionObserver";
import "@/app/colleges/page.css";

// -----------------------------------------------------------------------------
// ANIMATED COUNTER COMPONENT
// -----------------------------------------------------------------------------
function AnimatedCounter({ value }) {
    const [displayValue, setDisplayValue] = useState(value);

    useEffect(() => {
        let start = displayValue;
        const end = value;
        if (start === end) return;

        const range = end - start;
        const duration = 500; // ms
        const startTime = Date.now();

        const animate = () => {
            const now = Date.now();
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);

            // Ease out cubic
            const ease = 1 - Math.pow(1 - progress, 3);

            const current = Math.floor(start + (range * ease));
            setDisplayValue(current);

            if (progress < 1) requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
    }, [value]); // Intentional dependency on value only

    return <span className="tabular-nums">{displayValue.toLocaleString()}</span>;
}


// -----------------------------------------------------------------------------
// V19-PREMIUM COMPONENTS (Restored & Enhanced)
// -----------------------------------------------------------------------------

const PodiumCard = ({ college, rank, onVote, isVoting }) => {
    const isGold = rank === 1;
    const isSilver = rank === 2;
    const isBronze = rank === 3;

    // Standardized Premium Styles for Ultra-Refinement
    let borderColor = "border-slate-200/60";
    let bgGradient = "bg-white";
    let accentColor = "text-slate-900";
    let glowColor = "rgba(100, 116, 139, 0.1)";
    let rankLabel = "";
    let themeIcon = null;

    if (isGold) {
        borderColor = "border-amber-200/80";
        bgGradient = "bg-gradient-to-br from-amber-50 via-white to-amber-50";
        accentColor = "text-amber-700";
        glowColor = "rgba(245, 158, 11, 0.25)";
        rankLabel = "Supreme Champion";
        themeIcon = <Sparkles size={20} className="text-amber-500 animate-pulse" />;
    } else if (isSilver) {
        borderColor = "border-slate-200";
        bgGradient = "bg-gradient-to-br from-slate-50 via-white to-indigo-50/30";
        accentColor = "text-slate-700";
        glowColor = "rgba(71, 85, 105, 0.15)";
        rankLabel = "Elite Challenger";
        themeIcon = <Activity size={20} className="text-slate-400" />;
    } else if (isBronze) {
        borderColor = "border-orange-200/50";
        bgGradient = "bg-gradient-to-br from-orange-50/50 via-white to-orange-100/30";
        accentColor = "text-orange-800";
        glowColor = "rgba(234, 88, 12, 0.15)";
        rankLabel = "Rising Legend";
        themeIcon = <TrendingUp size={20} className="text-orange-400" />;
    }

    if (!college) return (
        <div className={`flex flex-col items-center justify-center p-8 rounded-[2.5rem] border-2 border-dashed border-slate-200 bg-slate-50/50 min-h-[450px] w-full`}>
            <p className="text-slate-400 font-medium">Spot Open # {rank}</p>
        </div>
    );

    return (
        <motion.div
            whileHover={{ y: -12, scale: 1.01 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className={`relative flex flex-col p-8 rounded-[3rem] border-2 ${borderColor} ${bgGradient} transition-shadow duration-500 w-full min-h-[450px] group overflow-hidden`}
            style={{
                boxShadow: `0 20px 60px -15px ${glowColor}`,
            }}
        >
            {/* Rank Badge */}
            <div className="flex justify-between items-start mb-8">
                <div className={`flex items-center gap-3 px-5 py-2 rounded-full font-bold text-sm tracking-tight ${isGold ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-600'}`}>
                    <span>Rank #{rank}</span>
                    {isGold && <Trophy size={14} />}
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition-opacity transform translate-x-2 group-hover:translate-x-0 duration-300">
                    {themeIcon}
                </div>
            </div>

            <div className="flex-1 flex flex-col justify-center text-center">
                <p className={`text-[0.65rem] font-black uppercase tracking-[0.2em] mb-2 opacity-60 ${accentColor}`}>
                    {rankLabel}
                </p>
                <div className="flex items-center justify-center gap-2 text-xs text-slate-400 font-bold uppercase tracking-widest mb-4">
                    <MapPin size={10} />
                    <span>{college.location || "India"}</span>
                </div>
                <h3 className="text-3xl font-black text-slate-900 leading-tight mb-6 group-hover:text-indigo-600 transition-colors" style={{ fontFamily: 'var(--font-display)' }}>
                    {college.name}
                </h3>

                <div className="flex flex-col items-center gap-2">
                    <span className="text-5xl font-black text-slate-900 tracking-tighter tabular-nums">
                        <AnimatedCounter value={college.votes} />
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Hype Points</span>
                </div>
            </div>

            {/* Vote Action */}
            <div className="mt-8 pt-6 border-t border-slate-100/80">
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => onVote(e, college)}
                    disabled={isVoting}
                    className={`w-full py-4 rounded-2xl font-black text-sm tracking-wide transition-all flex items-center justify-center gap-3 relative overflow-hidden group/btn
                        ${isGold
                            ? 'bg-amber-500 text-white shadow-lg shadow-amber-200 hover:bg-amber-600'
                            : 'bg-slate-900 text-white hover:bg-black shadow-lg shadow-slate-200'
                        }
                    `}
                >
                    {isVoting ? <Loader2 size={18} className="animate-spin" /> : <Heart size={18} className="group-hover/btn:scale-125 transition-transform" />}
                    <span>{isVoting ? 'BOOSTING...' : 'BOOST HYPE'}</span>
                </motion.button>
            </div>

            {/* Subliminal Ranking Indicator */}
            <div className="absolute bottom-2 right-8 text-[8rem] font-black text-slate-900/[0.03] pointer-events-none select-none -mb-8 mr-[-1rem]" style={{ fontFamily: 'var(--font-display)' }}>
                {rank}
            </div>
        </motion.div>
    );
};

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
                    <span className="text-slate-400 font-medium">
                        <AnimatedCounter value={college.votes} /> Votes
                    </span>
                </div>
            </div>

            <button
                onClick={(e) => onVote(e, college)}
                className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-indigo-600 hover:text-white transition-all active:scale-90"
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
    const { addToast } = useToast();
    const [stats, setStats] = useState({ leaderboard: [], recentVotes: [] });
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isVoting, setIsVoting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    // Initial Data Load
    useEffect(() => {
        const load = async () => {
            try {
                const statsData = await fetchHypeStats();
                setStats(statsData);
            } catch (err) {
                console.error("Failed to load hype data:", err);
            } finally {
                setIsLoading(false);
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

    // CHECK IF ALREADY VOTED (LocalStorage + User check)
    const hasUserVoted = (collegeId) => {
        if (typeof window === 'undefined') return false;

        // Check session votes
        const sessionVotes = JSON.parse(localStorage.getItem('hype_votes') || '[]');
        return sessionVotes.includes(collegeId);
    };

    const handleVote = async (e, college) => {
        e.preventDefault();
        e.stopPropagation();

        if (!user) {
            try {
                await signInWithGoogle();
            } catch (err) { console.error(err); }
            return;
        }

        const collegeId = college.id || college._id;

        // 1. DUPLICATE VOTE CHECK
        if (hasUserVoted(collegeId)) {
            addToast("You have already voted for this college!", "error");
            return;
        }

        if (isVoting) return;
        setIsVoting(true);

        const userName = user.displayName || user.email.split('@')[0] || "User";

        // Logic V29: Payload preparation with fallbacks
        const payload = {
            collegeId,
            collegeName: college.name || "Unknown College",
            uid: user.uid,      // Standard
            userId: user.uid,   // Fallback for older backend logic
            userName
        };

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
                recentVotes: [{ collegeName: college.name, userName: userName, timestamp: new Date().toISOString() }, ...prev.recentVotes].slice(0, 20) // Keep more for infinite scroll
            };
        });

        // Save to LocalStorage to prevent re-vote
        const sessionVotes = JSON.parse(localStorage.getItem('hype_votes') || '[]');
        if (!sessionVotes.includes(collegeId)) {
            sessionVotes.push(collegeId);
            localStorage.setItem('hype_votes', JSON.stringify(sessionVotes));
        }

        try {
            console.log("Voting Payload:", payload); // Debugging
            await postHypeVote(payload);

            addToast(`Vote cast for ${college.name}!`, "success"); // Success feedback
            setSearchQuery("");
            setSearchResults([]);
        } catch (err) {
            console.error("Vote failed:", err);
            // 400 Bad Request usually means validation failed
            const errorMsg = err.response?.status === 400
                ? "Vote rejected. Please refresh and try again."
                : "Vote failed. Server error.";

            addToast(errorMsg, "error");

            // Optional: Rollback state here if needed, but for now just notify
            // strict rollback is hard without deep cloning or re-fetching
            fetchHypeStats().then(setStats); // Re-fetch to sync truth
        } finally {
            setIsVoting(false);
        }
    };

    const top3 = stats.leaderboard.slice(0, 3);
    const rest = stats.leaderboard.slice(3, 50); // Limit total to 50

    // DERIVED STATS FOR TICKER
    const totalVotes = stats.leaderboard.reduce((acc, curr) => acc + (curr.votes || 0), 0);
    const activeColleges = stats.leaderboard.length;

    // INFINITE SCROLL DATA PREP
    // Ensure we have enough items to scroll smoothly. If list is small, multiply it.
    const recentVotesDisplay = stats.recentVotes.length > 0
        ? [...stats.recentVotes, ...stats.recentVotes, ...stats.recentVotes, ...stats.recentVotes, ...stats.recentVotes] // 5x duplication
        : [];

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
                <section className="pt-24 pb-8 flex flex-col items-center text-center px-4 overflow-hidden">
                    <RevealOnScroll>
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/50 border border-white/50 backdrop-blur-md shadow-sm mb-6">
                            <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span>
                            </span>
                            <span className="text-xs font-bold tracking-widest uppercase text-slate-500">Live Popularity Contest</span>
                        </div>

                        <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-b from-slate-900 via-slate-800 to-slate-500 drop-shadow-sm">
                            Campus Legends
                        </h1>
                        <p className="text-base md:text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed mb-10">
                            Who runs this city? Vote for your college and prove that your campus has the strongest community in India.
                        </p>

                        {/* LIVE STATS TICKER (EXAMS STYLE) */}
                        <div className="flex flex-col items-center w-full">
                            <div className="flex flex-wrap justify-center gap-8 md:gap-16 border-t border-slate-200/60 pt-8 max-w-4xl mx-auto mb-8">
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-3xl font-black text-slate-800 tracking-tight">
                                        <AnimatedCounter value={totalVotes} />
                                    </span>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Votes</span>
                                </div>
                                <div className="w-px h-12 bg-slate-200/60 hidden md:block"></div>
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-3xl font-black text-slate-800 tracking-tight">{activeColleges}</span>
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Colleges Active</span>
                                </div>
                            </div>

                            {/* DOPAMINE TICKER (MARQUEE) - Enhanced Infinite Scroll */}
                            {recentVotesDisplay.length > 0 && (
                                <div className="w-full overflow-hidden bg-white/40 py-4 border-y border-slate-200/40 backdrop-blur-xl mt-6">
                                    <div className="relative flex items-center gap-16 whitespace-nowrap animate-marquee">
                                        {recentVotesDisplay.map((vote, i) => (
                                            <div key={i} className="flex items-center gap-4 text-sm font-semibold">
                                                <div className="flex items-center gap-2 text-slate-400">
                                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.6)]"></div>
                                                    <span className="uppercase tracking-[0.2em] text-[10px] font-bold">New Pulse</span>
                                                </div>
                                                <span className="text-slate-900">{vote.userName}</span>
                                                <span className="text-slate-400 font-medium lowercase">supported</span>
                                                <span className="text-indigo-600 bg-indigo-50/50 px-3 py-1 rounded-full border border-indigo-100/50">{vote.collegeName}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <style jsx>{`
                                        @keyframes marquee {
                                            0% { transform: translateX(0); }
                                            100% { transform: translateX(-50%); } 
                                        }
                                        .animate-marquee {
                                            animation: marquee 60s linear infinite; /* Slower, smoother */
                                            width: max-content; /* Ensure width fits content */
                                            will-change: transform;
                                        }
                                        .animate-marquee:hover {
                                            animation-play-state: paused;
                                        }
                                        .box-shadow-green {
                                            box-shadow: 0 0 8px 2px rgba(34, 197, 94, 0.4);
                                        }
                                    `}</style>
                                </div>
                            )}
                        </div>
                    </RevealOnScroll>
                </section>

                <Container className="max-w-6xl">

                    {/* 2. STANDARD SEARCH PANEL */}
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

                    {/* 3. THE PODIUM (TOP 3) - STANDARDIZED & UNIFIED */}
                    {top3.length > 0 && (
                        <div className="my-20 flex flex-col md:flex-row justify-center items-stretch gap-8 md:gap-12 min-h-[500px]">
                            {/* SILVER (2) */}
                            {top3[1] && (
                                <RevealOnScroll>
                                    <PodiumCard college={top3[1]} rank={2} onVote={handleVote} isVoting={isVoting} />
                                </RevealOnScroll>
                            )}

                            {/* GOLD (1) */}
                            <RevealOnScroll>
                                <PodiumCard college={top3[0]} rank={1} onVote={handleVote} isVoting={isVoting} />
                            </RevealOnScroll>

                            {/* BRONZE (3) */}
                            {top3[2] && (
                                <RevealOnScroll>
                                    <PodiumCard college={top3[2]} rank={3} onVote={handleVote} isVoting={isVoting} />
                                </RevealOnScroll>
                            )}
                        </div>
                    )}

                    {/* 4. THE REST (#4 - #50) - BENTO WRAPPED (EXAMS STYLE) */}
                    <RevealOnScroll>
                        <GlassPanel className="filters-panel !p-8 !rounded-[2.5rem] !bg-white/40 !border-white/50 !backdrop-blur-xl !shadow-sm" variant="strong">
                            <div className="flex items-center justify-between mb-8 px-4">
                                <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Challengers</h3>
                                <div className="text-sm font-medium text-slate-500">
                                    {rest.length > 0
                                        ? `Showing Top ${rest.length}`
                                        : stats.leaderboard.length > 0
                                            ? 'Be the first to challenge the top 3!'
                                            : 'Start the competition!'}
                                </div>
                            </div>

                            <div className="space-y-3">
                                {rest.map((college, i) => (
                                    <RankRow key={college.id} college={college} index={i} onVote={handleVote} isVoting={isVoting} />
                                ))}

                                {isLoading && (
                                    <div className="py-20 text-center text-slate-400 animate-pulse">
                                        Calculating popularity scores...
                                    </div>
                                )}

                                {!isLoading && stats.leaderboard.length === 0 && (
                                    <div className="py-20 text-center flex flex-col items-center gap-4">
                                        <Flame className="w-12 h-12 text-slate-200" />
                                        <div className="text-slate-400 font-medium">No votes yet. Be the first to start the legend!</div>
                                    </div>
                                )}
                            </div>
                        </GlassPanel>
                    </RevealOnScroll>
                </Container>
            </div>

            {/* VERSION MARKER - V29 ROBUST */}
            <div className="fixed bottom-2 right-2 text-[10px] text-slate-300 pointer-events-none z-50 opacity-50">
                v3.0-clean-logic
            </div>
        </div>
    );
}
