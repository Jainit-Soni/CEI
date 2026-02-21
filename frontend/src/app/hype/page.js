"use client";

import React, { useState, useEffect, useRef } from 'react';
import Container from '@/components/Container';
import { fetchHypeStats, postHypeVote, searchAll } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from "@/components/Toast";
import {
    Zap, MapPin, Loader2, Trophy, Flame, ShieldCheck,
    TrendingUp, Plus, Search, Crown, Activity, Sparkles
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { RevealOnScroll } from "@/lib/useIntersectionObserver";
import "./page.css";

// ─────────────────────────────────────────────
// REUSABLE COMPONENTS
// ─────────────────────────────────────────────

function AnimatedNumber({ value }) {
    const [display, setDisplay] = useState(value);
    useEffect(() => {
        const start = display, end = value;
        if (start === end) return;
        const dur = 800;
        const startTime = performance.now();
        const tick = (now) => {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / dur, 1);
            const ease = 1 - Math.pow(1 - progress, 3);
            setDisplay(Math.floor(start + (end - start) * ease));
            if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }, [value]);
    return <span className="tabular-nums">{display.toLocaleString()}</span>;
}

// ─────────────────────────────────────────────
// ARENA PODIUM CARD
// ─────────────────────────────────────────────
function ArenaCard({ col, rank, total, onVote, isVoting }) {
    if (!col) return null;
    const pct = total > 0 ? (col.votes / total) * 100 : 0;
    const isFirst = rank === 1;

    return (
        <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: rank * 0.15, duration: 0.6 }}
            className={`stage-card group ${isFirst ? 'border-amber-500/20' : ''}`}
        >
            <div className={`card-rank-badge rank-${rank}-badge`}>{rank}</div>

            <div className="relative z-10">
                <div className="stage-card-loc">
                    <MapPin size={12} /> {col.location || "India"}
                </div>
                <h3 className="stage-card-title mt-2">
                    {col.name}
                </h3>

                <div className="arena-score-block">
                    <div className="text-[10px] uppercase tracking-[0.3em] font-black text-slate-500 mb-1">
                        Battle Power
                    </div>
                    <div className="arena-score-val">
                        <AnimatedNumber value={col.votes} />
                    </div>
                    <div className="arena-progress-track">
                        <motion.div
                            className={`arena-progress-bar bar-${rank}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.max(pct, 5)}%` }}
                            transition={{ delay: 0.8, duration: 1.5 }}
                        />
                    </div>
                </div>

                <button
                    onClick={(e) => onVote(e, col)}
                    disabled={isVoting}
                    className={`hype-trigger ${isFirst ? 'rank1-btn' : ''}`}
                >
                    {isVoting ? <Loader2 size={18} className="animate-spin" /> : <Zap size={18} className="fill-current" />}
                    <span>Inject Hype</span>
                </button>
            </div>
        </motion.div>
    );
}

// ─────────────────────────────────────────────
// ARENA LIST ROW
// ─────────────────────────────────────────────
function ArenaRow({ col, rank, onVote, isVoting }) {
    return (
        <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="arena-list-item"
        >
            <div className="arena-list-rank">#{rank}</div>
            <div className="arena-list-name">{col.name}</div>
            <div className="arena-list-score">
                <AnimatedNumber value={col.votes} />
            </div>
            <button
                className="arena-list-btn"
                onClick={(e) => onVote(e, col)}
                disabled={isVoting}
            >
                {isVoting ? <Loader2 size={20} className="animate-spin" /> : <Plus size={24} />}
            </button>
        </motion.div>
    );
}

