"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Container from '@/components/Container';
import { fetchHypeStats, postHypeVote, searchAll } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { useToast } from "@/components/Toast";
import {
    Zap, MapPin, Loader2, Trophy, Flame,
    TrendingUp, Search, Activity
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import "./page.css";

// ─────────────────────────────────────────────
// REUSABLE COMPONENTS
// ─────────────────────────────────────────────

function SlottedDigit({ digit }) {
    const n = parseInt(digit) || 0;
    return (
        <div className="slotted-container">
            <motion.div
                key={digit}
                initial={{ y: "100%" }}
                animate={{ y: `-${n * 10}%` }}
                transition={{ type: "spring", stiffness: 100, damping: 15 }}
                className="slotted-digit-wrap"
            >
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <div key={num} className="slotted-digit">{num}</div>
                ))}
            </motion.div>
        </div>
    );
}

function AmazingNumber({ value }) {
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    if (!mounted) return <span className="opacity-0 font-display">{value}</span>;

    const valStr = (value || 0).toString();
    const digits = valStr.split('');

    return (
        <div className="flex items-center justify-center" style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: 0 }}>
            {digits.map((d, i) => (
                <SlottedDigit key={`${i}-${valStr.length}`} digit={d} />
            ))}
        </div>
    );
}

// ─────────────────────────────────────────────
// VOTE PARTICLE BURST
// ─────────────────────────────────────────────
const PARTICLE_COLORS = [
    '#6366f1', '#818cf8', '#a5b4fc', '#fbbf24', '#f43f5e', '#34d399', '#38bdf8', '#f97316',
];

