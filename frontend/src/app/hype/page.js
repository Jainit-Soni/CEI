"use client";

import React, { useState, useEffect, useRef } from 'react';
import Container from '@/components/Container';
import { fetchHypeStats, postHypeVote, searchAll } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from "@/components/Toast";
import {
    Zap, MapPin, Loader2, Trophy, Flame,
    TrendingUp, Plus, Search, Activity
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import "./page.css";

// ─────────────────────────────────────────────
// REUSABLE COMPONENTS
// ─────────────────────────────────────────────

function AnimatedNumber({ value }) {
    const [display, setDisplay] = useState(value);
    useEffect(() => {
        const start = display, end = value;
        if (start === end) return;
        const dur = 600; // snappier
        const startTime = performance.now();
        const tick = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / dur, 1);
            const ease = 0.16, // faster start
                easeFunc = 1 - Math.pow(1 - progress, 4);
            setDisplay(Math.floor(start + (end - start) * easeFunc));
            if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }, [value]);
    return <span className="tabular-nums">{display.toLocaleString()}</span>;
}

function LiveTicker({ votes }) {
    if (!votes || votes.length === 0) return null;
    // Double for seamless loop
    const double = [...votes, ...votes];
    return (
        <div className="arena-ticker-wrap">
            <div className="ticker-track">
                {double.map((v, i) => (
                    <div key={i} className="ticker-item">
                        <Flame size={14} />
                        <b>{v.userName}</b>
                        <span>pushed hype for</span>
                        <i>{v.collegeName}</i>
                        <span className="mx-2 text-slate-300">•</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─────────────────────────────────────────────
// CRYSTAL PILLAR CARD
// ─────────────────────────────────────────────
function CrystalPillar({ col, rank, total, onVote, isVoting }) {
    if (!col) return null;
    const pct = total > 0 ? (col.votes / total) * 100 : 0;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.9, rotateX: 20 }}
            animate={{ opacity: 1, scale: 1, rotateX: 0 }}
            transition={{ delay: rank * 0.1, duration: 0.8 }}
            className={`crystal-pillar rank-${rank}`}
        >
            <div className="crystal-rank">{rank}</div>

            <div className="relative z-10 flex flex-col items-center">
                <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 tracking-widest uppercase mb-4">
                    <MapPin size={10} /> {col.location?.split(',')[0] || "Campus"}
                </div>

                <h3 className="pillar-title">
                    {col.name}
                </h3>

                <div className="pillar-score-wrap">
                    <div className="pillar-score">
                        <AnimatedNumber value={col.votes} />
                    </div>
                </div>

                <div className="w-full">
                    <div className="pillar-progress-track">
                        <motion.div
                            className={`pillar-progress-bar color-${rank}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.max(pct, 5)}%` }}
                            transition={{ delay: 0.5, duration: 1.2 }}
                        />
                    </div>
                </div>

                <button
                    onClick={(e) => onVote(e, col)}
                    disabled={isVoting}
                    className="crystal-btn"
                >
                    {isVoting ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} className="fill-current" />}
                    <span>Push Hype</span>
                </button>
            </div>
        </motion.div>
    );
}

// ─────────────────────────────────────────────
// CRYSTAL LIST ROW
// ─────────────────────────────────────────────
function CrystalRow({ col, rank, onVote, isVoting }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="crystal-row"
        >
            <div className="row-rank">#{rank}</div>
            <div className="row-name">{col.name}</div>
            <div className="row-score">
                <AnimatedNumber value={col.votes} />
            </div>
            <button
                className="row-add"
                onClick={(e) => onVote(e, col)}
                disabled={isVoting}
            >
                {isVoting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={18} />}
            </button>
        </motion.div>
    );
}

