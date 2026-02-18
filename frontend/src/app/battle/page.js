"use client";

import React, { useState, useEffect } from 'react';
import Combobox from '@/components/Combobox';
import Container from '@/components/Container';
import { fetchColleges } from '@/lib/api';
import { Trophy, Zap, ArrowRight, Swords } from 'lucide-react';
import "../colleges/page.css";

export default function BattlePage() {
    const [colleges, setColleges] = useState([]);
    const [college1, setCollege1] = useState(null);
    const [college2, setCollege2] = useState(null);
    const [winner, setWinner] = useState(null);
    const [battling, setBattling] = useState(false);

    useEffect(() => {
        fetchColleges().then(setColleges).catch(console.error);
    }, []);

    const resetBattle = () => {
        setWinner(null);
        setBattling(false);
    };

    const startBattle = () => {
        if (!college1 || !college2) return;
        setBattling(true);
        setTimeout(() => {
            const score1 = calculateScore(college1);
            const score2 = calculateScore(college2);
            setWinner(score1 > score2 ? college1 : college2);
            setBattling(false);
        }, 2000);
    };

    const calculateScore = (college) => {
        let score = 0;
        if (college.rating) score += college.rating * 20;
        if (college.placementAverage) score += parseInt(college.placementAverage) / 1000;
        return score;
    };

    return (
        <div className="min-h-screen bg-transparent pt-32 pb-20 overflow-hidden">
            <Container>
                {/* Header */}
                <div className="text-center mb-16">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold uppercase tracking-widest mb-4">
                        <Swords size={12} /> Comparison Engine
                    </div>
                    <h1 className="text-6xl md:text-8xl font-black text-slate-900 tracking-tighter mb-4">
                        VS
                    </h1>
                    <p className="text-xl text-slate-500">The Arena.</p>
                </div>

                {/* The Split Arena */}
                <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-200 min-h-[600px] flex flex-col md:flex-row">

                    {/* Floating VS Button (Absolute Center) */}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
                        {!winner && college1 && college2 ? (
                            <button
                                onClick={startBattle}
                                disabled={battling}
                                className={`w-24 h-24 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-2xl transition-all duration-300 hover:scale-110 ${battling ? 'animate-ping' : ''}`}
                            >
                                <Zap size={32} fill="currentColor" />
                            </button>
                        ) : (
                            <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-300 font-black">VS</div>
                        )}
                    </div>

                    {/* Left Side */}
                    <div className={`relative flex-1 p-8 md:p-16 flex flex-col justify-center transition-all duration-700 ${winner?.id === college1?.id ? 'bg-amber-50' : 'bg-white'}`}>
                        {winner?.id === college1?.id && (
                            <div className="absolute top-8 left-8 text-amber-500 flex items-center gap-2 font-black uppercase tracking-widest animate-in slide-in-from-bottom-4">
                                <Trophy size={18} /> Winner
                            </div>
                        )}

                        <div className="mb-auto">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4">Challenger 01</h3>
                            <Combobox
                                options={colleges}
                                value={college1?._id || college1?.id}
                                onChange={setCollege1}
                                placeholder="Select College"
                            />
                        </div>

                        {college1 && (
                            <div className="mt-12 animate-in fade-in slide-in-from-bottom-8">
                                <div className="w-32 h-32 bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-6 flex items-center justify-center">
                                    <img src={college1.logo || "/placeholder-logo.png"} className="max-w-full max-h-full object-contain" />
                                </div>
                                <h2 className="text-4xl font-black text-slate-900 mb-2">{college1.name}</h2>
                                <p className="text-lg text-slate-500 font-medium">{college1.location}</p>
                            </div>
                        )}
                    </div>

                    {/* Right Side */}
                    <div className={`relative flex-1 p-8 md:p-16 flex flex-col justify-center border-t md:border-t-0 md:border-l border-slate-100 transition-all duration-700 ${winner?.id === college2?.id ? 'bg-amber-50' : 'bg-white'}`}>
                        {winner?.id === college2?.id && (
                            <div className="absolute top-8 right-8 text-amber-500 flex items-center gap-2 font-black uppercase tracking-widest animate-in slide-in-from-bottom-4">
                                <Trophy size={18} /> Winner
                            </div>
                        )}

                        <div className="mb-auto">
                            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4 text-right">Challenger 02</h3>
                            <Combobox
                                options={colleges}
                                value={college2?._id || college2?.id}
                                onChange={setCollege2}
                                placeholder="Select College"
                            />
                        </div>

                        {college2 && (
                            <div className="mt-12 text-right animate-in fade-in slide-in-from-bottom-8">
                                <div className="w-32 h-32 bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-6 flex items-center justify-center ml-auto">
                                    <img src={college2.logo || "/placeholder-logo.png"} className="max-w-full max-h-full object-contain" />
                                </div>
                                <h2 className="text-4xl font-black text-slate-900 mb-2">{college2.name}</h2>
                                <p className="text-lg text-slate-500 font-medium">{college2.location}</p>
                            </div>
                        )}
                    </div>

                </div>

                {winner && (
                    <div className="text-center mt-12">
                        <button onClick={resetBattle} className="text-slate-400 hover:text-slate-900 font-bold transition-colors">
                            Reset Verification
                        </button>
                    </div>
                )}
            </Container>
        </div>
    );
}
