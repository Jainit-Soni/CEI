"use client";

import React, { useState, useEffect, useRef } from 'react';
import Container from '@/components/Container';
import { fetchHypeStats, postHypeVote, searchAll } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from "@/components/Toast";
import { Zap, MapPin, Loader2, Search, Trophy, Medal, Plus, ArrowUpRight } from "lucide-react";
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
        const duration = 600;
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
// SIMPLE, PREMIUM TOP 3 CARDS
// -----------------------------------------------------------------------------
const TopCard = ({ college, rank, onVote, isVoting }) => {
    let rankClass = "rank-gold";
    let icon = <Trophy className="text-amber-500 w-8 h-8" />;

    if (rank === 2) {
        rankClass = "rank-silver";
        icon = <Medal className="text-slate-400 w-8 h-8" />;
    } else if (rank === 3) {
        rankClass = "rank-bronze";
        icon = <Medal className="text-orange-500 w-8 h-8" />;
    }

    if (!college) return (
        <div className="top-card border-dashed border-slate-300 min-h-[350px] items-center justify-center opacity-50">
            <p className="text-slate-400 font-medium text-sm tracking-widest uppercase">Rank {rank} Empty</p>
        </div>
    );

    return (
        <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: rank * 0.1, duration: 0.6 }}
            className={`top-card ${rankClass} min-h-[350px] group`}
        >
            <div className="flex justify-between items-start mb-6">
                {icon}
                <div className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                    Rank 0{rank}
                </div>
            </div>

            <div className="flex-1 mt-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-500 mb-2 uppercase tracking-wide">
                    <MapPin size={12} /> {college.location || "India"}
                </div>
                <h3 className="text-2xl font-black text-slate-800 leading-tight mb-8 group-hover:text-indigo-900 transition-colors line-clamp-3">
                    {college.name}
                </h3>
            </div>

            <div className="flex items-end justify-between mt-auto border-t border-slate-200/50 pt-6">
                <div>
                    <div className="text-4xl font-black tracking-tighter text-slate-900 drop-shadow-sm">
                        <AnimatedCounter value={college.votes} />
                    </div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">Total Hype</div>
                </div>
                <button
                    onClick={(e) => onVote(e, college)}
                    disabled={isVoting}
                    className={`vote-btn flex items-center gap-2 px-6 py-3 rounded-full font-bold text-sm tracking-wide transition-all shadow-sm
                        ${isVoting ? 'voting bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5'}`}
                >
                    {isVoting ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} className="fill-current" />}
                    <span>Push</span>
                </button>
            </div>

            {/* Very faint background number */}
            <div className="absolute -right-8 -bottom-8 text-[12rem] font-black text-slate-900/[0.02] pointer-events-none select-none z-0">
                {rank}
            </div>
        </motion.div>
    );
};