// ─────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────
export default function FanWarsTheCrystalArena() {
    const { user, signInWithGoogle } = useAuth();
    const { addToast } = useToast();

    const [stats, setStats] = useState({ leaderboard: [], recentVotes: [] });
    const [isVoting, setIsVoting] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [debQuery, setDebQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [burst, setBurst] = useState(false);
    const searchRef = useRef(null);

    useEffect(() => {
        fetchHypeStats().then(setStats).catch(console.error);
        const id = setInterval(() => fetchHypeStats().then(setStats).catch(console.error), 10000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        const t = setTimeout(() => setDebQuery(searchQuery), 300);
        return () => clearTimeout(t);
    }, [searchQuery]);

    useEffect(() => {
        if (!debQuery.trim()) { setSearchResults([]); return; }
        searchAll({ q: debQuery })
            .then(d => setSearchResults((d.colleges || []).slice(0, 6)))
            .catch(console.error);
    }, [debQuery]);

    const handleVote = async (e, col) => {
        e.preventDefault();
        if (!user) { try { await signInWithGoogle(); } catch { } return; }

        const collegeId = col.id || col._id;
        const voted = JSON.parse(localStorage.getItem('hype_v3_votes') || '[]');
        if (voted.includes(collegeId)) {
            addToast("You've contributed to this campus recently!", "error");
            return;
        }

        setIsVoting(true);
        setBurst(true);
        setTimeout(() => setBurst(false), 800);

        const userName = user.displayName || user.email?.split('@')[0] || "Student";
        const payload = {
            collegeId,
            collegeName: col.name,
            uid: user.uid,
            userName
        };

        // Optimistic UI
        setStats(prev => {
            const lb = [...prev.leaderboard];
            const idx = lb.findIndex(c => c.id === collegeId);
            if (idx >= 0) lb[idx] = { ...lb[idx], votes: lb[idx].votes + 1 };
            else lb.push({ id: collegeId, name: col.name, votes: 1, location: col.location });
            lb.sort((a, b) => b.votes - a.votes);

            // Add to ticker optimistically
            const newTicker = [{ userName, collegeName: col.name }, ...prev.recentVotes].slice(0, 10);
            return { ...prev, leaderboard: lb, recentVotes: newTicker };
        });

        const sv = JSON.parse(localStorage.getItem('hype_v3_votes') || '[]');
        sv.push(collegeId);
        localStorage.setItem('hype_v3_votes', JSON.stringify(sv));

        try {
            await postHypeVote(payload);
            addToast(`Crystal Surge: ${col.name} +1`, "success");
            setSearchQuery("");
            setSearchResults([]);
        } catch (err) {
            addToast("Sync error, retrying...", "error");
            fetchHypeStats().then(setStats);
        } finally {
            setIsVoting(false);
        }
    };

    const top3 = stats.leaderboard.slice(0, 3);
    const rest = stats.leaderboard.slice(3, 12);
    const total = stats.leaderboard.reduce((a, c) => a + (c.votes || 0), 0);

    return (
        <div className="crystal-wrapper">
            <Container className="relative z-10 pt-40">

                {/* HERO SECTION */}
                <div className="flex flex-col items-center text-center">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center gap-3 mb-8 bg-black/5 px-4 py-2 rounded-full border border-black/5"
                    >
                        <TrendingUp size={16} className="text-slate-400" />
                        <span className="text-xs font-black uppercase tracking-widest text-slate-500">Live Popularity Arena</span>
                    </motion.div>

                    <h1 className="crystal-title">
                        Fan Wars
                    </h1>
                    <p className="crystal-subtitle">
                        India&apos;s most prestigious campus ranking. Use your influence to push your institution to the diamond rankings.
                    </p>

                    <div className="flex items-center gap-12 mt-12 mb-12">
                        <div className="text-center">
                            <div className="text-5xl font-black text-slate-800 mb-5">
                                <AnimatedNumber value={total} />
                            </div>
                            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-[0.2em]">Total Hype Volume</div>
                        </div>
                        <div className="w-[1px] h-16 bg-slate-200" />
                        <div className="text-center">
                            <div className="text-5xl font-black text-slate-800 mb-5">
                                {stats.leaderboard.length}
                            </div>
                            <div className="text-[10px] uppercase font-bold text-slate-400 tracking-[0.2em]">Active Contenders</div>
                        </div>
                    </div>
                </div>

                {/* THE DIAMOND SEARCH */}
                <div className="crystal-search-wrap" ref={searchRef}>
                    <div className="diamond-search">
                        <Search className="text-slate-300" size={24} />
                        <input
                            type="text"
                            placeholder="Find any institution to boost..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <AnimatePresence>
                        {searchQuery && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.98, y: -10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                className="absolute top-full left-0 right-0 mt-4 bg-white border border-black/5 rounded-2xl shadow-2xl overflow-hidden z-50"
                            >
                                {searchResults.length > 0 ? searchResults.map(c => (
                                    <div
                                        key={c.id}
                                        onClick={e => handleVote(e, c)}
                                        className="p-6 flex items-center justify-between hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-0 group gap-4"
                                    >
                                        <div className="flex-1">
                                            <div className="font-bold text-slate-900 text-lg mb-1">{c.name}</div>
                                            <div className="text-[11px] text-slate-500 font-medium leading-tight">
                                                {c.location || c.city + ", " + c.state}
                                            </div>
                                        </div>
                                        <div className="row-add">
                                            <Plus size={20} />
                                        </div>
                                    </div>
                                )) : (
                                    <div className="p-8 text-center text-slate-400 font-bold">Searching for Arena entry...</div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* LIVE VOTE FEED */}
                <LiveTicker votes={stats.recentVotes} />

                {/* THE CRYSTAL PODIUM */}
                <div className="crystal-podium">
                    {/* #2 */}
                    <div className="order-2 lg:order-1 self-end">
                        {top3[1] && <CrystalPillar col={top3[1]} rank={2} total={total} onVote={handleVote} isVoting={isVoting} />}
                    </div>
                    {/* #1 */}
                    <div className="order-1 lg:order-2 self-end">
                        {top3[0] && <CrystalPillar col={top3[0]} rank={1} total={total} onVote={handleVote} isVoting={isVoting} />}
                    </div>
                    {/* #3 */}
                    <div className="order-3 lg:order-3 self-end">
                        {top3[2] && <CrystalPillar col={top3[2]} rank={3} total={total} onVote={handleVote} isVoting={isVoting} />}
                    </div>
                </div>

                {/* THE CRYSTAL LIST */}
                {rest.length > 0 && (
                    <div className="crystal-list">
                        <div className="flex items-center gap-3 mb-6 px-2">
                            <Activity size={20} className="text-slate-400" />
                            <h2 className="text-lg font-black uppercase tracking-tighter text-slate-800">Rising Contenders</h2>
                        </div>
                        {rest.map((c, i) => (
                            <CrystalRow key={c.id} col={c} rank={i + 4} onVote={handleVote} isVoting={isVoting} />
                        ))}
                    </div>
                )}
            </Container>

            {/* Shine Burst Effect */}
            <AnimatePresence>
                {burst && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 2 }}
                        exit={{ opacity: 0 }}
                        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[9999] w-[100vw] h-[100vh] bg-white/40 rounded-full filter blur-3xl mix-blend-overlay"
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