function VoteParticles({ origin, onComplete }) {
    const count = 12;
    const particles = Array.from({ length: count }, (_, i) => {
        const angle = (i / count) * 360;
        const dist = 80 + Math.random() * 60;
        const rad = (angle * Math.PI) / 180;
        const x = Math.cos(rad) * dist;
        const y = Math.sin(rad) * dist;
        const color = PARTICLE_COLORS[i % PARTICLE_COLORS.length];
        const size = 6 + Math.random() * 6;
        return { x, y, color, size };
    });

    return (
        <motion.div
            className="fixed pointer-events-none z-[9999]"
            style={{ left: origin.x, top: origin.y }}
            initial="initial"
            animate="animate"
            onAnimationComplete={onComplete}
        >
            {/* Shockwave ring */}
            <motion.div
                className="absolute rounded-full border-2 border-indigo-400"
                style={{ x: '-50%', y: '-50%' }}
                initial={{ scale: 0, opacity: 0.9 }}
                animate={{ scale: 3.5, opacity: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
            />
            <motion.div
                className="absolute rounded-full border border-yellow-400"
                style={{ x: '-50%', y: '-50%' }}
                initial={{ scale: 0, opacity: 0.7 }}
                animate={{ scale: 2.5, opacity: 0 }}
                transition={{ duration: 0.5, ease: 'easeOut', delay: 0.05 }}
            />
            {/* Particles */}
            {particles.map((p, i) => (
                <motion.div
                    key={i}
                    className="absolute rounded-full"
                    style={{
                        width: p.size,
                        height: p.size,
                        backgroundColor: p.color,
                        x: '-50%',
                        y: '-50%',
                    }}
                    initial={{ x: '-50%', y: '-50%', opacity: 1, scale: 1 }}
                    animate={{
                        x: `calc(-50% + ${p.x}px)`,
                        y: `calc(-50% + ${p.y}px)`,
                        opacity: 0,
                        scale: 0,
                    }}
                    transition={{ duration: 0.7, ease: 'easeOut', delay: i * 0.02 }}
                />
            ))}
        </motion.div>
    );
}

function LiveTicker({ votes }) {
    if (!votes || votes.length === 0) return null;
    const double = [...votes, ...votes, ...votes];
    return (
        <div className="arena-ticker-wrap">
            <div className="ticker-track">
                {double.map((v, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="ticker-item"
                    >
                        <Flame size={14} className="text-orange-500 fill-current" />
                        <b>{v.userName}</b>
                        <span>pushed hype for</span>
                        <i>{v.collegeName}</i>
                        <span className="mx-4 text-slate-200">•</span>
                    </motion.div>
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
            initial={{ opacity: 0, scale: 0.9, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            whileHover={{ y: -10, scale: 1.02 }}
            transition={{ delay: rank * 0.15, type: "spring", stiffness: 100 }}
            className={`crystal-pillar rank-${rank}`}
        >
            <div className="crystal-rank shadow-xl">{rank}</div>

            <div className="relative z-10 flex flex-col items-center">
                <div className="flex items-center gap-1 text-[9px] lg:text-[10px] font-black text-slate-400 tracking-[0.2em] uppercase mb-4 opacity-70">
                    <MapPin size={10} /> {col.location?.split(',')[0] || "University"}
                </div>

                <h3 className="pillar-title">
                    {col.name}
                </h3>

                <div className="pillar-score-wrap">
                    <div className="pillar-score">
                        <AmazingNumber value={col.votes} />
                    </div>
                </div>

                <div className="w-full">
                    <div className="pillar-progress-track">
                        <motion.div
                            className={`pillar-progress-bar color-${rank}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.max(pct, 8)}%` }}
                            transition={{ delay: 0.5, duration: 2, ease: "circOut" }}
                        />
                    </div>
                </div>

                <motion.button
                    whileTap={{ scale: 0.92 }}
                    onClick={(e) => onVote(e, col)}
                    disabled={isVoting}
                    className="crystal-btn group overflow-hidden relative"
                >
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] pointer-events-none" />
                    {isVoting ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} className="fill-current" />}
                    <span>Push Hype</span>
                </motion.button>
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
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            whileHover={{ scale: 1.02, x: 10, backgroundColor: "rgba(255,255,255,1)" }}
            viewport={{ once: true }}
            className="crystal-row group border-l-4 border-l-transparent hover:border-l-indigo-500"
        >
            <div className="row-rank text-slate-300 font-black group-hover:text-indigo-200">#{rank}</div>
            <div className="flex-1">
                <div className="row-name group-hover:text-indigo-600 transition-colors uppercase font-black tracking-tighter text-lg leading-tight">{col.name}</div>
                <div className="text-[9px] font-black text-slate-400 tracking-widest uppercase mt-1 italic">Rising Powerhouses</div>
            </div>
            <div className="row-score text-slate-900 font-black text-2xl group-hover:scale-110 transition-transform">
                <AmazingNumber value={col.votes} />
            </div>
            <motion.button
                whileTap={{ scale: 0.88 }}
                className={`shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center transition-all shadow-lg ${isVoting
                    ? 'bg-slate-100 text-slate-300 pointer-events-none'
                    : 'bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-indigo-200 hover:shadow-indigo-500/40 hover:scale-110'
                    }`}
                onClick={(e) => onVote(e, col)}
                disabled={isVoting}
            >
                {isVoting ? <Loader2 size={16} className="animate-spin" /> : <Zap size={18} className="fill-current" />}
            </motion.button>
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
    const [voteParticles, setVoteParticles] = useState(null);
    const searchRef = useRef(null);

    useEffect(() => {
        const refresh = () => fetchHypeStats().then(d => {
            if (d && d.leaderboard) setStats(d);
        }).catch(console.error);
        refresh();
        const id = setInterval(refresh, 15000); // Relaxed to 15s to prevent 429s
        return () => clearInterval(id);
    }, []);

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

    /* ── Vote Handler ───────────────────────────────── */
    const handleVote = async (e, col) => {
        e.preventDefault();

        // Capture position SYNCHRONOUSLY before any async awaits
        const rect = e?.currentTarget?.getBoundingClientRect?.();
        if (rect) {
            setVoteParticles({
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
            });
        }
        setBurst(true);
        setTimeout(() => setBurst(false), 800);

        if (!user) { try { await signInWithGoogle(); } catch { } return; }

        const collegeId = col.id || col._id;
        const voted = JSON.parse(localStorage.getItem('hype_v4_votes') || '[]');
        if (voted.includes(collegeId)) {
            addToast("Your contribution is already fueling this campus!", "error");
            return;
        }

        setIsVoting(true);

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
            if (idx >= 0) lb[idx] = { ...lb[idx], votes: (lb[idx].votes || 0) + 1 };
            else lb.unshift({ id: collegeId, name: col.name, votes: 1, location: col.location });
            lb.sort((a, b) => (b.votes || 0) - (a.votes || 0));

            const newTicker = [{ userName: `YOU`, collegeName: col.name }, ...prev.recentVotes].slice(0, 15);
            return { ...prev, leaderboard: lb, recentVotes: newTicker };
        });

        // Save vote locally
        const sv = JSON.parse(localStorage.getItem('hype_v4_votes') || '[]');
        sv.push(collegeId);
        localStorage.setItem('hype_v4_votes', JSON.stringify(sv));

        // Clear search after short delay (so animation is visible)
        setTimeout(() => { setSearchQuery(""); setSearchResults([]); }, 600);

        try {
            await postHypeVote(payload);
            addToast(`Energy Surge Detected: ${col.name}`, "success");
        } catch (err) {
            addToast("Persistence fail, syncing...", "error");
            fetchHypeStats().then(d => { if (d?.leaderboard) setStats(d); });
        } finally {
            setIsVoting(false);
        }
    };

    const top3 = stats.leaderboard?.slice(0, 3) || [];
    const rest = stats.leaderboard?.slice(3, 50) || [];
    const total = (stats.leaderboard || []).reduce((a, c) => a + (Number(c.votes) || 0), 0);

    return (
        <div className="crystal-wrapper selection:bg-indigo-200">
            <Container className="relative z-10 pt-28 lg:pt-48 pb-20 lg:pb-40 px-4">

                {/* HERO SECTION */}
                <div className="flex flex-col items-center text-center max-w-4xl mx-auto">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex items-center gap-3 mb-10 bg-white/40 backdrop-blur-md px-6 py-3 rounded-full border border-white/60 shadow-xl"
                    >
                        <Flame size={20} className="text-orange-500 animate-bounce" />
                        <span className="text-xs font-black uppercase tracking-[0.4em] text-slate-600">Arena Level Master</span>
                    </motion.div>

                    <h1 className="crystal-title leading-[0.9] mb-6">
                        Hype Your <br /> Favorite University
                    </h1>

                    <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mb-8 lg:mb-12 opacity-60 px-4">
                        {user ? `Welcome back, ${user.displayName || 'Champion'}. Who gets your energy today?` : "Join the million-voice dialogue. Push your campus to the crown."}
                    </p>

                    {/* HERO STATS WITH AMAZING ANIMATION */}
                    <div className="flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-16 mt-6 lg:mt-10 mb-10 lg:mb-20">
                        <div className="text-center group">
                            <div className="text-5xl lg:text-9xl font-black text-slate-900 mb-3 lg:mb-6 tracking-tighter group-hover:scale-105 transition-transform duration-700 leading-none">
                                <AmazingNumber value={total} />
                            </div>
                            <div className="text-[10px] lg:text-[12px] uppercase font-black text-indigo-500 tracking-[0.2em] lg:tracking-[0.5em] group-hover:tracking-[0.6em] transition-all">Global Hype Surge</div>
                        </div>
                        <div className="text-center group">
                            <div className="text-5xl lg:text-9xl font-black text-slate-300 mb-3 lg:mb-6 tracking-tighter group-hover:text-slate-900 transition-colors duration-700 leading-none">
                                <AmazingNumber value={stats.leaderboard.length} />
                            </div>
                            <div className="text-[10px] lg:text-[12px] uppercase font-black text-slate-400 tracking-[0.2em] lg:tracking-[0.5em] group-hover:text-indigo-500 transition-all">Institutions</div>
                        </div>
                    </div>
                </div>

                {/* THE DIAMOND SEARCH */}
                <div className="crystal-search-wrap relative z-[500]" ref={searchRef}>
                    <div className="diamond-search h-20 border-indigo-500/30 bg-white/60 backdrop-blur-2xl shadow-indigo-500/5">
                        <Search className="text-indigo-500" size={32} />
                        <input
                            type="text"
                            className="bg-transparent text-2xl"
                            placeholder="Type to search and hype..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <AnimatePresence>
                        {searchQuery && (
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 20 }}
                                className="absolute top-full left-0 right-0 mt-3 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[1000] overflow-y-auto max-h-72"
                                style={{ scrollbarWidth: 'thin', scrollbarColor: '#6366f1 transparent' }}
                            >
                                {searchResults.length > 0 ? searchResults.map(c => (
                                    <div
                                        key={c.id}
                                        onClick={e => handleVote(e, c)}
                                        className="mx-2 my-1 px-4 py-3 flex items-center justify-between hover:bg-indigo-50 cursor-pointer border-b border-slate-100 last:border-0 rounded-xl group gap-3"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="font-bold text-slate-900 text-sm mb-0.5 group-hover:text-indigo-600 transition-colors uppercase tracking-tight leading-snug line-clamp-1">{c.name}</div>
                                            <div className="text-[10px] text-slate-400 font-medium tracking-wide line-clamp-1">
                                                {c.location || (c.city ? `${c.city}, ${c.state}` : c.state)}
                                            </div>
                                        </div>
                                        <motion.div
                                            whileTap={{ scale: 0.88, rotate: -10 }}
                                            className="shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center shadow-md shadow-indigo-200 group-hover:shadow-indigo-400/50 transition-all"
                                        >
                                            <Zap size={16} className="fill-current" />
                                        </motion.div>
                                    </div>
                                )) : (
                                    <div className="py-5 text-center text-slate-400 font-bold uppercase tracking-[0.3em] text-xs">Searching arenas...</div>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* LIVE VOTE FEED */}
                <LiveTicker votes={stats.recentVotes} />

                {/* THE CRYSTAL PODIUM - NEW MOBILE FOCUS LAYOUT */}
                <div className="crystal-podium relative">
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
                        <div className="flex items-center gap-4 mb-10 px-6">
                            <Activity size={24} className="text-indigo-500 animate-pulse" />
                            <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-900">Rising Powerhouses</h2>
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                            {rest.map((c, i) => (
                                <CrystalRow key={c.id} col={c} rank={i + 4} onVote={handleVote} isVoting={isVoting} />
                            ))}
                        </div>
                    </div>
                )}
            </Container>

            {/* Vote Particle Burst */}
            <AnimatePresence>
                {voteParticles && (
                    <VoteParticles
                        origin={voteParticles}
                        onComplete={() => setVoteParticles(null)}
                    />
                )}
            </AnimatePresence>

            {/* Shine Burst Effect */}
            <AnimatePresence>
                {burst && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 3 }}
                        exit={{ opacity: 0 }}
                        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-[8000] w-[150vw] h-[150vh] bg-indigo-500/20 rounded-full filter blur-[120px] mix-blend-screen"
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
