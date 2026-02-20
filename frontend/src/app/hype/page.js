"use client";

import React, { useState, useEffect, useRef } from 'react';
import Container from '@/components/Container';
import { fetchHypeStats, postHypeVote, searchAll } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from "@/components/Toast";
import {
    Zap, MapPin, Loader2, Trophy, Flame, ShieldCheck, TrendingUp, Plus, Search
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { RevealOnScroll } from "@/lib/useIntersectionObserver";
import "./page.css";

// ─────────────────────────────────────────────
// CUSTOM HOOKS
// ─────────────────────────────────────────────
function usePrevious(value) {
    const ref = useRef();
    useEffect(() => { ref.current = value; });
    return ref.current;
}

// ─────────────────────────────────────────────
// ANIMATED COUNTER
// ─────────────────────────────────────────────
function AnimatedCounter({ value, className = "" }) {
    const [display, setDisplay] = useState(value);
    useEffect(() => {
        const start = display, end = value;
        if (start === end) return;
        const t0 = Date.now(), dur = 700;
        const tick = () => {
            const p = Math.min((Date.now() - t0) / dur, 1);
            const e = 1 - Math.pow(1 - p, 4);
            setDisplay(Math.floor(start + (end - start) * e));
            if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }, [value]);
    return <span className={`tabular-nums ${className}`}>{display.toLocaleString()}</span>;
}

// ─────────────────────────────────────────────
// NEXUS PODIUM CARD
// ─────────────────────────────────────────────
function NexusPodiumCard({ college, rank, totalVotes, onVote, isVoting }) {
    if (!college) return null;

    const isFirst = rank === 1;
    const pct = totalVotes > 0 ? (college.votes / totalVotes) * 100 : 0;

    // Aesthetic Maps
    const posClass = rank === 1 ? "podium-rank-1" : rank === 2 ? "podium-rank-2" : "podium-rank-3";
    const badgeClass = rank === 1 ? "badge-1" : rank === 2 ? "badge-2" : "badge-3";
    const fillClass = rank === 1 ? "fill-1" : rank === 2 ? "fill-2" : "fill-3";

    return (
        <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: rank * 0.15, duration: 0.8, type: "spring", stiffness: 100 }}
            className={`podium-card-wrapper ${posClass}`}
        >
            <div className="nexus-glass-card">
                <div className={`nexus-rank-badge ${badgeClass}`}>#{rank}</div>

                <h3 className="text-xl font-bold text-slate-900 mt-4 pr-12 leading-tight">
                    {college.name}
                </h3>

                <div className="flex items-center gap-1.5 mt-3 text-xs font-semibold text-slate-500 uppercase tracking-widest">
                    <MapPin size={14} className="text-indigo-400" />
                    {college.location || "India"}
                </div>

                <div className="mt-8">
                    <div className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">
                        Global Hype Score
                    </div>
                    <div className="nexus-vote-count">
                        <AnimatedCounter value={college.votes} />
                    </div>
                </div>

                <div className="mt-4 mb-6">
                    <div className="flex justify-between text-xs font-bold text-slate-500 mb-2">
                        <span>Market Share</span>
                        <span>{pct.toFixed(1)}%</span>
                    </div>
                    <div className="nexus-progress-bg">
                        <motion.div
                            className={`nexus-progress-fill ${fillClass}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(pct * 2, 100)}%` }} // *2 for visual impact
                            transition={{ delay: 1, duration: 1.5, ease: "easeOut" }}
                        />
                    </div>
                </div>

                <button
                    onClick={(e) => onVote(e, college)}
                    disabled={isVoting}
                    className={`nexus-vote-btn ${isVoting ? 'btn-disabled' : 'btn-primary'}`}
                >
                    {isVoting ? <Loader2 className="animate-spin" size={20} /> : <Zap size={20} className="fill-current" />}
                    Inject Hype
                </button>
            </div>
        </motion.div>
    );
}

// ─────────────────────────────────────────────
// NEXUS CONTENDER ROW
// ─────────────────────────────────────────────
function NexusContenderRow({ college, rank, onVote, isVoting }) {
    const prev = usePrevious(college.votes);
    const [flash, setFlash] = useState(false);

    useEffect(() => {
        if (prev !== undefined && college.votes > prev) {
            setFlash(true);
            const t = setTimeout(() => setFlash(false), 1000);
            return () => clearTimeout(t);
        }
    }, [college.votes, prev]);

    return (
        <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            className={`nexus-list-item ${flash ? 'row-flash' : ''}`}
        >
            <div className="nexus-list-rank">
                #{rank}
            </div>

            <div className="nexus-list-content">
                <div className="nexus-list-title">{college.name}</div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-400 uppercase tracking-widest">
                    <MapPin size={12} className="text-slate-300" /> {college.location || "India"}
                </div>
            </div>

            <div className="nexus-list-stats">
                <AnimatedCounter value={college.votes} />
            </div>

            <button
                className="nexus-list-btn"
                onClick={(e) => onVote(e, college)}
                disabled={isVoting}
            >
                {isVoting ? <Loader2 size={24} className="animate-spin" /> : <Plus size={24} />}
            </button>
        </motion.div>
    );
}

