"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Container from '@/components/Container';
import GlassPanel from '@/components/GlassPanel';
import Card from '@/components/Card';
import { fetchHypeStats, postHypeVote, searchAll } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from "@/components/Toast";
import { Share2, TrendingUp, Trophy, ArrowRight, Activity, Users, MapPin, Zap, ChevronRight, Loader2, Sparkles, Heart, Search, Flame, ArrowUp, Plus, ShieldCheck } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { RevealOnScroll } from "@/lib/useIntersectionObserver";
import "@/app/colleges/page.css";
import "./HypeBattle.css";

// -----------------------------------------------------------------------------
// CUSTOM HOOK: USE PREVIOUS
// -----------------------------------------------------------------------------
function usePrevious(value) {
    const ref = useRef();
    useEffect(() => {
        ref.current = value;
    });
    return ref.current;
}

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

const PodiumCard = ({ college, rank, onVote, isVoting, totalVotes }) => {
    const isGold = rank === 1;
    const isSilver = rank === 2;
    const isBronze = rank === 3;

    // Calculate Domination % (hypothetical cap of 2x the leader or a baseline)
    const hypePercent = totalVotes > 0 ? Math.min((college.votes / totalVotes) * 400, 100) : 0;

    let accentColor = "var(--arena-sienna)";
    let rankTag = "CHALLENGER";
    let glowClass = "";

    if (isGold) {
        accentColor = "var(--arena-gold)";
        rankTag = "SUPREME LEADER";
        glowClass = "shadow-[0_0_50px_-10px_rgba(245,158,11,0.3)]";
    } else if (isSilver) {
        accentColor = "var(--arena-indigo)";
        rankTag = "ELITE GUARD";
    } else if (isBronze) {
        accentColor = "var(--arena-sienna)";
        rankTag = "LEGIONNAIRE";
    }

    if (!college) return (
        <div className="dominance-ring flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 bg-slate-50/50 min-h-[450px] w-full">
            <p className="text-slate-400 font-mono text-[10px] tracking-widest">POSITION_VACANT_{rank}</p>
        </div>
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ y: -10 }}
            className={`dominance-ring ${glowClass} p-12 flex flex-col w-full min-h-[550px]`}
        >
            {/* Battle Tag */}
            <div className="flex justify-between items-start mb-10">
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black tracking-[0.3em] text-slate-400">STATUS</span>
                    <span className="text-xs font-black tracking-[0.1em] px-3 py-1 bg-black text-white rounded-sm">{rankTag}</span>
                </div>
                {isGold && <Flame size={24} className="text-orange-500 animate-pulse" />}
            </div>

            <div className="flex-1">
                <div className="text-[9px] font-mono text-slate-400 mb-2">COORD // {college.location || "GLOBAL"}</div>
                <h3 className="text-4xl font-black text-slate-900 leading-tight mb-8 tracking-tighter" style={{ fontFamily: 'var(--font-display)' }}>
                    {college.name}
                </h3>

                {/* Hype Meter */}
                <div className="mb-8">
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Dominance Level</span>
                        <span className="text-xl font-black tabular-nums" style={{ color: accentColor }}>
                            {Math.round(hypePercent)}%
                        </span>
                    </div>
                    <div className="hype-meter-track">
                        <motion.div
                            className="hype-meter-fill"
                            initial={{ width: 0 }}
                            animate={{ width: `${hypePercent}%` }}
                            style={{ backgroundColor: accentColor, boxShadow: `0 0 15px ${accentColor}` }}
                        />
                    </div>
                </div>

                <div className="flex flex-col gap-1">
                    <span className="text-[4rem] font-black tracking-tighter tabular-nums leading-none">
                        <AnimatedCounter value={college.votes} />
                    </span>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">Hype_Force_Stored</span>
                </div>
            </div>

            <div className="mt-12">
                <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={(e) => onVote(e, college)}
                    disabled={isVoting}
                    className="w-full h-16 bg-black text-white font-black text-xs tracking-[0.3em] uppercase hover:bg-slate-800 transition-colors flex items-center justify-center gap-3 relative overflow-hidden"
                >
                    {isVoting ? <Loader2 className="animate-spin" /> : <Zap size={18} className="text-amber-400" />}
                    <span>{isVoting ? "PROCESSING..." : "PUSH_HYPE"}</span>
                </motion.button>
            </div>

            {/* Subliminal Rank */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[15rem] font-black text-black/[0.03] pointer-events-none select-none -z-10">
                0{rank}
            </div>
        </motion.div>
    );
};

// Removed BattleLog (Vertical Feed) component.

