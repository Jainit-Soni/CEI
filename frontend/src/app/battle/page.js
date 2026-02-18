"use client";

import React, { useState, useEffect } from 'react';
import { Swords, Info } from 'lucide-react';
import BattleArena from '@/components/BattleArena';
import Spinner from '@/components/Spinner';
import Container from '@/components/Container';
import GlassPanel from '@/components/GlassPanel';
import { fetchColleges } from '@/lib/api';
import { RevealOnScroll } from '@/lib/useIntersectionObserver';
import "../colleges/page.css";

export default function BattlePage() {
    const [colleges, setColleges] = useState([]);
    const [loading, setLoading] = useState(true);

    // Selections
    const [fighter1, setFighter1] = useState(null);
    const [fighter2, setFighter2] = useState(null);

    // Load Colleges
    useEffect(() => {
        fetchColleges()
            .then(data => {
                setColleges(data.filter(c => c.rankingTier === 'Tier 1' || c.rankingTier === 'Tier 2')); // Pre-filter for better battles
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load battle data:", err);
                setLoading(false);
            });
    }, []);

    const handleSelect = (idx, id) => {
        const selected = colleges.find(c => c._id === id || c.id === id);
        if (idx === 1) setFighter1(selected);
        else setFighter2(selected);
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-transparent"><Spinner /></div>;

    return (
import Combobox from '@/components/Combobox';

    // ... (imports remain matching file)

    // ... inside component

    return (
        <div className="list-page min-h-screen bg-transparent">
            <section className="relative pt-32 pb-20 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-indigo-500/5 pointer-events-none" />
                <Container className="relative z-10 text-center">
                    <RevealOnScroll>
                        <span className="inline-block py-1 px-3 rounded-full bg-red-100 text-red-600 text-[10px] font-black uppercase tracking-widest mb-4 border border-red-200">
                            Updates Live
                        </span>
                        <h1 className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter mb-6">
                            College <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-600 to-indigo-600">Battle Royale</span> ⚔️
                        </h1>
                        <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed mb-8">
                            The ultimate AI-powered showdown. Select two elite institutions and let the data decide the victor.
                        </p>
                    </RevealOnScroll>
                </Container>
            </section>

            <section className="relative z-20 -mt-10 mb-12">
                <Container>
                    <GlassPanel className="p-8 shadow-2xl border-white/60 bg-white/80 backdrop-blur-xl" variant="strong">
                        <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] items-center gap-8">

                            {/* Fighter 1 */}
                            <div className="text-indigo-600">
                                <Combobox
                                    label="Challenger 1"
                                    options={colleges}
                                    value={fighter1?._id || fighter1?.id || ""}
                                    onChange={(val) => handleSelect(1, val)}
                                    placeholder="Select College..."
                                />
                            </div>

                            {/* VS Badge */}
                            <div className="flex justify-center md:pt-6">
                                <div className="w-16 h-16 rounded-2xl bg-slate-900 text-white flex items-center justify-center font-black italic text-xl shadow-lg rotate-3 hover:rotate-0 transition-transform duration-300 border-4 border-white ring-1 ring-slate-200">
                                    VS
                                </div>
                            </div>

                            {/* Fighter 2 */}
                            <div className="text-rose-500">
                                <Combobox
                                    label="Challenger 2"
                                    options={colleges}
                                    value={fighter2?._id || fighter2?.id || ""}
                                    onChange={(val) => handleSelect(2, val)}
                                    placeholder="Select College..."
                                />
                            </div>
                        </div>
                    </GlassPanel>
                </Container>
            </section>

            <section className="arena-wrapper py-12">
                <Container>
                    <div className="max-w-5xl mx-auto">
                        {fighter1 && fighter2 ? (
                            <BattleArena college1={fighter1} college2={fighter2} />
                        ) : (
                            <div className="h-[400px] rounded-[32px] border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400 group bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                <div className="p-8 rounded-full bg-white shadow-sm mb-6 group-hover:scale-110 transition-transform duration-300">
                                    <Swords size={48} className="text-slate-300 group-hover:text-indigo-500 transition-colors" />
                                </div>
                                <h3 className="text-2xl font-bold text-slate-800 mb-2">Arena Empty</h3>
                                <p className="max-w-xs text-center text-sm font-medium text-slate-500">
                                    Select two colleges above to initiate the comparison engine.
                                </p>
                            </div>
                        )}
                    </div>
                </Container>
            </section>
        </div>
    );
}