// -----------------------------------------------------------------------------
// SIMPLE ROW (Ranks 4+)
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
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className={`rank-row px-6 py-4 mb-3 group ${isFlashing ? 'flash-update' : ''}`}
        >
            <div className="flex items-center gap-6 flex-1 min-w-0">
                <div className="w-12 h-12 rounded-full bg-white/60 flex items-center justify-center font-black text-slate-400 group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-colors text-lg shrink-0">
                    #{index + 4}
                </div>

                <div className="flex-1 min-w-0 pr-4">
                    <div className="font-bold text-lg text-slate-800 group-hover:text-indigo-900 transition-colors truncate">
                        {college.name}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-8 shrink-0">
                <div className="text-right">
                    <div className="text-xl font-black text-slate-900 tabular-nums">
                        <AnimatedCounter value={college.votes} />
                    </div>
                    {gap > 0 ? (
                        <div className="text-[10px] font-bold text-slate-400 uppercase flex items-center justify-end gap-1">
                            <ArrowUpRight size={10} /> {gap} to ascend
                        </div>
                    ) : (
                        <div className="text-[10px] font-bold text-indigo-400 uppercase">Hype</div>
                    )}
                </div>

                <button
                    onClick={(e) => onVote(e, college)}
                    disabled={isVoting}
                    className={`vote-btn flex items-center justify-center w-12 h-12 rounded-full transition-all shadow-sm
                        ${isVoting ? 'voting bg-slate-100 text-slate-400 border border-slate-200' : 'bg-white border-2 border-slate-200 text-slate-700 hover:bg-indigo-600 hover:border-indigo-600 hover:text-white hover:shadow-md'}`}
                >
                    {isVoting ? <Loader2 size={18} className="animate-spin" /> : <Plus size={20} />}
                </button>
            </div>
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

    useEffect(() => {
        fetchHypeStats().then(setStats).catch(console.error);
        const interval = setInterval(() => {
            fetchHypeStats().then(setStats).catch(console.error);
        }, 8000); // slightly faster refresh
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
                setSearchResults((data.colleges || []).slice(0, 5));
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
            addToast("You've already verified your support for this campus.", "error");
            return;
        }

        if (isVoting) return;
        setIsVoting(true);

        const userName = user.displayName || user.email.split('@')[0] || "Student";
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

            // Generate a random animation key to force row flash
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

    // Dupe for marquee to ensure it never empties
    const recentVotesDisplay = stats.recentVotes.length > 0
        ? [...stats.recentVotes, ...stats.recentVotes, ...stats.recentVotes, ...stats.recentVotes, ...stats.recentVotes, ...stats.recentVotes]
        : [];

    return (
        <div className="min-h-screen relative overflow-hidden font-sans text-slate-900 bg-[#F4F7FA]">
            {/* CLEAN BACKGROUND */}
            <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
                <div className="absolute top-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-indigo-100/50 rounded-full filter blur-[100px] opacity-60"></div>
                <div className="absolute top-[20%] right-[-10%] w-[50vw] h-[50vw] bg-amber-100/50 rounded-full filter blur-[100px] opacity-50"></div>
                <div className="absolute bottom-[-10%] left-[10%] w-[70vw] h-[70vw] bg-sky-100/40 rounded-full filter blur-[100px] opacity-50"></div>
            </div>

            <div className="relative z-10 pb-32">

                {/* 1. HERO & TIMELINE */}
                <section className="pt-32 pb-8 flex flex-col items-center text-center px-4">
                    <RevealOnScroll>
                        <h1 className="text-5xl md:text-7xl lg:text-[6rem] font-black mb-6 tracking-tighter text-slate-900 display-font">
                            Fan Wars.
                        </h1>
                        <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto font-medium leading-relaxed mb-12">
                            The ultimate battleground for institutional supremacy. Elevate your campus to the top of the leaderboard.
                        </p>
                    </RevealOnScroll>
                </section>

                {/* CONSTANTLY MOVING HORIZONTAL TIMELINE */}
                {recentVotesDisplay.length > 0 && (
                    <div className="w-full overflow-hidden mb-16 relative z-20">
                        <div className="absolute left-0 top-0 bottom-0 w-24 bg-gradient-to-r from-[#F4F7FA] to-transparent z-10 pointer-events-none"></div>
                        <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-[#F4F7FA] to-transparent z-10 pointer-events-none"></div>

                        <div className="timeline-container">
                            {recentVotesDisplay.map((vote, i) => (
                                <div key={i} className="timeline-item">
                                    <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                                    <span className="text-slate-800 font-bold text-sm">{vote.userName}</span>
                                    <span className="text-slate-400 text-xs">voted for</span>
                                    <span className="text-indigo-600 font-black text-sm">{vote.collegeName}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <Container className="max-w-6xl">

                    {/* 2. PREMIUM SEARCH (COLLEGE PAGE STYLE) */}
                    <div className="mb-20 max-w-2xl mx-auto relative z-30">
                        <div className="search-pill rounded-full p-2 flex items-center relative">
                            <div className="pl-6 text-slate-400">
                                <Search size={22} />
                            </div>
                            <input
                                type="text"
                                className="w-full bg-transparent border-none focus:ring-0 text-lg md:text-xl font-semibold placeholder-slate-400 text-slate-800 px-4 py-3"
                                placeholder="Search for a college to boost..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {isVoting && <Loader2 className="animate-spin text-indigo-500 mr-6" />}
                        </div>

                        <AnimatePresence>
                            {searchQuery && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 10 }}
                                    className="absolute top-full left-0 right-0 mt-4 bg-white/90 backdrop-blur-xl border border-slate-200 shadow-2xl z-50 rounded-2xl overflow-hidden max-h-[400px] overflow-y-auto"
                                >
                                    {searchResults.map((college, i) => (
                                        <div
                                            key={college.id}
                                            onClick={(e) => handleVote(e, college)}
                                            className={`p-4 cursor-pointer flex justify-between items-center hover:bg-slate-50 transition-colors group ${i !== searchResults.length - 1 ? 'border-b border-slate-100' : ''}`}
                                        >
                                            <div className="min-w-0 pr-4">
                                                <div className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors truncate">{college.name}</div>
                                                <div className="text-xs text-slate-500 mt-1">{college.location}</div>
                                            </div>
                                            <button className="vote-btn shrink-0 w-10 h-10 flex items-center justify-center bg-slate-100 text-slate-600 rounded-full group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                <Plus size={18} />
                                            </button>
                                        </div>
                                    ))}
                                    {searchResults.length === 0 && (
                                        <div className="p-8 text-center text-slate-500 font-medium">
                                            No colleges found matching "{searchQuery}"
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* 3. SIMPLE TOP 3 CARDS */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-24">
                        {top3[0] && <TopCard college={top3[0]} rank={1} onVote={handleVote} isVoting={isVoting} />}
                        {top3[1] && <TopCard college={top3[1]} rank={2} onVote={handleVote} isVoting={isVoting} />}
                        {top3[2] && <TopCard college={top3[2]} rank={3} onVote={handleVote} isVoting={isVoting} />}
                    </div>

                    {/* 4. HORIZONTAL ROWS FOR THE REST */}
                    {rest.length > 0 && (
                        <div className="max-w-4xl mx-auto">
                            <div className="flex items-center gap-4 mb-8 pl-2">
                                <h2 className="text-2xl font-bold tracking-tight text-slate-800">The Contenders</h2>
                                <div className="h-px bg-slate-200 flex-1 ml-4 mt-1"></div>
                            </div>

                            <div className="flex flex-col gap-1">
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
                    )}
                </Container>
            </div>
        </div>
    );
}
