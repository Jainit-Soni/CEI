"use client";

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Container from '@/components/Container';
import GlassPanel from '@/components/GlassPanel';
import { fetchHypeStats, postHypeVote, searchAll } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from "@/components/Toast";
import { Share2, Zap, ArrowRight, Activity, Users, MapPin, Loader2, Sparkles, Heart, Search, Flame, Plus, ShieldCheck, Trophy, Crown, ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { RevealOnScroll } from "@/lib/useIntersectionObserver";
import "@/app/colleges/page.css";
import "./page.css";

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
        const duration = 500;
        const startTime = Date.now();

        const animate = () => {
            const now = Date.now();
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            const current = Math.floor(start + (range * ease));
            setDisplayValue(current);
            if (progress < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }, [value]);

    return <span className="tabular-nums">{displayValue.toLocaleString()}</span>;
}

// -----------------------------------------------------------------------------
// PREMIUM LIGHT GLASS PODIUM
// -----------------------------------------------------------------------------
const PodiumCard = ({ college, rank, onVote, isVoting, totalVotes }) => {
    const isGold = rank === 1;
    const isSilver = rank === 2;
    const isBronze = rank === 3;

    // Calculate Domination %
    const hypePercent = totalVotes > 0 ? Math.min((college.votes / totalVotes) * 400, 100) : 0;

    let podiumClass = "podium-1";
    let icon = <Crown className="text-amber-500 w-8 h-8 drop-shadow-md" />;
    let tagColor = "bg-amber-100 text-amber-800 border-amber-200";
    let progressColor = "from-amber-400 to-orange-500";

    if (isSilver) {
        podiumClass = "podium-2";
        icon = <Trophy className="text-slate-400 w-7 h-7" />;
        tagColor = "bg-slate-100 text-slate-700 border-slate-200";
        progressColor = "from-slate-300 to-slate-400";
    } else if (isBronze) {
        podiumClass = "podium-3";
        icon = <Trophy className="text-orange-400 w-7 h-7" />;
        tagColor = "bg-orange-50 text-orange-800 border-orange-200";
        progressColor = "from-orange-300 to-orange-400";
    }

    if (!college) return (
        <div className="glass-podium flex flex-col items-center justify-center min-h-[400px] border-dashed border-slate-300">
            <p className="text-slate-400 font-medium text-sm tracking-widest uppercase">Position Vacant</p>
        </div>
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: rank * 0.1 }}
            className={`glass-podium ${podiumClass} flex flex-col min-h-[450px] justify-between group`}
        >
            <div>
                {/* Header */}
                <div className="flex justify-between items-start mb-6">
                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border ${tagColor} flex items-center gap-1.5`}>
                        Rank 0{rank}
                    </div>
                    <div className="bg-white/50 p-2 rounded-full shadow-sm backdrop-blur-md">
                        {icon}
                    </div>
                </div>

                <div className="mb-2 flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                    <MapPin size={12} /> {college.location || "India"}
                </div>

                <h3 className="text-2xl md:text-3xl font-black text-slate-900 leading-tight mb-8 tracking-tight display-font group-hover:text-indigo-900 transition-colors">
                    {college.name}
                </h3>
            </div>

            <div>
                {/* Hype Meter */}
                <div className="mb-8 p-4 bg-white/40 rounded-xl border border-white/50 shadow-inner">
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Domination</span>
                        <span className="text-lg font-black text-slate-800 tabular-nums">
                            {Math.round(hypePercent)}%
                        </span>
                    </div>
                    <div className="hype-progress-bg">
                        <motion.div
                            className={`hype-progress-fill bg-gradient-to-r ${progressColor}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${hypePercent}%` }}
                        />
                    </div>
                </div>

                {/* Score */}
                <div className="flex items-baseline gap-2 mb-6">
                    <span className="text-5xl font-black tracking-tighter text-slate-900 drop-shadow-sm tabular-nums">
                        <AnimatedCounter value={college.votes} />
                    </span>
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Hype</span>
                </div>

                <motion.button
                    whileTap={{ scale: 0.96 }}
                    onClick={(e) => onVote(e, college)}
                    disabled={isVoting}
                    className="w-full py-4 rounded-xl bg-gradient-to-r from-slate-900 to-slate-800 text-white font-bold text-sm tracking-widest uppercase hover:shadow-lg hover:-translate-y-0.5 transition-all flex items-center justify-center gap-3 relative overflow-hidden group/btn"
                >
                    <div className="absolute inset-0 bg-white/20 translate-x-[-100%] group-hover/btn:translate-x-[100%] transition-transform duration-700 ease-in-out"></div>
                    {isVoting ? <Loader2 className="animate-spin" /> : <Zap size={18} className="text-amber-400 fill-amber-400 group-hover/btn:scale-110 transition-transform" />}
                    <span>{isVoting ? "Verifying..." : "Push Hype"}</span>
                </motion.button>
            </div>
        </motion.div>
    );
};

// -----------------------------------------------------------------------------
// PREMIUM COMPACT ROW
// -----------------------------------------------------------------------------
function RankRow({ college, index, onVote, isVoting, nextCollegeVotes }) {
    const gap = nextCollegeVotes ? nextCollegeVotes - college.votes : 0;
    const prevVotes = usePrevious(college.votes);
    const [isFlashing, setIsFlashing] = useState(false);

    useEffect(() => {
        if (prevVotes !== undefined && college.votes > prevVotes) {
            setIsFlashing(true);
            const timer = setTimeout(() => setIsFlashing(false), 1000);
            return () => clearTimeout(timer);
        }
    }, [college.votes, prevVotes]);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className={`glass-clash-row group ${isFlashing ? 'flash-live' : ''}`}
        >
            <div className="w-12 h-12 rounded-full bg-white/60 border border-slate-200 flex items-center justify-center font-black text-slate-500 group-hover:text-indigo-600 transition-colors text-lg shadow-sm shrink-0">
                #{index + 4}
            </div>

            <div className="flex-1 min-w-0 pr-2">
                <div className="font-bold text-slate-800 group-hover:text-indigo-900 transition-colors truncate text-sm">
                    {college.name}
                </div>
                <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-black text-indigo-600 tracking-wide bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                        <AnimatedCounter value={college.votes} /> <span className="text-[9px] uppercase">Hype</span>
                    </span>
                    {gap > 0 && (
                        <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-tight flex items-center gap-1">
                            <ArrowUpRight size={10} /> {gap} to climb
                        </span>
                    )}
                </div>
            </div>

            <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={(e) => onVote(e, college)}
                disabled={isVoting}
                className="w-10 h-10 shrink-0 flex items-center justify-center rounded-full bg-white text-slate-700 border border-slate-200 hover:bg-slate-900 hover:text-white hover:border-slate-900 transition-all shadow-sm group-hover:shadow-md"
            >
                <Plus size={18} />
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
    const [stats, setStats] = useState({ leaderboard: [], recentVotes: [] });
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isVoting, setIsVoting] = useState(false);
    const [lastVoteCoords, setLastVoteCoords] = useState(null);

    const triggerBurst = (e) => {
        setLastVoteCoords({ x: e.clientX, y: e.clientY });
        setTimeout(() => setLastVoteCoords(null), 1000);
    };

    useEffect(() => {
        fetchHypeStats().then(setStats).catch(console.error);
        const interval = setInterval(() => {
            fetchHypeStats().then(setStats).catch(console.error);
        }, 10000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handler = setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    useEffect(() => {
        const performSearch = async () => {
            if (!debouncedSearchQuery.trim()) {
                setSearchResults([]);
                return;
            }
            try {
                const data = await searchAll({ q: debouncedSearchQuery });
                setSearchResults((data.colleges || []).slice(0, 6)); // Elegant limit
            } catch (err) {
                console.error("Search failed:", err);
            }
        };
        performSearch();
    }, [debouncedSearchQuery]);

    const hasUserVoted = (collegeId) => {
        if (typeof window === 'undefined') return false;
        const sessionVotes = JSON.parse(localStorage.getItem('hype_votes') || '[]');
        return sessionVotes.includes(collegeId);
    };

    const handleVote = async (e, college) => {
        e.preventDefault();
        e.stopPropagation();

        if (!user) {
            try { await signInWithGoogle(); } catch (err) { console.error(err); }
            return;
        }

        const collegeId = college.id || college._id;

        if (hasUserVoted(collegeId)) {
            addToast("You've already pushed hype for this campus!", "error");
            return;
        }

        if (isVoting) return;
        setIsVoting(true);
        triggerBurst(e);

        const userName = user.displayName || user.email.split('@')[0] || "User";
        const payload = { collegeId, collegeName: college.name || "Unknown", uid: user.uid, userId: user.uid, userName };

        // Optimistic UI Update
        setStats(prev => {
            const newLeaderboard = [...prev.leaderboard];
            const existingIndex = newLeaderboard.findIndex(c => c.id === collegeId);
            if (existingIndex >= 0) {
                newLeaderboard[existingIndex] = { ...newLeaderboard[existingIndex], votes: newLeaderboard[existingIndex].votes + 1 };
            } else {
                newLeaderboard.push({ id: collegeId, name: college.name, votes: 1, location: college.location });
            }
            newLeaderboard.sort((a, b) => b.votes - a.votes);
            return {
                ...prev,
                leaderboard: newLeaderboard,
                recentVotes: [{ collegeName: college.name, userName: userName, timestamp: new Date().toISOString() }, ...prev.recentVotes].slice(0, 20)
            };
        });

        const sessionVotes = JSON.parse(localStorage.getItem('hype_votes') || '[]');
        if (!sessionVotes.includes(collegeId)) {
            sessionVotes.push(collegeId);
            localStorage.setItem('hype_votes', JSON.stringify(sessionVotes));
        }

        try {
            await postHypeVote(payload);
            addToast(`Successfully hyped ${college.name}!`, "success");
            setSearchQuery("");
            setSearchResults([]);
        } catch (err) {
            console.error("Vote failed:", err);
            const errorMsg = err.response?.status === 400
                ? "Vote rejected. Please refresh and try again."
                : "Vote failed. Server error.";
            addToast(errorMsg, "error");
            fetchHypeStats().then(setStats);
        } finally {
            setIsVoting(false);
        }
    };

    const top3 = stats.leaderboard.slice(0, 3);
    const rest = stats.leaderboard.slice(3, 50);
    const totalVotes = stats.leaderboard.reduce((acc, curr) => acc + (curr.votes || 0), 0);
    const activeColleges = stats.leaderboard.length;

    // Dupe for marquee
    const recentVotesDisplay = stats.recentVotes.length > 0
        ? [...stats.recentVotes, ...stats.recentVotes, ...stats.recentVotes, ...stats.recentVotes, ...stats.recentVotes, ...stats.recentVotes]
        : [];

    return (
        <div className="min-h-screen relative overflow-hidden font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900 bg-[#F4F7FA]">
            {/* PREMIUM GLOBAL BACKGROUND - LIGHT GLASS */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-indigo-200/40 rounded-full filter blur-[120px] mix-blend-multiply opacity-70 animate-blob"></div>
                <div className="absolute top-[20%] right-[-10%] w-[50vw] h-[50vw] bg-amber-200/40 rounded-full filter blur-[120px] mix-blend-multiply opacity-60 animate-blob animation-delay-2000"></div>
                <div className="absolute bottom-[-10%] left-[10%] w-[70vw] h-[70vw] bg-emerald-200/30 rounded-full filter blur-[120px] mix-blend-multiply opacity-50 animate-blob animation-delay-4000"></div>
                <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px]"></div>
            </div>

            <div className="relative z-10 pb-32">
                {/* 1. ELEGANT HERO */}
                <section className="pt-32 pb-16 flex flex-col items-center text-center px-4">
                    <RevealOnScroll>
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/80 border border-indigo-100 text-indigo-700 shadow-sm backdrop-blur-md mb-8">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                            </span>
                            <span className="text-[10px] font-bold tracking-widest uppercase">Live Leaderboard Active</span>
                        </div>

                        <h1 className="text-6xl md:text-8xl lg:text-[7rem] font-black mb-4 tracking-tighter text-slate-900 display-font drop-shadow-sm">
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900">FAN WARS</span>
                        </h1>
                        <p className="text-lg md:text-xl text-slate-600 max-w-2xl mx-auto font-medium leading-relaxed mb-6">
                            The ultimate battleground for institutional supremacy. Watch the live hype feed and escalate your campus to the top of the Indian leaderboard.
                        </p>

                        <div className="flex gap-8 justify-center items-center">
                            <div className="flex flex-col items-center">
                                <span className="text-3xl font-black text-indigo-600"><AnimatedCounter value={totalVotes} /></span>
                                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-1">Total Payload</span>
                            </div>
                            <div className="w-px h-10 bg-slate-300"></div>
                            <div className="flex flex-col items-center">
                                <span className="text-3xl font-black text-slate-800">{activeColleges}</span>
                                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-1">Institutions</span>
                            </div>
                        </div>
                    </RevealOnScroll>
                </section>

                {/* 2. PREMIUM LIGHT MARQUEE */}
                {recentVotesDisplay.length > 0 && (
                    <div className="w-full overflow-hidden bg-white/40 backdrop-blur-md py-3 border-y border-white/60 mb-16 relative z-20 shadow-sm">
                        <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-[#F4F7FA] to-transparent z-10 pointer-events-none"></div>
                        <div className="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-[#F4F7FA] to-transparent z-10 pointer-events-none"></div>

                        <div className="fast-marquee-container flex items-center gap-12 whitespace-nowrap px-4">
                            {recentVotesDisplay.map((vote, i) => (
                                <div key={i} className="flex items-center gap-3 text-sm">
                                    <div className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-200 flex items-center gap-1.5">
                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></div>
                                        <span className="uppercase tracking-widest text-[9px] font-bold text-amber-700">Live</span>
                                    </div>
                                    <span className="text-slate-800 font-semibold">{vote.userName}</span>
                                    <span className="text-slate-400 font-mono text-[10px] uppercase">hyped</span>
                                    <span className="text-indigo-600 font-black tracking-tight">{vote.collegeName}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <Container className="max-w-7xl">
                    {/* 3. PROMINENT GLASS SEARCH */}
                    <div className="mb-20 max-w-3xl mx-auto relative z-30">
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-indigo-300 to-amber-300 opacity-20 group-focus-within:opacity-40 transition-opacity blur-lg rounded-3xl"></div>
                            <div className="relative bg-white/70 backdrop-blur-xl border border-white p-4 md:p-6 rounded-3xl flex items-center gap-4 shadow-[0_8px_30px_rgb(0,0,0,0.04)] ring-1 ring-slate-900/5 focus-within:ring-indigo-500/50 transition-all">
                                <Search size={28} className="text-indigo-400 shrink-0 ml-2" />
                                <input
                                    type="text"
                                    className="w-full bg-transparent border-none focus:ring-0 text-xl md:text-2xl font-bold placeholder-slate-400 text-slate-800 tracking-tight"
                                    placeholder="Search your campus to inject hype..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                {isVoting && <Loader2 className="animate-spin text-slate-400 mr-2" />}
                            </div>

                            {searchQuery && (
                                <div className="absolute top-full left-0 right-0 mt-4 glass-search-results rounded-2xl overflow-hidden max-h-[400px] overflow-y-auto">
                                    {searchResults.map(college => (
                                        <div
                                            key={college.id}
                                            onClick={(e) => handleVote(e, college)}
                                            className="p-5 glass-search-item cursor-pointer flex justify-between items-center group/search"
                                        >
                                            <div>
                                                <div className="font-bold text-lg text-slate-800 group-hover/search:text-indigo-600 transition-colors">{college.name}</div>
                                                <div className="text-xs font-medium text-slate-500 mt-1 flex items-center gap-1.5">
                                                    <MapPin size={12} /> {college.location}
                                                </div>
                                            </div>
                                            <button className="px-5 py-2.5 bg-slate-900 text-white font-bold text-xs uppercase tracking-widest rounded-lg group-hover/search:bg-indigo-600 transition-colors shadow-sm focus:outline-none flex items-center gap-2">
                                                <Flame size={14} className="text-amber-400" /> Push
                                            </button>
                                        </div>
                                    ))}
                                    {searchResults.length === 0 && (
                                        <div className="p-8 text-center text-sm font-medium text-slate-500">
                                            No campuses found matching your query.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* 4. THE PODIUMS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24 items-end">
                        <div className="md:order-1 transform md:translate-y-8">
                            {top3[1] && <PodiumCard college={top3[1]} rank={2} onVote={handleVote} isVoting={isVoting} totalVotes={totalVotes} />}
                        </div>
                        <div className="md:order-2 z-10">
                            {top3[0] && <PodiumCard college={top3[0]} rank={1} onVote={handleVote} isVoting={isVoting} totalVotes={totalVotes} />}
                        </div>
                        <div className="md:order-3 transform md:translate-y-16">
                            {top3[2] && <PodiumCard college={top3[2]} rank={3} onVote={handleVote} isVoting={isVoting} totalVotes={totalVotes} />}
                        </div>
                    </div>

                    {/* 5. CURRENT CLASHES GRID */}
                    <div className="mt-16">
                        <div className="flex items-center gap-4 mb-8">
                            <h2 className="text-3xl font-black tracking-tight text-slate-900 display-font">The Rankings</h2>
                            <div className="h-px bg-slate-200 flex-1 ml-4 mt-2"></div>
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

            {/* VERSION MARKER */}
            <div className="fixed bottom-2 right-2 text-[10px] text-slate-400 pointer-events-none z-50 font-mono opacity-60">
                v4.0-premium-glass
            </div>

            {/* HYPE BURST EFFECT */}
            <AnimatePresence>
                {lastVoteCoords && (
                    <motion.div
                        initial={{ scale: 0, opacity: 1 }}
                        animate={{ scale: 2.5, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="fixed pointer-events-none z-[9999] w-24 h-24 bg-amber-400/30 rounded-full blur-xl border-2 border-amber-300"
                        style={{ top: lastVoteCoords.y - 48, left: lastVoteCoords.x - 48 }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
