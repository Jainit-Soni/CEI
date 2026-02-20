"use client";

import React, { useState, useEffect, useRef } from 'react';
import Container from '@/components/Container';
import { fetchHypeStats, postHypeVote, searchAll } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from "@/components/Toast";
import {
    Zap, MapPin, Loader2, Search, Trophy, Medal, Plus,
    ArrowUpRight, Flame, Crown, Users, Activity, Star,
    ShieldCheck, Sparkles, TrendingUp
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
    if (!votes || !votes.length) return null;
    // Multiplied list for seamless wrap
    const items = [...votes, ...votes, ...votes, ...votes, ...votes, ...votes];

    return (
        <div className="w-full overflow-hidden py-4 relative">
            <div className="ticker-track">
                {items.map((v, i) => (
                    <div key={i} className="flex items-center gap-3 px-6 select-none">
                        <span className="relative flex h-2 w-2 shrink-0">
                            <span className="live-dot absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
                        </span>
                        <span className="text-slate-700 font-bold text-sm">{v.userName}</span>
                        <span className="text-slate-400 text-xs font-semibold uppercase tracking-wider">boosted</span>
                        <span className="text-indigo-600 font-black text-sm">{v.collegeName}</span>
                        <span className="text-slate-300 mx-3 select-none">|</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// TOP 3 HERO CARD (PODIUM STYLE)
// ─────────────────────────────────────────────
function HeroCard({ college, rank, onVote, isVoting, totalVotes, podiumMode }) {
    if (!college) return null;

    const pct = totalVotes > 0 ? Math.min((college.votes / totalVotes) * 400, 100) : 0;
    const isGold = rank === 1;

    const cardClass = isGold ? "gold-card" : rank === 2 ? "silver-card" : "bronze-card";
    const badgeClass = isGold ? "rank-badge-gold" : rank === 2 ? "rank-badge-silver" : "rank-badge-bronze";
    const barColor = isGold ? "bg-gradient-to-r from-amber-400 to-orange-500"
        : rank === 2 ? "bg-gradient-to-r from-slate-300 to-slate-400"
            : "bg-gradient-to-r from-orange-300 to-orange-500";

    const icon = isGold ? <Crown size={26} className="text-amber-500" />
        : <Medal size={26} className={rank === 2 ? "text-slate-400" : "text-orange-500"} />;

    // Podium variations
    const podiumHeight = podiumMode
        ? isGold ? "min-h-[440px]" : "min-h-[390px] mt-10"
        : "min-h-[390px]";

    return (
        <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: rank * 0.1, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className={`rank-hero-card ${cardClass} p-8 ${podiumHeight} group`}
        >
            {/* BACKGROUND WATERMARK */}
            <div className="pointer-events-none select-none absolute -bottom-8 -right-8 text-[14rem] font-black text-slate-900/[0.03] leading-none z-0">
                {rank}
            </div>

            <div className="relative z-10 flex flex-col h-full">
                {/* HEADER */}
                <div className="flex items-start justify-between mb-8">
                    <div className={`rank-badge ${badgeClass} shadow-md`}>
                        #{rank}
                    </div>
                    <div className="bg-white/90 rounded-2xl p-3 shadow-sm border border-white/50 backdrop-blur-md">
                        {icon}
                    </div>
                </div>

                {/* INFO */}
                <div className="mb-8">
                    <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">
                        <MapPin size={12} className="text-indigo-400" />
                        {college.location || "India"}
                    </div>
                    <h3 className="text-2xl font-black text-slate-900 leading-[1.1] tracking-tighter group-hover:text-indigo-900 transition-colors">
                        {college.name}
                    </h3>
                </div>

                {/* VISUAL STATS */}
                <div className="mt-auto">
                    <div className="flex flex-col items-center mb-10">
                        <div className="text-6xl font-black tracking-tighter text-slate-900 leading-none mb-2">
                            <AnimatedCounter value={college.votes} />
                        </div>
                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest bg-slate-100/80 px-4 py-1.5 rounded-full border border-slate-200/50">
                            Verified Hype Points
                        </div>
                    </div>

                    {/* METER */}
                    <div className="mb-8 px-1">
                        <div className="flex justify-between items-center mb-2.5 text-[10px] font-black uppercase tracking-widest text-slate-400">
                            <span className="flex items-center gap-1"><TrendingUp size={10} /> Market Share</span>
                            <span className="text-slate-800">{Math.round(pct)}%</span>
                        </div>
                        <div className="hype-bar-bg">
                            <motion.div
                                className={`hype-bar-fill ${barColor}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ delay: 0.6, duration: 1.2, ease: [0.34, 1.56, 0.64, 1] }}
                            />
                        </div>
                    </div>

                    {/* ACTION */}
                    <button
                        onClick={(e) => onVote(e, college)}
                        disabled={isVoting}
                        className={`vote-btn-pill w-full py-4 flex justify-center items-center gap-2.5
                            ${isVoting
                                ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                                : "bg-indigo-600 text-white shadow-xl shadow-indigo-600/20 hover:bg-indigo-700"
                            }`}
                    >
                        {isVoting ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} className="fill-current" />}
                        <span className="text-sm font-black uppercase tracking-widest">Push Hype</span>
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
            const t = setTimeout(() => setFlash(false), 1500);
            return () => clearTimeout(t);
        }
    }, [college.votes, prev]);

    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className={`contender-row flex items-center gap-6 px-8 py-5 group ${flash ? "row-flash-anim" : ""}`}
        >
            <div className="w-14 h-14 rounded-2xl bg-white border border-slate-100 flex items-center justify-center font-black text-slate-400 text-xl group-hover:text-indigo-600 group-hover:border-indigo-100 group-hover:rotate-3 transition-all shrink-0 shadow-sm">
                {rank}
            </div>

            <div className="flex-1 min-w-0">
                <div className="font-extrabold text-slate-800 text-lg group-hover:text-indigo-900 transition-colors truncate leading-none mb-1.5">
                    {college.name}
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase tracking-wide">
                        <MapPin size={10} /> {college.location || "India"}
                    </div>
                    {gap > 0 && (
                        <div className="text-[10px] font-black text-indigo-500 flex items-center gap-1 uppercase tracking-wide">
                            <Sparkles size={10} /> {gap} pts to rank up
                        </div>
                    )}
                </div>
            </div>

            <div className="text-right shrink-0 hidden sm:block px-6 border-r border-slate-100 mr-2">
                <div className="text-2xl font-black text-slate-900 leading-none mb-1">
                    <AnimatedCounter value={college.votes} />
                </div>
                <div className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em]">Hype Score</div>
            </div>

            <button
                onClick={(e) => onVote(e, college)}
                disabled={isVoting}
                className={`vote-btn-pill w-12 h-12 flex items-center justify-center shrink-0
                  ${isVoting
                        ? "bg-slate-50 text-slate-300 border border-slate-100"
                        : "bg-white border-2 border-slate-100 text-slate-600 hover:bg-indigo-600 hover:border-indigo-600 hover:text-white"
                    }`}
            >
                {isVoting ? <Loader2 size={18} className="animate-spin" /> : <Plus size={22} strokeWidth={3} />}
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

    useEffect(() => {
        fetchHypeStats().then(setStats).catch(console.error);
        const id = setInterval(() => fetchHypeStats().then(setStats).catch(console.error), 8000);
        return () => clearInterval(id);
    }, []);

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
        if (hasVoted(collegeId)) { addToast("You've already hyped this campus!", "error"); return; }
        if (isVoting) return;

        setIsVoting(true);
        setBurstPos({ x: e.clientX, y: e.clientY });
        setTimeout(() => setBurstPos(null), 800);

        const userName = user.displayName || user.email?.split('@')[0] || "Student";
        const payload = { collegeId, collegeName: college.name || "Unknown", uid: user.uid, userId: user.uid, userName };

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
        <div className="min-h-screen text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
            <div className="relative z-10 pb-40">
                {/* 1. HERO */}
                <section className="pt-32 pb-12 flex flex-col items-center text-center px-4">
                    <RevealOnScroll>
                        <div className="inline-flex items-center gap-2.5 px-5 py-2 rounded-full fw-glass border mb-10 shadow-sm">
                            <span className="relative flex h-2.5 w-2.5">
                                <span className="live-dot absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500" />
                            </span>
                            <span className="text-[11px] font-black tracking-[0.25em] text-indigo-700 uppercase">Real-Time Arena</span>
                        </div>

                        <h1 className="hero-gradient-text text-7xl md:text-9xl font-black tracking-tighter leading-none mb-6">
                            Fan Wars
                        </h1>

                        <p className="text-xl md:text-2xl text-slate-500 max-w-2xl mx-auto font-medium leading-relaxed mb-12">
                            The collective pulse of India&apos;s academic landscape.<br className="hidden md:block" />
                            Whose campus carries the most weight?
                        </p>

                        <div className="flex items-center justify-center gap-5 flex-wrap">
                            <div className="stat-chip-premium">
                                <Flame size={18} className="text-orange-500" />
                                <span><AnimatedCounter value={totalVotes} /> Global Points</span>
                            </div>
                            <div className="stat-chip-premium">
                                <Users size={18} className="text-indigo-500" />
                                <span>{totalCamps} Institutions</span>
                            </div>
                            <div className="stat-chip-premium">
                                <ShieldCheck size={18} className="text-green-500" />
                                <span>Blockchain Verified</span>
                            </div>
                        </div>
                    </RevealOnScroll>
                </section>

                {/* 2. LIVE TICKER */}
                <div className="fw-glass border-y border-white/40 shadow-sm my-10 overflow-hidden">
                    <LiveTicker votes={stats.recentVotes} />
                </div>

                <Container className="max-w-6xl">
                    {/* 3. SEARCH */}
                    <div className="mb-24 max-w-2xl mx-auto relative z-30" ref={searchRef}>
                        <div className="fw-search-bar flex items-center px-8 py-5 gap-5">
                            <Search size={24} className="text-indigo-500 shrink-0" />
                            <input
                                type="text"
                                className="flex-1 bg-transparent border-none focus:ring-0 text-xl font-bold placeholder-slate-400 text-slate-800 min-w-0"
                                placeholder="Search institution to push hype..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button onClick={() => { setSearchQuery(""); setSearchResults([]); }}
                                    className="text-slate-400 hover:text-slate-600 text-2xl leading-none shrink-0">×</button>
                            )}
                        </div>

                        <AnimatePresence>
                            {searchQuery && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.98 }}
                                    className="fw-search-dropdown absolute top-full left-0 right-0 z-50 overflow-hidden"
                                >
                                    {searchResults.length > 0 ? searchResults.map((col, i) => (
                                        <div
                                            key={col.id}
                                            onClick={e => handleVote(e, col)}
                                            className={`flex items-center justify-between px-8 py-5 cursor-pointer hover:bg-slate-50 transition-colors group
                                                ${i < searchResults.length - 1 ? "border-b border-slate-100" : ""}`}
                                        >
                                            <div className="min-w-0 pr-6">
                                                <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate text-lg">{col.name}</div>
                                                <div className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 font-bold uppercase tracking-wider">
                                                    <MapPin size={12} /> {col.location}
                                                </div>
                                            </div>
                                            <div className="vote-btn-pill shrink-0 w-12 h-12 flex items-center justify-center bg-slate-100 text-slate-600 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                                <Plus size={22} strokeWidth={3} />
                                            </div>
                                        </div>
                                    )) : (
                                        <div className="px-8 py-10 text-center text-slate-500 font-bold italic">
                                            No institutions found for &quot;{searchQuery}&quot;
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* 4. TOP 3 PODIUM */}
                    <section className="mb-24">
                        <div className="flex items-center gap-4 mb-12">
                            <Trophy size={24} className="text-amber-500" />
                            <h2 className="text-3xl font-black tracking-tight text-slate-900">Elite Hierarchy</h2>
                            <div className="h-px bg-slate-200 flex-1 ml-4" />
                        </div>

                        <div className="flex flex-col lg:flex-row items-end gap-10 lg:gap-8">
                            {/* RANK 2 */}
                            <div className="w-full lg:flex-1 order-2 lg:order-1">
                                {top3[1] && <HeroCard college={top3[1]} rank={2} onVote={handleVote} isVoting={isVoting} totalVotes={totalVotes} podiumMode />}
                            </div>

                            {/* RANK 1 */}
                            <div className="w-full lg:flex-1 order-1 lg:order-2">
                                {top3[0] && <HeroCard college={top3[0]} rank={1} onVote={handleVote} isVoting={isVoting} totalVotes={totalVotes} podiumMode />}
                            </div>

                            {/* RANK 3 */}
                            <div className="w-full lg:flex-1 order-3 lg:order-3">
                                {top3[2] && <HeroCard college={top3[2]} rank={3} onVote={handleVote} isVoting={isVoting} totalVotes={totalVotes} podiumMode />}
                            </div>
                        </div>
                    </section>

                    {/* 5. CONTENDERS */}
                    {contenders.length > 0 && (
                        <section>
                            <div className="flex items-center gap-4 mb-10">
                                <TrendingUp size={24} className="text-indigo-500" />
                                <h2 className="text-3xl font-black tracking-tight text-slate-900">Market Contenders</h2>
                                <div className="fw-glass px-4 py-1.5 rounded-full ml-4 text-[11px] font-black text-slate-600 border border-white/60 shadow-sm uppercase tracking-widest">
                                    Ranks 4 – {Math.min(10, stats.leaderboard.length)}
                                </div>
                                <div className="h-px bg-slate-200 flex-1 ml-4" />
                            </div>

                            <div className="flex flex-col gap-3">
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

            {/* VOTE BURST FX */}
            <AnimatePresence>
                {burstPos && (
                    <div
                        className="fixed pointer-events-none z-[9999]"
                        style={{ top: burstPos.y - 60, left: burstPos.x - 60, width: 120, height: 120 }}
                    >
                        <div className="burst-ring absolute inset-0 rounded-full border-[6px] border-indigo-500/30" />
                        <div className="burst-ring absolute inset-3 rounded-full border-[4px] border-amber-400/20" style={{ animationDelay: "0.15s" }} />
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