function RankRow({ college, index, onVote, isVoting, nextCollegeVotes }) {
    const gap = nextCollegeVotes ? nextCollegeVotes - college.votes : 0;

    // Detect live vote updates for this specific college
    const prevVotes = usePrevious(college.votes);
    const [isFlashing, setIsFlashing] = useState(false);

    useEffect(() => {
        if (prevVotes !== undefined && college.votes > prevVotes) {
            setIsFlashing(true);
            const timer = setTimeout(() => setIsFlashing(false), 1000); // Flash duration
            return () => clearTimeout(timer);
        }
    }, [college.votes, prevVotes]);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className={`clash-row flex items-center gap-4 group ${isFlashing ? 'flash-live' : ''}`}
        >
            <div className="w-10 h-10 flex items-center justify-center font-black text-slate-300 border-r border-slate-200 group-hover:text-amber-600 transition-colors text-lg">
                #{index + 4}
            </div>

            <div className="flex-1 min-w-0 pr-2">
                <div className="font-black text-slate-900 group-hover:translate-x-1 transition-transform truncate text-sm">
                    {college.name}
                </div>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-black text-indigo-600 tracking-wider">
                        <AnimatedCounter value={college.votes} /> HYPE
                    </span>
                    {gap > 0 && (
                        <>
                            <span className="w-1 h-1 bg-slate-200 rounded-full" />
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                                -{gap} TO OVERTAKE
                            </span>
                        </>
                    )}
                </div>
            </div>

            <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={(e) => onVote(e, college)}
                disabled={isVoting}
                className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-black text-white hover:bg-slate-800 transition-all shadow-md group-hover:scale-110"
            >
                <Plus size={16} />
            </motion.button>
        </motion.div>
    );
}

// -----------------------------------------------------------------------------
// MAIN PAGE
// -----------------------------------------------------------------------------