// ─────────────────────────────────────────────
// MAIN PAGE EXPORT
// ─────────────────────────────────────────────
export default function FanWarsV2() {
    const { user, signInWithGoogle } = useAuth();
    const { addToast } = useToast();

    const [stats, setStats] = useState({ leaderboard: [], recentVotes: [] });
    const [isVoting, setIsVoting] = useState(false);
    const [burstPos, setBurstPos] = useState(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [debQuery, setDebQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const searchRef = useRef(null);

    // Initial Load & Polling
    useEffect(() => {
        fetchHypeStats().then(setStats).catch(console.error);
        const id = setInterval(() => fetchHypeStats().then(setStats).catch(console.error), 8000);
        return () => clearInterval(id);
    }, []);

    // Search Debouncing
    useEffect(() => {
        const t = setTimeout(() => setDebQuery(searchQuery), 300);
        return () => clearTimeout(t);
    }, [searchQuery]);

    useEffect(() => {
        if (!debQuery.trim()) { setSearchResults([]); return; }
        searchAll({ q: debQuery })
            .then(d => setSearchResults((d.colleges || []).slice(0, 5)))
            .catch(console.error);
    }, [debQuery]);

    useEffect(() => {
        const handler = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target))
                setSearchQuery("");
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const hasVoted = (id) => {
        if (typeof window === 'undefined') return false;
        return JSON.parse(localStorage.getItem('hype_votes') || '[]').includes(id);
    };

    const handleVote = async (e, college) => {
        e.preventDefault(); e.stopPropagation();
        if (!user) { try { await signInWithGoogle(); } catch { } return; }

        const collegeId = college.id || college._id;
        if (hasVoted(collegeId)) {
            addToast("You've already hyped this campus today!", "error");
            return;
        }
        if (isVoting) return;

        setIsVoting(true);
        // Visual burst effect
        setBurstPos({ x: e.clientX, y: e.clientY });
        setTimeout(() => setBurstPos(null), 800);

        const userName = user.displayName || user.email?.split('@')[0] || "Student";
        const payload = { collegeId, collegeName: college.name || "Unknown", uid: user.uid, userId: user.uid, userName };

        // Optimistic UI Update
        setStats(prev => {
            const lb = [...prev.leaderboard];
            const idx = lb.findIndex(c => c.id === collegeId);
            if (idx >= 0) lb[idx] = { ...lb[idx], votes: lb[idx].votes + 1 };
            else lb.push({ id: collegeId, name: college.name, votes: 1, location: college.location });
            lb.sort((a, b) => b.votes - a.votes);
            return {
                ...prev,
                leaderboard: lb,
                recentVotes: [{ collegeName: college.name, userName, timestamp: new Date().toISOString() }, ...prev.recentVotes].slice(0, 20)
            };
        });

        // Local Storage Sync (Anti-Spam)
        const sv = JSON.parse(localStorage.getItem('hype_votes') || '[]');
        if (!sv.includes(collegeId)) {
            sv.push(collegeId);
            localStorage.setItem('hype_votes', JSON.stringify(sv));
        }

        // Network Request
        try {
            await postHypeVote(payload);
            addToast(`Hype injected into ${college.name}! 🔥`, "success");
            setSearchQuery("");
            setSearchResults([]);
        } catch (err) {
            addToast("Sync failed, retrying...", "error");
            fetchHypeStats().then(setStats);
        } finally {
            setIsVoting(false);
        }
    };

    const top3 = stats.leaderboard.slice(0, 3);
    const contenders = stats.leaderboard.slice(3, 10);
    const totalVotes = stats.leaderboard.reduce((a, c) => a + (c.votes || 0), 0);
    const totalCamps = stats.leaderboard.length;

    return (
        <div className="hype-page-wrapper selection:bg-indigo-200">
            {/* Ambient Background Glows */}
            <div className="hype-bg-glow glow-1" />
            <div className="hype-bg-glow glow-2" />

            <Container className="relative z-10 pt-32 pb-12">
                {/* HERO SECTION */}
                <div className="text-center mb-16">
                    <RevealOnScroll>
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="inline-flex items-center gap-2 bg-indigo-50 border border-indigo-100 text-indigo-600 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest mb-8 shadow-sm"
                        >
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                            </span>
                            Live Arena
                        </motion.div>

                        <h1 className="arena-hero-title">
                            The Nexus
                        </h1>
                        <p className="arena-hero-subtitle">
                            The ultimate battleground for institution supremacy.
                            Vote for your campus and push them to the top of the national leaderboard.
                        </p>

                        <div className="flex items-center justify-center gap-4 flex-wrap">
                            <div className="nexus-stat-chip">
                                <Flame className="text-amber-500" size={20} />
                                <span><AnimatedCounter value={totalVotes} /> Total Volume</span>
                            </div>
                            <div className="nexus-stat-chip">
                                <Trophy className="text-indigo-500" size={20} />
                                <span>{totalCamps} Active Entities</span>
                            </div>
                            <div className="nexus-stat-chip">
                                <ShieldCheck className="text-emerald-500" size={20} />
                                <span>Secure Ledger</span>
                            </div>
                        </div>
                    </RevealOnScroll>
                </div>

                {/* THE SEARCH BAR */}
                <div className="max-w-2xl mx-auto mb-20 relative z-50" ref={searchRef}>
                    <div className="nexus-search-bar">
                        <Search size={22} className="text-indigo-400 shrink-0" />
                        <input
                            type="text"
                            className="w-full bg-transparent border-none outline-none text-lg font-bold text-slate-800 placeholder-slate-400"
                            placeholder="Find any institution to push hype..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button onClick={() => { setSearchQuery(""); setSearchResults([]) }} className="text-slate-400 hover:text-slate-600 text-xl font-bold">×</button>
                        )}
                    </div>

                    <AnimatePresence>
                        {searchQuery && (
                            <motion.div
                                initial={{ opacity: 0, y: -10, scale: 0.98 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                className="nexus-search-results absolute top-full left-0 right-0 mt-3 bg-white/95 backdrop-blur-xl border border-white rounded-2xl shadow-2xl overflow-hidden"
                            >
                                {searchResults.length > 0 ? searchResults.map(col => (
                                    <div
                                        key={col.id}
                                        onClick={e => handleVote(e, col)}
                                        className="flex items-center justify-between p-4 border-b border-slate-100 last:border-0 hover:bg-indigo-50/50 cursor-pointer transition-colors group"
                                    >
                                        <div>
                                            <div className="font-bold text-slate-900 group-hover:text-indigo-600 truncate">{col.name}</div>
                                            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1 mt-1">
                                                <MapPin size={10} /> {col.location}
                                            </div>
                                        </div>
                                        <button className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all shrink-0">
                                            <Plus size={20} />
                                        </button>
                                    </div>
                                )) : (
                                    <div className="p-6 text-center text-slate-500 font-bold italic">No results for "{searchQuery}"</div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* THE PODIUM (Top 3) */}
                {top3.length > 0 && (
                    <div className="podium-container">
                        {/* Rank 2 - Left */}
                        {top3[1] && <NexusPodiumCard college={top3[1]} rank={2} totalVotes={totalVotes} onVote={handleVote} isVoting={isVoting} />}

                        {/* Rank 1 - Center */}
                        {top3[0] && <NexusPodiumCard college={top3[0]} rank={1} totalVotes={totalVotes} onVote={handleVote} isVoting={isVoting} />}

                        {/* Rank 3 - Right */}
                        {top3[2] && <NexusPodiumCard college={top3[2]} rank={3} totalVotes={totalVotes} onVote={handleVote} isVoting={isVoting} />}
                    </div>
                )}

                {/* THE CONTENDERS */}
                {contenders.length > 0 && (
                    <div className="mt-24">
                        <div className="flex items-center justify-center gap-4 mb-12">
                            <TrendingUp size={28} className="text-indigo-500" />
                            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Rising Contenders</h2>
                        </div>

                        <div className="contender-lane">
                            {contenders.map((col, i) => (
                                <NexusContenderRow
                                    key={col.id}
                                    college={col}
                                    rank={i + 4}
                                    onVote={handleVote}
                                    isVoting={isVoting}
                                />
                            ))}
                        </div>
                    </div>
                )}

            </Container>

            {/* CLICK FX */}
            <AnimatePresence>
                {burstPos && (
                    <motion.div
                        initial={{ scale: 0, opacity: 1 }}
                        animate={{ scale: 2, opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="fixed pointer-events-none z-[9999] rounded-full border-[8px] border-indigo-500/50"
                        style={{ top: burstPos.y - 50, left: burstPos.x - 50, width: 100, height: 100 }}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
