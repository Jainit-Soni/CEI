"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import Container from '@/components/Container';
import GlassPanel from '@/components/GlassPanel'; // Keeping for consistency if needed, but styling overrides
import { fetchHypeStats, postHypeVote, searchAll } from '@/lib/api';
import { useAuth } from '@/lib/AuthContext';
import { Search, Flame, ArrowUp, Zap, Lock, Crown, Trophy, Medal } from 'lucide-react';
import { RevealOnScroll } from "@/lib/useIntersectionObserver";
import { useRouter } from 'next/navigation';

// --- INTERNAL COMPONENTS FOR V20 ---

// 1. PODIUM CARD - SPECIALIZED FOR TOP 3
const PodiumCard = ({ rank, college, onVote, user }) => {
    if (!college) return null;

    const isGold = rank === 1;
    const isSilver = rank === 2;
    const isBronze = rank === 3;

    let glowColor = "bg-amber-500";
    let borderColor = "border-amber-400";
    let badgeGradient = "from-amber-300 to-orange-500";
    let badgeIcon = <Crown size={16} fill="currentColor" className="text-white" />;
    let rankTitle = "CHAMPION";
    let scaleClass = isGold ? "scale-105 z-20" : "scale-100 z-10 mt-8";

    if (isSilver) {
        glowColor = "bg-slate-400";
        borderColor = "border-slate-300";
        badgeGradient = "from-slate-300 to-slate-500";
        badgeIcon = <Trophy size={14} className="text-white" />;
        rankTitle = "SILVER";
    }
    if (isBronze) {
        glowColor = "bg-orange-400";
        borderColor = "border-orange-300";
        badgeGradient = "from-orange-300 to-amber-700";
        badgeIcon = <Medal size={14} className="text-white" />;
        rankTitle = "BRONZE";
    }

    return (
        <div className={`relative group transition-transform duration-500 ease-out hover:scale-[1.02] ${scaleClass}`} style={{ width: '320px' }}>
            {/* AMBIENT GLOW */}
            <div className={`absolute inset-0 ${glowColor} blur-[60px] opacity-20 group-hover:opacity-40 transition-opacity duration-700 rounded-full pointer-events-none`}></div>

            {/* FLOATING BADGE */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-30">
                <div className={`bg-gradient-to-r ${badgeGradient} text-white font-black text-xs tracking-wider px-4 py-1.5 rounded-full shadow-lg border-2 border-white flex items-center gap-1.5 uppercase`}>
                    {badgeIcon}
                    <span>#{rank} {rankTitle}</span>
                </div>
            </div>

            {/* GLASS CARD CONTENT */}
            <div className="relative bg-white/70 backdrop-blur-xl border border-white/50 rounded-3xl p-6 shadow-2xl overflow-visible flex flex-col items-center text-center h-[340px]">
                {/* LOGO FALLBACK/PLACEHOLDER */}
                <div className="w-20 h-20 mb-4 rounded-full bg-white shadow-md flex items-center justify-center p-2 border border-slate-100 group-hover:scale-110 transition-transform duration-500">
                    {college.logo ? (
                        <img src={college.logo} alt={college.name} className="w-full h-full object-contain" />
                    ) : (
                        <span className="text-3xl">🏛️</span>
                    )}
                </div>

                {/* TEXT */}
                <h3 className="text-slate-900 font-bold text-lg leading-tight mb-2 line-clamp-2 min-h-[3.5rem]">
                    {college.name}
                </h3>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-6">
                    {college.location || "India"}
                </p>

                {/* VOTE COUNT BIG */}
                <div className="mt-auto mb-8">
                    <span className={`text-4xl font-black bg-clip-text text-transparent bg-gradient-to-r ${badgeGradient}`}>
                        {college.votes}
                    </span>
                    <span className="text-slate-400 text-xs font-bold block mt-1 uppercase">Total Votes</span>
                </div>

                {/* FLOATING VOTE BUTTON */}
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-full px-8">
                    <button
                        onClick={(e) => onVote(e, college)}
                        className={`w-full py-3.5 bg-gradient-to-r ${badgeGradient} text-white font-black text-sm rounded-full shadow-xl shadow-slate-900/10 hover:shadow-2xl hover:-translate-y-1 active:scale-95 transition-all flex items-center justify-center gap-2 border-2 border-white/20`}
                    >
                        <ArrowUp size={18} strokeWidth={3} /> VOTE NOW
                    </button>
                </div>
            </div>
        </div>
    );
};

// 2. LIST ROW - FOR #4-20
const RankRow = ({ rank, college, onVote }) => (
    <Link href={`/college/${college.id}`} className="group block mb-3">
        <div className="flex items-center gap-4 bg-white/60 backdrop-blur-md border border-white/60 rounded-xl p-3 shadow-sm hover:shadow-md hover:bg-white/90 transition-all duration-300 transform hover:scale-[1.01]">
            {/* RANK */}
            <div className="w-12 h-12 flex items-center justify-center rounded-lg bg-slate-50 text-slate-400 font-mono font-bold text-lg border border-slate-100 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
                #{rank}
            </div>

            {/* INFO */}
            <div className="flex-1 min-w-0">
                <h4 className="font-bold text-slate-800 text-base truncate group-hover:text-indigo-700 transition-colors">
                    {college.name}
                </h4>
                <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                    <span>{college.location || "India"}</span>
                </div>
            </div>

            {/* METRICS & ACTION */}
            <div className="flex items-center gap-6 pr-2">
                <div className="text-right hidden sm:block">
                    <div className="font-black text-slate-800 text-lg">{college.votes}</div>
                    <div className="text-[10px] text-slate-400 font-bold uppercase">Votes</div>
                </div>
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        onVote(e, college);
                    }}
                    className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:bg-indigo-600 hover:text-white transition-all shadow-sm hover:shadow-lg"
                >
                    <ArrowUp size={20} />
                </button>
            </div>
        </div>
    </Link>
);


