"use client";

import React, { useState, useEffect, useRef } from 'react';
import Container from '@/components/Container';
import { fetchHypeStats, postHypeVote, searchAll } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from "@/components/Toast";
import {
    Zap, MapPin, Loader2, Search, Trophy, Medal, Plus,
    ArrowUpRight, Flame, Crown, Users, Activity, Star
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { RevealOnScroll } from "@/lib/useIntersectionObserver";
import "@/app/colleges/page.css";
import "./page.css";

// ─────────────────────────────────────────────
// HOOKS
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
// LIVE HORIZONTAL TICKER
// ─────────────────────────────────────────────
function LiveTicker({ votes }) {
    if (!votes.length) return null;
    // Triple the list for seamless wrap
    const items = [...votes, ...votes, ...votes, ...votes, ...votes, ...votes];

    return (
        <div className="w-full overflow-hidden py-3 relative">
            {/* fade edges */}
            <div className="absolute left-0 top-0 h-full w-24 bg-gradient-to-r from-[var(--bg,white)] to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 h-full w-24 bg-gradient-to-l from-[var(--bg,white)] to-transparent z-10 pointer-events-none" />

            <div className="ticker-track">
                {items.map((v, i) => (
                    <div key={i} className="flex items-center gap-2 px-5 select-none">
                        {/* pulse dot */}
                        <span className="relative flex h-2 w-2 shrink-0">
                            <span className="live-dot absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
                        </span>
                        <span className="text-slate-700 font-semibold text-sm">{v.userName}</span>
                        <span className="text-slate-400 text-xs font-medium">pushed hype to</span>
                        <span className="text-indigo-600 font-bold text-sm">{v.collegeName}</span>
                        <span className="text-slate-300 mx-2 select-none">·</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// TOP 3 HERO CARD
// ─────────────────────────────────────────────
function HeroCard({ college, rank, onVote, isVoting, totalVotes, podiumMode }) {
    const pct = totalVotes > 0 ? Math.min((college.votes / totalVotes) * 400, 100) : 0;
    const isGold = rank === 1;

    const cardClass = isGold ? "gold-card" : rank === 2 ? "silver-card" : "bronze-card";
    const badgeClass = isGold ? "rank-badge-gold" : rank === 2 ? "rank-badge-silver" : "rank-badge-bronze";
    const barColor = isGold ? "bg-gradient-to-r from-amber-400 to-orange-500"
        : rank === 2 ? "bg-gradient-to-r from-slate-300 to-slate-400"
            : "bg-gradient-to-r from-orange-300 to-orange-500";

    const icon = isGold ? <Crown size={24} className="text-amber-500" />
        : <Medal size={24} className={rank === 2 ? "text-slate-400" : "text-orange-500"} />;

    if (!college) return null;

    // Podium heights
    const podiumHeight = podiumMode
        ? isGold ? "min-h-[420px]" : "min-h-[380px] mt-8"
        : "min-h-[380px]";

    return (
        <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: rank * 0.1, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className={`rank-hero-card ${cardClass} flex flex-col p-8 ${podiumHeight} w-full group relative`}
        >
            {/* GHOST RANK NUMBER at the back */}
            <div className="pointer-events-none select-none absolute -bottom-6 -right-6 text-[12rem] font-black text-slate-900/[0.04] leading-none z-0">
                {rank}
            </div>

            <div className="relative z-10 flex flex-col h-full flex-1">
                {/* RANK ROW */}
                <div className="flex items-center justify-between mb-6">
                    <div className={`rank-badge ${badgeClass} text-sm shadow-sm`}>
                        #{rank}
                    </div>
                    <div className="bg-white/80 rounded-full p-2.5 shadow-sm backdrop-blur">
                        {icon}
                    </div>
                </div>

                {/* CONTENT */}
                <div className="mb-8">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">
                        <MapPin size={12} className="text-slate-400" />
                        {college.location || "India"}
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 leading-snug tracking-tight group-hover:text-indigo-900 transition-colors">
                        {college.name}
                    </h3>
                </div>

                {/* BOTTOM SECTION */}
                <div className="mt-auto">
                    {/* SCORES */}
                    <div className="flex flex-col items-center text-center mb-8">
                        <div className="text-5xl font-black tracking-tighter text-slate-900 mb-1">
                            <AnimatedCounter value={college.votes} />
                        </div>
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-widest bg-slate-100/50 px-3 py-1 rounded-full">
                            Total Hype Points
                        </div>
                    </div>

                    {/* DOMINANCE METER */}
                    <div className="mb-6">
                        <div className="flex justify-between items-center mb-2 text-xs font-bold uppercase tracking-widest text-slate-500">
                            <span>Dominance</span>
                            <span className="text-slate-800">{Math.round(pct)}%</span>
                        </div>
                        <div className="hype-bar-bg">
                            <motion.div
                                className={`hype-bar-fill ${barColor}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ delay: 0.5, duration: 1, ease: [0.4, 0, 0.2, 1] }}
                            />
                        </div>
                    </div>

                    {/* VOTE BTN */}
                    <button
                        onClick={(e) => onVote(e, college)}
                        disabled={isVoting}
                        className={`vote-btn w-full py-3.5 rounded-xl font-bold text-base tracking-wide flex justify-center items-center gap-2
                            ${isVoting
                                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                                : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg shadow-indigo-600/20"
                            }`}
                    >
                        {isVoting ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} className="fill-current" />}
                        Push Hype
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

// ─────────────────────────────────────────────
// CONTENDER ROW (Rank 4-10)
// ─────────────────────────────────────────────
function ContenderRow({ college, rank, onVote, isVoting, nextVotes }) {
    const gap = nextVotes ? nextVotes - college.votes : 0;
    const prev = usePrevious(college.votes);
    const [flash, setFlash] = useState(false);

    useEffect(() => {
        if (prev !== undefined && college.votes > prev) {
            setFlash(true);
            const t = setTimeout(() => setFlash(false), 1200);
            return () => clearTimeout(t);
        }
    }, [college.votes, prev]);

    return (
        <motion.div
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className={`contender-row flex items-center gap-4 px-6 py-4 group ${flash ? "row-flash-anim" : ""}`}
        >
            {/* RANK */}
            <div className="w-12 h-12 rounded-full bg-white/70 border border-slate-200/60 flex items-center justify-center font-black text-slate-400 text-base group-hover:text-indigo-600 group-hover:bg-indigo-50 transition-all shrink-0 shadow-sm">
                {rank}
            </div>

            {/* NAME + META */}
            <div className="flex-1 min-w-0">
                <div className="font-bold text-slate-800 group-hover:text-indigo-900 transition-colors truncate leading-snug">
                    {college.name}
                </div>
                {gap > 0 && (
                    <div className="text-[10px] font-semibold text-slate-400 flex items-center gap-1 mt-0.5 uppercase tracking-wide">
                        <ArrowUpRight size={10} className="text-indigo-400" />
                        <span className="text-indigo-500 font-bold">{gap}</span>&nbsp;to climb a rank
                    </div>
                )}
            </div>

            {/* SCORE */}
            <div className="text-right shrink-0 hidden sm:block">
                <div className="text-xl font-black text-slate-800">
                    <AnimatedCounter value={college.votes} />
                </div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Hype</div>
            </div>

            {/* VOTE BTN */}
            <button
                onClick={(e) => onVote(e, college)}
                disabled={isVoting}
                className={`vote-btn w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all
          ${isVoting
                        ? "bg-slate-100 text-slate-400 border border-slate-200"
                        : "bg-white border-2 border-slate-200 text-slate-600 hover:bg-indigo-600 hover:border-indigo-600 hover:text-white hover:shadow-lg hover:shadow-indigo-100"
                    }`}
            >
                {isVoting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={18} />}
            </button>
        </motion.div>
    );
}

// ─────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────
export default function HypePage() {
    const { user, signInWithGoogle } = useAuth();
    const { addToast } = useToast();

    const [stats, setStats] = useState({ leaderboard: [], recentVotes: [] });
    const [searchQuery, setSearchQuery] = useState("");
    const [debQuery, setDebQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isVoting, setIsVoting] = useState(false);
    const [burstPos, setBurstPos] = useState(null);
    const searchRef = useRef(null);

    /* ---- Data Load ---- */
    useEffect(() => {
        fetchHypeStats().then(setStats).catch(console.error);
        const id = setInterval(() => fetchHypeStats().then(setStats).catch(console.error), 8000);
        return () => clearInterval(id);
    }, []);

    /* ---- Debounced Search ---- */
    useEffect(() => {
        const t = setTimeout(() => setDebQuery(searchQuery), 280);
        return () => clearTimeout(t);
    }, [searchQuery]);

    useEffect(() => {
        if (!debQuery.trim()) { setSearchResults([]); return; }
        searchAll({ q: debQuery })
            .then(d => setSearchResults((d.colleges || []).slice(0, 6)))
            .catch(console.error);
    }, [debQuery]);

    /* ---- Click outside to close search ---- */
    useEffect(() => {
        const handler = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target))
                setSearchQuery("");
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    /* ---- Vote ---- */
    const hasVoted = (id) => {
        if (typeof window === 'undefined') return false;
        return JSON.parse(localStorage.getItem('hype_votes') || '[]').includes(id);
    };

    const handleVote = async (e, college) => {
        e.preventDefault(); e.stopPropagation();
        if (!user) { try { await signInWithGoogle(); } catch { } return; }

        const collegeId = college.id || college._id;
        if (hasVoted(collegeId)) { addToast("You've already hyped this campus!", "error"); return; }
        if (isVoting) return;

        setIsVoting(true);
        setBurstPos({ x: e.clientX, y: e.clientY });
        setTimeout(() => setBurstPos(null), 800);

        const userName = user.displayName || user.email?.split('@')[0] || "Student";
        const payload = { collegeId, collegeName: college.name || "Unknown", uid: user.uid, userId: user.uid, userName };

        /* Optimistic */
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

        const sv = JSON.parse(localStorage.getItem('hype_votes') || '[]');
        if (!sv.includes(collegeId)) { sv.push(collegeId); localStorage.setItem('hype_votes', JSON.stringify(sv)); }

        try {
            await postHypeVote(payload);
            addToast(`Hype injected into ${college.name}! 🔥`, "success");
            setSearchQuery(""); setSearchResults([]);
        } catch (err) {
            const msg = err.response?.status === 400 ? "Vote rejected, try again." : "Server error. Retry.";
            addToast(msg, "error");
            fetchHypeStats().then(setStats);
        } finally {
            setIsVoting(false);
        }
    };

    /* ---- Derived ---- */
    const top3 = stats.leaderboard.slice(0, 3);
    const contenders = stats.leaderboard.slice(3, 10);
    const totalVotes = stats.leaderboard.reduce((a, c) => a + (c.votes || 0), 0);
    const totalCamps = stats.leaderboard.length;

    return (
        <div className="min-h-screen font-sans text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
            {/* ──── BAND BACKGROUND (global layout already renders bands, just keep it visible) ──── */}
            {/* We use bg-transparent so the root chromatic bands show through */}

            {/* ──── PAGE WRAPPER ──── */}
            <div className="relative z-10 pb-32">

                {/* ──── 1. HERO ──── */}
                <section className="pt-32 pb-6 flex flex-col items-center text-center px-4">
                    <RevealOnScroll>
                        {/* Live badge */}
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full stat-chip border mb-8 shadow-sm">
                            <span className="relative flex h-2 w-2">
                                <span className="live-dot absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
                            </span>
                            <span className="text-[11px] font-bold tracking-widest text-indigo-700 uppercase">Live Leaderboard</span>
                        </div>

                        {/* Title */}
                        <h1 className="hero-gradient-text text-6xl md:text-8xl lg:text-[7rem] font-black tracking-tighter leading-none mb-6">
                            Fan Wars
                        </h1>

                        <p className="text-lg md:text-xl text-slate-500 max-w-xl mx-auto font-medium leading-relaxed mb-10">
                            The ultimate battleground for institutional supremacy.<br className="hidden md:block" />
                            Boost your campus. Dominate the leaderboard.
                        </p>

                        {/* Stat chips */}
                        <div className="flex items-center justify-center gap-4 md:gap-6 flex-wrap mb-2">
                            <div className="stat-chip flex items-center gap-2 px-5 py-2.5 rounded-full shadow-sm text-sm font-bold text-slate-700">
                                <Flame size={16} className="text-orange-500" />
                                <AnimatedCounter value={totalVotes} /> total hype points
                            </div>
                            <div className="stat-chip flex items-center gap-2 px-5 py-2.5 rounded-full shadow-sm text-sm font-bold text-slate-700">
                                <Users size={16} className="text-indigo-400" />
                                {totalCamps} institutions
                            </div>
                            <div className="stat-chip flex items-center gap-2 px-5 py-2.5 rounded-full shadow-sm text-sm font-bold text-slate-700">
                                <Activity size={16} className="text-green-500" />
                                Syncing every 8s
                            </div>
                        </div>
                    </RevealOnScroll>
                </section>

                {/* ──── 2. LIVE TICKER ──── */}
                <div className="fw-glass border-y border-white/50 shadow-sm my-6">
                    <LiveTicker votes={stats.recentVotes} />
                </div>

                {/* ──── MAIN CONTENT ──── */}
                <Container className="max-w-6xl">

                    {/* ──── 3. SEARCH ──── */}
                    <div className="mb-16 max-w-2xl mx-auto relative z-30" ref={searchRef}>
                        <div className="fw-search-bar flex items-center px-6 py-4 gap-4">
                            <Search size={22} className="text-indigo-400 shrink-0" />
                            <input
                                type="text"
                                className="flex-1 bg-transparent border-none focus:ring-0 text-lg font-semibold placeholder-slate-400 text-slate-800 min-w-0"
                                placeholder="Search for any campus to push hype..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button onClick={() => { setSearchQuery(""); setSearchResults([]); }}
                                    className="text-slate-400 hover:text-slate-600 text-xl leading-none shrink-0">×</button>
                            )}
                        </div>

                        <AnimatePresence>
                            {searchQuery && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 8 }}
                                    transition={{ duration: 0.25 }}
                                    className="fw-search-dropdown absolute top-full left-0 right-0 mt-3 rounded-2xl overflow-hidden border border-white/80 z-50"
                                >
                                    {searchResults.length > 0 ? searchResults.map((col, i) => (
                                        <div
                                            key={col.id}
                                            onClick={e => handleVote(e, col)}
                                            className={`flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-indigo-50/80 transition-colors group
                        ${i < searchResults.length - 1 ? "border-b border-slate-100" : ""}`}
                                        >
                                            <div className="min-w-0 pr-4">
                                                <div className="font-bold text-slate-800 group-hover:text-indigo-700 transition-colors truncate">{col.name}</div>
                                                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                                                    <MapPin size={11} />{col.location}
                                                </div>
                                            </div>
                                            <div className="vote-btn shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 text-slate-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                <Plus size={18} />
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="px-6 py-8 text-center text-sm text-slate-500 font-medium">
                                            No colleges found for &quot;{searchQuery}&quot;
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* ──── 4. TOP 3 PODIUM ──── */}
                    <section className="mb-16">
                        <div className="flex items-center gap-3 mb-8">
                            <Crown size={20} className="text-amber-500" />
                            <h2 className="text-2xl font-black tracking-tight text-slate-900">Top 3 Champions</h2>
                            <div className="h-px bg-slate-200 flex-1 ml-2" />
                        </div>

                        {/* PODIUM ROW — always 3 columns, rank 1 center and tallest */}
                        <div className="flex items-end gap-6">
                            {/* RANK 2 — left */}
                            <div className="flex-1">
                                {top3[1] && (
                                    <HeroCard college={top3[1]} rank={2} onVote={handleVote} isVoting={isVoting} totalVotes={totalVotes} podiumMode />
                                )}
                            </div>

                            {/* RANK 1 — center, tallest */}
                            <div className="flex-1">
                                {top3[0] && (
                                    <HeroCard college={top3[0]} rank={1} onVote={handleVote} isVoting={isVoting} totalVotes={totalVotes} podiumMode />
                                )}
                            </div>

                            {/* RANK 3 — right */}
                            <div className="flex-1">
                                {top3[2] && (
                                    <HeroCard college={top3[2]} rank={3} onVote={handleVote} isVoting={isVoting} totalVotes={totalVotes} podiumMode />
                                )}
                            </div>
                        </div>
                    </section>

                    {/* ──── 5. CONTENDERS (4-10) ──── */}
                    {contenders.length > 0 && (
                        <section>
                            <div className="flex items-center gap-3 mb-6">
                                <Star size={18} className="text-indigo-400" />
                                <h2 className="text-2xl font-black tracking-tight text-slate-900">The Contenders</h2>
                                <div className="fw-glass px-3 py-1 rounded-full ml-2 text-[11px] font-bold text-slate-600 border border-white/60 shadow-sm">
                                    Ranks 4 – {Math.min(10, stats.leaderboard.length)}
                                </div>
                                <div className="h-px bg-slate-200 flex-1" />
                            </div>

                            <div className="flex flex-col gap-2">
                                {contenders.map((col, i) => (
                                    <ContenderRow
                                        key={col.id}
                                        college={col}
                                        rank={i + 4}
                                        onVote={handleVote}
                                        isVoting={isVoting}
                                        nextVotes={i > 0 ? contenders[i - 1].votes : top3[2]?.votes}
                                    />
                                ))}
                            </div>
                        </section>
                    )}
                </Container>
            </div>

            {/* ──── VOTE BURST FX ──── */}
            <AnimatePresence>
                {burstPos && (
                    <div
                        className="fixed pointer-events-none z-[9999]"
                        style={{ top: burstPos.y - 50, left: burstPos.x - 50, width: 100, height: 100 }}
                    >
                        <div className="burst-ring absolute inset-0 rounded-full border-4 border-indigo-400 opacity-70" />
                        <div className="burst-ring absolute inset-2 rounded-full border-2 border-amber-400 opacity-50" style={{ animationDelay: "0.1s" }} />
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
