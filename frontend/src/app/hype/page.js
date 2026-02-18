"use client";

import React, { useState, useEffect } from 'react';
import Combobox from '@/components/Combobox';
import Container from '@/components/Container';
import GlassPanel from '@/components/GlassPanel';
import { fetchColleges } from '@/lib/api';
import { Trophy, Zap } from 'lucide-react';
import { RevealOnScroll } from "@/lib/useIntersectionObserver";
import "../colleges/page.css";

export default function BattlePage() {
    const [colleges, setColleges] = useState([]);
    const [college1, setCollege1] = useState(null);
    const [college2, setCollege2] = useState(null);
    const [winner, setWinner] = useState(null);
    const [battling, setBattling] = useState(false);

    useEffect(() => {
        // Fix for "t.find is not a function": Ensure we extract the array from the response object
        const load = async () => {
            try {
                const data = await fetchColleges();
                // Handle both { data: [...] } and [...] response formats safely
                const list = Array.isArray(data) ? data : (Array.isArray(data?.data) ? data.data : []);
                setColleges(list);
            } catch (err) {
                console.error("Failed to load colleges for battle:", err);
                setColleges([]);
            }
        };
        load();
    }, []);

    const startBattle = () => {
        if (!college1 || !college2) return;
        setBattling(true);
        setTimeout(() => {
            const score1 = calculateScore(college1);
            const score2 = calculateScore(college2);
            setWinner(score1 > score2 ? college1 : college2);
            setBattling(false);
        }, 2500);
    };

    const resetBattle = () => {
        setWinner(null);
        setBattling(false);
    };

    const calculateScore = (college) => {
        let score = 0;
        if (college.rating) score += college.rating * 20;
        if (college.placementAverage) score += parseInt(college.placementAverage) / 1000;
        return score;
    };

    return (
        <div className="list-page">
            <section className="list-hero list-hero--battle">
                <div className="list-hero-bg" aria-hidden="true">
                    <div className="hero-orb hero-orb--1" />
                    <div className="hero-orb hero-orb--2" />
                </div>

                <Container>
                    <div className="list-hero-content">
                        <RevealOnScroll>
                            <span className="list-hero-kicker">Head to Head</span>
                            <h1 className="list-hero-title">The Arena</h1>
                            <p className="list-hero-subtitle">
                                Compare colleges directly to verify placement stats, rankings, and ROI.
                            </p>
                        </RevealOnScroll>
                    </div>
                </Container>
            </section>

            <section className="list-results">
                <Container>
                    <GlassPanel className="relative w-full max-w-6xl mx-auto min-h-[600px] flex flex-col md:flex-row overflow-hidden shadow-2xl" variant="default">

                        {/* Center Action Orb */}
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30">
                            {college1 && college2 && !winner ? (
                                <button
                                    onClick={startBattle}
                                    disabled={battling}
                                    className={`w-24 h-24 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-[0_0_40px_rgba(0,0,0,0.3)] border-4 border-white transition-all duration-500 hover:scale-110 active:scale-95 ${battling ? 'animate-[spin_1s_linear_infinite]' : ''}`}
                                >
                                    {battling ? <Zap size={32} /> : <span className="font-black text-2xl tracking-tighter italic">VS</span>}
                                </button>
                            ) : winner ? (
                                <button onClick={resetBattle} className="px-6 py-2 bg-slate-900 text-white rounded-full text-xs font-bold uppercase tracking-widest shadow-lg hover:bg-slate-800 transition-colors">
                                    Reset
                                </button>
                            ) : (
                                <div className="w-16 h-16 rounded-full bg-slate-100 border-4 border-white flex items-center justify-center text-slate-300 font-black shadow-inner">VS</div>
                            )}
                        </div>

                        {/* Left Challenger */}
                        <div className={`relative flex-1 p-8 md:p-16 flex flex-col transition-all duration-1000 ${winner?.id === college1?.id ? 'bg-indigo-50/50' : 'bg-transparent'} ${battling ? 'translate-x-4 opacity-50' : ''}`}>
                            {winner?.id === college1?.id && (
                                <div className="absolute top-0 right-0 p-8">
                                    <Trophy size={48} className="text-indigo-600 animate-bounce" />
                                </div>
                            )}

                            <div className="flex-1 flex flex-col justify-center">
                                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6 text-center">Challenger 01</h2>
                                <Combobox
                                    options={colleges}
                                    value={college1?._id || college1?.id}
                                    onChange={setCollege1}
                                    placeholder="Select Institute"
                                />

                                {college1 && (
                                    <div className="mt-12 text-center animate-in fade-in slide-in-from-bottom-8">
                                        <div className="w-40 h-40 mx-auto bg-white rounded-full shadow-xl border border-slate-100 p-6 mb-8 flex items-center justify-center relative">
                                            <img src={college1.logo || "/placeholder-logo.png"} className="max-w-full max-h-full object-contain" />
                                            {winner?.id === college1?.id && <div className="absolute -bottom-2 bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">Winner</div>}
                                        </div>
                                        <h3 className="text-3xl font-black text-slate-900 mb-2 leading-tight">{college1.name}</h3>
                                        <p className="text-lg text-slate-500">{college1.location}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Right Challenger */}
                        <div className={`relative flex-1 p-8 md:p-16 flex flex-col transition-all duration-1000 border-t md:border-t-0 md:border-l border-slate-100 ${winner?.id === college2?.id ? 'bg-indigo-50/50' : 'bg-transparent'} ${battling ? '-translate-x-4 opacity-50' : ''}`}>
                            {winner?.id === college2?.id && (
                                <div className="absolute top-0 left-0 p-8">
                                    <Trophy size={48} className="text-indigo-600 animate-bounce" />
                                </div>
                            )}

                            <div className="flex-1 flex flex-col justify-center">
                                <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-6 text-center">Challenger 02</h2>
                                <Combobox
                                    options={colleges}
                                    value={college2?._id || college2?.id}
                                    onChange={setCollege2}
                                    placeholder="Select Institute"
                                />

                                {college2 && (
                                    <div className="mt-12 text-center animate-in fade-in slide-in-from-bottom-8">
                                        <div className="w-40 h-40 mx-auto bg-white rounded-full shadow-xl border border-slate-100 p-6 mb-8 flex items-center justify-center relative">
                                            <img src={college2.logo || "/placeholder-logo.png"} className="max-w-full max-h-full object-contain" />
                                            {winner?.id === college2?.id && <div className="absolute -bottom-2 bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">Winner</div>}
                                        </div>
                                        <h3 className="text-3xl font-black text-slate-900 mb-2 leading-tight">{college2.name}</h3>
                                        <p className="text-lg text-slate-500">{college2.location}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </GlassPanel>
                </Container>
            </section>
        </div>
    );
}