// --- MAIN PAGE COMPONENT ---

export default function HypePage() {
    const { user, signInWithGoogle } = useAuth();
    const router = useRouter();

    // State
    const [stats, setStats] = useState({ leaderboard: [], recentVotes: [] });
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isVoting, setIsVoting] = useState(false);
    const [debouncedQuery, setDebouncedQuery] = useState("");

    // Debounce
    useEffect(() => {
        const h = setTimeout(() => setDebouncedQuery(searchQuery), 300);
        return () => clearTimeout(h);
    }, [searchQuery]);

    // Initial Load & Polling
    useEffect(() => {
        const load = () => fetchHypeStats().then(setStats).catch(console.error);
        load();
        const interval = setInterval(load, 10000);
        return () => clearInterval(interval);
    }, []);

    // Search Effect
    useEffect(() => {
        if (!debouncedQuery) {
            setSearchResults([]);
            return;
        }
        searchAll({ q: debouncedQuery }).then(d => setSearchResults(d.colleges || [])).catch(console.error);
    }, [debouncedQuery]);

    // Vote Logic
    const handleVote = async (e, college) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        if (!user) {
            signInWithGoogle().catch(console.error);
            return;
        }

        if (isVoting) return;
        setIsVoting(true);

        const collegeId = college.id || college._id;
        const userName = user.displayName || user.email.split('@')[0] || "Fan";

        // Optimistic UI Update
        const newLeaderboard = [...stats.leaderboard];
        const idx = newLeaderboard.findIndex(c => c.id === collegeId);
        if (idx >= 0) {
            newLeaderboard[idx].votes += 1;
        } else {
            newLeaderboard.push({ ...college, votes: 1 });
        }
        newLeaderboard.sort((a, b) => b.votes - a.votes);

        setStats(prev => ({
            ...prev,
            leaderboard: newLeaderboard,
            recentVotes: [{ collegeName: college.name, userName, timestamp: new Date() }, ...prev.recentVotes].slice(0, 10)
        }));

        try {
            await postHypeVote({
                collegeId,
                collegeName: college.name,
                userId: user.uid,
                userName
            });
            setSearchQuery(""); // Clear search on vote
        } catch (err) {
            console.error("Vote error", err);
            // Revert on error roughly (omitted for speed)
        } finally {
            setIsVoting(false);
        }
    };

    const top3 = stats.leaderboard.slice(0, 3);
    const rest = stats.leaderboard.slice(3, 20);

    return (
        <div className="list-page min-h-screen pb-32">
            {/* GLOBAL BACKGROUND ELEMENTS */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-200 rounded-full blur-[120px] opacity-30 animate-pulse-slow"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-200 rounded-full blur-[120px] opacity-30 animate-pulse-slow delay-1000"></div>
            </div>

            <Container className="relative z-10">

                {/* 1. HERO SECTION */}
                <div className="pt-24 pb-12 text-center">
                    <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/5 border border-slate-900/10 text-slate-600 font-bold text-xs uppercase tracking-widest mb-6 animate-in fade-in slide-in-from-bottom-4">
                        <Flame size={14} className="text-orange-500 fill-orange-500" /> Season 1 Live
                    </span>
                    <h1 className="text-5xl md:text-7xl font-black text-slate-900 mb-6 tracking-tight animate-in fade-in slide-in-from-bottom-6 duration-700">
                        Campus <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Legends</span>
                    </h1>
                    <p className="text-lg md:text-xl text-slate-500 max-w-2xl mx-auto font-medium leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                        The ultimate popularity contest. Vote for your college to prove which campus has the strongest community in India.
                    </p>
                </div>

                {/* 2. FLOATING SEARCH PILL */}
                <div className="sticky top-6 z-50 max-w-xl mx-auto mb-20 animate-in fade-in zoom-in-95 duration-500 delay-200">
                    <div className="relative group">
                        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full opacity-20 group-hover:opacity-40 blur transition duration-500"></div>
                        <div className="relative flex items-center bg-white/80 backdrop-blur-2xl border border-white/50 shadow-2xl rounded-full px-2 py-2 transition-all group-hover:scale-[1.01]">
                            <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center shrink-0">
                                <Search size={20} />
                            </div>
                            <input
                                type="text"
                                className="flex-1 bg-transparent border-none focus:ring-0 text-slate-900 placeholder-slate-400 font-medium px-4 h-10"
                                placeholder="Find your college and vote..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {!user && (
                                <div className="pr-4 hidden sm:flex items-center gap-1 text-xs font-bold text-amber-500">
                                    <Lock size={12} /> LOGIN
                                </div>
                            )}
                        </div>

                        {/* DROPDOWN RESULTS */}
                        {searchQuery && (
                            <div className="absolute top-full left-0 right-0 mt-4 bg-white/90 backdrop-blur-xl rounded-2xl border border-white/50 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 origin-top z-50 max-h-[400px] overflow-y-auto custom-scrollbar p-2">
                                {searchResults.length > 0 ? searchResults.map(c => (
                                    <div key={c.id} onClick={() => handleVote(null, c)} className="flex items-center justify-between p-3 hover:bg-indigo-50/50 rounded-xl cursor-pointer group/item transition-colors">
                                        <div className="font-bold text-slate-800 text-sm">{c.name}</div>
                                        <div className="text-xs font-bold text-indigo-500 opacity-0 group-hover/item:opacity-100 transition-opacity">VOTE +1</div>
                                    </div>
                                )) : (
                                    <div className="p-4 text-center text-slate-400 text-sm">No colleges found.</div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* 3. PODIUM SECTION - THE MAIN EVENT */}
                <div className="mb-32">
                    <div className="flex flex-wrap justify-center items-end gap-8 md:gap-12 min-h-[400px]">
                        {/* SILVER (#2) - LEFT */}
                        {top3[1] && (
                            <div className="order-1 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-300">
                                <PodiumCard rank={2} college={top3[1]} onVote={handleVote} user={user} />
                            </div>
                        )}

                        {/* GOLD (#1) - CENTER - BIGGEST */}
                        {top3[0] && (
                            <div className="order-2 mb-12 animate-in fade-in slide-in-from-bottom-16 duration-1000 delay-500">
                                <PodiumCard rank={1} college={top3[0]} onVote={handleVote} user={user} />
                            </div>
                        )}

                        {/* BRONZE (#3) - RIGHT */}
                        {top3[2] && (
                            <div className="order-3 animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-400">
                                <PodiumCard rank={3} college={top3[2]} onVote={handleVote} user={user} />
                            </div>
                        )}
                    </div>
                </div>

                {/* 4. THE REST OF THE PACK & LIVE FEED GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
                    {/* LEADERBOARD LIST */}
                    <div className="lg:col-span-2">
                        <h2 className="text-xl font-black text-slate-900 mb-6 flex items-center gap-2">
                            <span className="text-slate-300">#</span> Challengers
                        </h2>
                        <div className="space-y-2">
                            {rest.map((college, i) => (
                                <RankRow key={college.id} rank={i + 4} college={college} onVote={handleVote} />
                            ))}
                            {rest.length === 0 && top3.length === 0 && (
                                <div className="text-center py-20 text-slate-400">Loading legends...</div>
                            )}
                        </div>
                    </div>

                    {/* LIVE TICKER */}
                    <div>
                        <div className="sticky top-32">
                            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span> Live Activity
                            </h2>
                            <div className="bg-white/50 backdrop-blur-xl border border-white/50 rounded-2xl p-6 shadow-xl relative overflow-hidden">
                                <div className="space-y-6 relative z-10">
                                    {stats.recentVotes.map((vote, i) => (
                                        <div key={i} className="flex gap-4 animate-in fade-in slide-in-from-right-8 duration-500">
                                            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0 text-sm">
                                                <Zap size={14} fill="currentColor" />
                                            </div>
                                            <div>
                                                <p className="text-sm text-slate-600 leading-relaxed">
                                                    <span className="font-bold text-slate-900">{vote.userName}</span> just voted for <span className="font-bold text-indigo-600">{vote.collegeName}</span>
                                                </p>
                                                <span className="text-[10px] text-slate-400 font-bold uppercase">Just now</span>
                                            </div>
                                        </div>
                                    ))}
                                    {stats.recentVotes.length === 0 && <div className="text-slate-400 text-sm italic">Waiting for votes...</div>}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

            </Container>

            {/* VERSION MARKER - V20 PHOENIX */}
            <div className="fixed bottom-4 right-4 z-50 opacity-30 text-[10px] font-mono pointer-events-none">V20-PHOENIX</div>
        </div>
    );
}