export default function HypePage() {
    const { user, signInWithGoogle } = useAuth();
    const { addToast } = useToast();
    const [stats, setStats] = useState({ leaderboard: [], recentVotes: [], roadmapLeaderboard: [] });
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isVoting, setIsVoting] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [lastVoteCoords, setLastVoteCoords] = useState(null);

    const triggerBurst = (e) => {
        setLastVoteCoords({ x: e.clientX, y: e.clientY });
        setTimeout(() => setLastVoteCoords(null), 1000);
    };

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
        triggerBurst(e);

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
                <section className="pt-32 pb-16 flex flex-col items-center text-center px-4 overflow-hidden relative">
                    {/* Pulsing Scanline Effect */}
                    <div className="absolute inset-0 bg-[linear-gradient(transparent_0%,rgba(192,82,42,0.03)_50%,transparent_100%)] bg-[length:100%_20px] animate-[arena-scanline_4s_linear_infinite]" />

                    <RevealOnScroll>
                        <div className="inline-flex items-center gap-3 px-6 py-2 rounded-sm bg-black text-white shadow-2xl mb-8 skew-x-[-10deg]">
                            <Zap size={16} className="text-amber-400 fill-amber-400" />
                            <span className="text-[10px] font-black tracking-[0.4em] uppercase">SYSTEM_STATE: COMBAT_ACTIVE</span>
                        </div>

                        <h1 className="glitch-title text-5xl md:text-8xl lg:text-[8rem] font-black mb-4 tracking-tighter text-slate-900 leading-none">
                            FAN WARS
                        </h1>
                        <h2 className="text-2xl md:text-4xl font-black text-[#C0522A] tracking-tight mb-8">
                            TOTAL DOMINATION
                        </h2>

                        <p className="text-base md:text-xl text-slate-600 max-w-2xl mx-auto font-medium leading-relaxed mb-12">
                            The ultimate battleground for institutional supremacy. Watch the live hype feed, deploy tactical votes, and escalate your campus to the top of the India leaderboard.
                        </p>
                    </RevealOnScroll>
                </section>

                {/* HIGH-SPEED HORIZONTAL MARQUEE (Brought Back & Enhanced) */}
                {recentVotesDisplay.length > 0 && (
                    <div className="w-full overflow-hidden bg-black py-4 border-y-2 border-[#C0522A]/30 mb-16 relative z-20">
                        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-black to-transparent z-10 pointer-events-none"></div>
                        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-black to-transparent z-10 pointer-events-none"></div>

                        <div className="fast-marquee-container flex items-center gap-16 whitespace-nowrap">
                            {recentVotesDisplay.map((vote, i) => (
                                <div key={i} className="flex items-center gap-3 text-sm font-semibold">
                                    <div className="flex items-center gap-2 text-slate-400">
                                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.8)]"></div>
                                        <span className="uppercase tracking-[0.2em] text-[10px] font-black text-amber-500">LIVE STRIKE</span>
                                    </div>
                                    <span className="text-white uppercase tracking-wider">{vote.userName}</span>
                                    <span className="text-slate-500 font-mono text-[10px] uppercase">deployed hype to</span>
                                    <span className="text-amber-400 font-black tracking-tight">{vote.collegeName}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <Container className="max-w-7xl">

                    {/* CENTERED, PROMINENT SEARCH BAR (Moved Up for Immediate Access) */}
                    <div className="mb-20 max-w-4xl mx-auto">
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500 opacity-30 group-hover:opacity-60 transition-opacity blur-lg rounded-2xl animate-pulse"></div>
                            <div className="relative bg-white border-2 border-slate-900 p-6 md:p-8 rounded-2xl flex items-center gap-6 shadow-2xl">
                                <Search size={28} className="text-[#C0522A]" />
                                <input
                                    type="text"
                                    className="w-full bg-transparent border-none focus:ring-0 text-2xl md:text-3xl font-black placeholder-slate-300 text-slate-900 uppercase tracking-tight"
                                    placeholder="SEARCH TO DEPLOY HYPE..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>

                            {searchQuery && (
                                <div className="absolute top-full left-0 right-0 mt-4 bg-black text-white border-2 border-amber-500 shadow-[0_20px_50px_rgba(245,158,11,0.3)] z-50 rounded-xl overflow-hidden max-h-[400px] overflow-y-auto">
                                    {searchResults.map(college => (
                                        <div
                                            key={college.id}
                                            onClick={(e) => handleVote(e, college)}
                                            className="p-6 hover:bg-slate-900 cursor-pointer border-b border-white/10 flex justify-between items-center group/search transition-colors"
                                        >
                                            <div>
                                                <div className="font-black text-xl tracking-tight text-white group-hover:text-amber-400 transition-colors uppercase">{college.name}</div>
                                                <div className="text-xs font-mono text-slate-400 mt-1 flex items-center gap-2">
                                                    <MapPin size={12} /> {college.location}
                                                </div>
                                            </div>
                                            <button className="px-6 py-2 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-sm group-hover/search:bg-amber-400 transition-colors">
                                                STRIKE
                                            </button>
                                        </div>
                                    ))}
                                    {searchResults.length === 0 && (
                                        <div className="p-8 text-center font-mono text-slate-500 uppercase tracking-widest">
                                            NO TARGETS FOUND
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Global Intel below search */}
                        <div className="flex justify-center gap-12 mt-8">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                                <span className="text-[10px] font-black tracking-[0.2em] uppercase text-slate-600">Servers Active</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Activity size={12} className="text-indigo-600" />
                                <span className="text-[10px] font-black tracking-[0.2em] uppercase text-slate-600">Sync: 10s</span>
                            </div>
                        </div>
                    </div>

                    {/* MAIN BATTLEGROUND GRID */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                        {/* LEFT: Dominance Rings (Podiums) - Takes full width now since Log is gone */}
                        <div className="lg:col-span-12">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16 items-start">
                                {/* RANK 2 */}
                                {top3[1] && <PodiumCard college={top3[1]} rank={2} onVote={handleVote} isVoting={isVoting} totalVotes={totalVotes} />}
                                {/* RANK 1 */}
                                {top3[0] && <PodiumCard college={top3[0]} rank={1} onVote={handleVote} isVoting={isVoting} totalVotes={totalVotes} />}
                                {/* RANK 3 */}
                                {top3[2] && <PodiumCard college={top3[2]} rank={3} onVote={handleVote} isVoting={isVoting} totalVotes={totalVotes} />}
                            </div>
                        </div>
                    </div>

                    {/* NEW: COMPACT CHALLENGERS GRID */}
                    <div className="mt-20">
                        <div className="flex items-center gap-6 mb-12">
                            <h2 className="text-4xl font-black tracking-tighter text-slate-900 uppercase">Current_Clashes</h2>
                            <div className="flex items-center gap-4 px-4 py-1 bg-slate-900 text-white rounded-full">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                                </span>
                                <span className="text-[10px] font-bold tracking-[0.2em] uppercase">Live Updating</span>
                            </div>
                            <div className="h-0.5 bg-slate-900 flex-1 opacity-10"></div>
                        </div>

                        <div className="compact-clash-grid">
                            {rest.map((college, i) => (
                                <RankRow
                                    key={college.id}
                                    college={college}
                                    index={i}
                                    onVote={handleVote}
                                    isVoting={isVoting}
                                    nextCollegeVotes={i > 0 ? rest[i - 1].votes : stats.leaderboard[2].votes}
                                />
                            ))}
                        </div>
                    </div>
                </Container>
            </div>

            {/* VERSION MARKER - V29 ROBUST */}
            <div className="fixed bottom-2 right-2 text-[10px] text-slate-300 pointer-events-none z-50 opacity-50">
                v3.2-live-kinetic
            </div>

            {/* Hype Burst Effect Container */}
            <AnimatePresence>
                {lastVoteCoords && (
                    <motion.div
                        initial={{ scale: 0, opacity: 1 }}
                        animate={{ scale: 3, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        className="fixed pointer-events-none z-[9999] w-20 h-20 bg-amber-500/20 rounded-full blur-xl border-4 border-amber-500/50"
                        style={{ top: lastVoteCoords.y - 40, left: lastVoteCoords.x - 40 }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