// ─────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────
export default function FanWarsTheArena() {
    const { user, signInWithGoogle } = useAuth();
    const { addToast } = useToast();

    const [stats, setStats] = useState({ leaderboard: [], recentVotes: [] });
    const [isVoting, setIsVoting] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [debQuery, setDebQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [showHypeLine, setShowHypeLine] = useState(false);
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
        setShowHypeLine(true);
        setTimeout(() => setShowHypeLine(false), 1000);

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
            return { ...prev, leaderboard: lb };
        });

        const sv = JSON.parse(localStorage.getItem('hype_v3_votes') || '[]');
        sv.push(collegeId);
        localStorage.setItem('hype_v3_votes', JSON.stringify(sv));

        try {
            await postHypeVote(payload);
            addToast(`Hype Surge: ${col.name} +1`, "success");
            setSearchQuery("");
            setSearchResults([]);
        } catch (err) {
            addToast("Connection error, retrying...", "error");
            fetchHypeStats().then(setStats);
        } finally {
            setIsVoting(false);
        }
    };

    const top3 = stats.leaderboard.slice(0, 3);
    const rest = stats.leaderboard.slice(3, 12);
    const total = stats.leaderboard.reduce((a, c) => a + (c.votes || 0), 0);

    return (
        <div className="arena-wrapper selection:bg-cyan-500/30">
            <div className="arena-nebula" />
            <div className="arena-grid-mesh" />

            <Container className="relative z-10 pt-40">
                {/* HERO STATS */}
                <div className="flex flex-col items-center text-center">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-4 mb-12"
                    >
                        <div className="arena-stat-pod">
                            <Flame size={16} /> <i><AnimatedNumber value={total} /></i> Vol.
                        </div>
                        <div className="arena-stat-pod">
                            <Trophy size={16} /> <i>{stats.leaderboard.length}</i> Active
                        </div>
                    </motion.div>

                    <h1 className="arena-title">
                        Fan Wars
                    </h1>
                    <p className="arena-subtitle">
                        The definitive arena for institution rankings. <br />
                        Witness the real-time power struggle of India&apos;s campuses.
                    </p>
                </div>

                {/* THE SEARCH */}
                <div className="arena-search-container" ref={searchRef}>
                    <div className="arena-search-box">
                        <Search className="text-slate-500" size={24} />
                        <input
                            type="text"
                            className="arena-search-input"
                            placeholder="Find your campus to boost..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <AnimatePresence>
                        {searchQuery && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="absolute top-full left-0 right-0 mt-4 bg-slate-900/95 border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-3xl"
                            >
                                {searchResults.length > 0 ? searchResults.map(c => (
                                    <div
                                        key={c.id}
                                        onClick={e => handleVote(e, c)}
                                        className="p-5 flex items-center justify-between hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0 group"
                                    >
                                        <div>
                                            <div className="font-bold text-white group-hover:text-cyan-400 transition-colors">{c.name}</div>
                                            <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
                                                <MapPin size={10} /> {c.location}
                                            </div>
                                        </div>
                                        <Plus size={20} className="text-slate-500 group-hover:text-white" />
                                    </div>
                                )) : (
                                    <div className="p-8 text-center text-slate-500 font-bold">No Match Detected</div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* THE STAGE (Top 3) */}
                <div className="modern-podium">
                    {/* #2 */}
                    <div className="order-2 lg:order-1">
                        {top3[1] && <ArenaCard col={top3[1]} rank={2} total={total} onVote={handleVote} isVoting={isVoting} />}
                    </div>
                    {/* #1 */}
                    <div className="order-1 lg:order-2">
                        {top3[0] && <ArenaCard col={top3[0]} rank={1} total={total} onVote={handleVote} isVoting={isVoting} />}
                    </div>
                    {/* #3 */}
                    <div className="order-3 lg:order-3">
                        {top3[2] && <ArenaCard col={top3[2]} rank={3} total={total} onVote={handleVote} isVoting={isVoting} />}
                    </div>
                </div>

                {/* THE LIST */}
                {rest.length > 0 && (
                    <div className="contender-grid">
                        <div className="flex items-center gap-4 mb-8">
                            <Activity size={24} className="text-cyan-500" />
                            <h2 className="text-2xl font-black uppercase tracking-tighter">Rising Potential</h2>
                        </div>
                        {rest.map((c, i) => (
                            <ArenaRow key={c.id} col={c} rank={i + 4} onVote={handleVote} isVoting={isVoting} />
                        ))}
                    </div>
                )}
            </Container>

            {/* Shockwave Visual Feedback */}
            <AnimatePresence>
                {showHypeLine && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0 }}
                        animate={{ opacity: 1, scale: 4 }}
                        exit={{ opacity: 0 }}
                        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[9999] w-[100vw] h-[100vh] bg-white/5 rounded-full filter blur-3xl border-8 border-cyan-500/20"
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
