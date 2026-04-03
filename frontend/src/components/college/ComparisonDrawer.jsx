"use client";

import React, { useState } from "react";
import { 
    Layers, 
    X, 
    ArrowRightLeft, 
    ChevronUp, 
    ChevronDown, 
    Trash2,
    Trophy,
    TrendingUp,
    IndianRupee,
    ExternalLink
} from "lucide-react";
import { useComparator } from "@/hooks/useComparator";
import Link from "next/link";

const ComparisonDrawer = () => {
    const { 
        pinnedColleges, 
        unpinCollege, 
        clearPins, 
        isDrawerOpen, 
        setIsDrawerOpen,
        isLoading,
        ghostCollege
    } = useComparator();

    const count = pinnedColleges.length;
    const hasGhost = ghostCollege && !pinnedColleges.some(c => c.id === ghostCollege.id);

    if (count === 0 && !isDrawerOpen && !hasGhost) return null;

    return (
        <div className={`fixed bottom-0 left-0 right-0 z-[1000] transition-all duration-700 ease-in-out transform shadow-[0_-20px_50px_-12px_rgba(0,0,0,0.5)] ${isDrawerOpen ? 'translate-y-0' : 'translate-y-[calc(100%-54px)]'}`}>
            {/* Toggle Tab */}
            <div className="flex justify-center -mb-px">
                <button 
                    onClick={() => setIsDrawerOpen(!isDrawerOpen)}
                    className="flex items-center gap-3 px-8 py-3 bg-slate-900 border border-white/10 border-b-0 rounded-t-3xl backdrop-blur-3xl group hover:bg-slate-800 transition-all shadow-[0_-15px_30px_-5px_rgba(0,0,0,0.6)]"
                >
                    <ArrowRightLeft className={`w-4 h-4 text-blue-400 ${isDrawerOpen ? 'rotate-180' : ''} transition-transform duration-500`} />
                    <span className="text-xs font-black text-white uppercase tracking-[0.2em]">
                        Benchmarking Hub <span className="text-blue-500 text-sm ml-1">{count}</span>
                    </span>
                    {isDrawerOpen ? <ChevronDown className="w-4 h-4 text-slate-500" /> : <ChevronUp className="w-4 h-4 text-slate-500 animate-bounce" />}
                </button>
            </div>

            {/* Main Content Area */}
            <div 
                className="w-full border-t border-white/10 shadow-[0_-20px_50px_-12px_rgba(0,0,0,0.8)] min-h-[180px] pb-6 pt-8"
                style={{ backgroundColor: '#0f172a' }}
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between mb-8">
                        <div>
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Layers className="w-5 h-5 text-indigo-400" />
                                Smart Comparison
                            </h3>
                            <p className="text-sm text-slate-400">Benchmark these programs side-by-side using official Truth-Grade data.</p>
                        </div>
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={clearPins}
                                className="text-xs font-bold text-slate-500 hover:text-red-400 uppercase tracking-widest transition-colors flex items-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" /> Clear All
                            </button>
                            <Link 
                                href="/compare"
                                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold transition-all shadow-lg shadow-blue-600/20 flex items-center gap-2"
                            >
                                Detailed Side-by-Side <ExternalLink className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex justify-center items-center py-12">
                            <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                            {pinnedColleges.map((college, idx) => (
                                <div 
                                    key={college.id || college._id || `pinned-${idx}`}
                                    className="relative group p-5 rounded-3xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] transition-all duration-300"
                                >
                                    <button 
                                        onClick={() => unpinCollege(college.id)}
                                        className="absolute -top-2 -right-2 p-1.5 rounded-full bg-slate-800 border border-white/10 text-slate-500 hover:text-white shadow-lg z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>

                                    <div className="mb-4">
                                        <h4 className="font-bold text-white line-clamp-1 mb-1">{college.name}</h4>
                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold truncate">
                                            {college.location ? college.location.replace(/unknown,\s*/gi, '') : (college.state || "India")}
                                        </p>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 text-center">
                                        <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                                            <TrendingUp className="w-3 h-3 text-indigo-400 mx-auto mb-1" />
                                            <span className="text-[10px] text-slate-500 block">Ranking</span>
                                            <span className="text-xs font-bold text-white">{college.rankingTier || (college.rankings?.[0]?.rank ? `#${college.rankings[0].rank}` : college.ranking || 'TBA')}</span>
                                        </div>
                                        <div className="p-2 rounded-xl bg-green-500/10 border border-green-500/20">
                                            <IndianRupee className="w-3 h-3 text-green-400 mx-auto mb-1" />
                                            <span className="text-[10px] text-slate-500 block">Package</span>
                                            <span className="text-xs font-bold text-white">{(college.engineeringCutoffs?.[0]?.avgPackage) || (college.placements?.averagePackage) || 'N/A'}</span>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Ghost Peek Slot */}
                            {hasGhost && pinnedColleges.length < 4 && (
                                <div className="relative p-5 rounded-3xl border border-dashed border-blue-500/40 bg-blue-500/[0.05] animate-pulse">
                                    <div className="absolute -top-3 left-4 px-2 py-0.5 rounded-full bg-blue-600 text-[8px] font-black text-white uppercase tracking-widest shadow-lg">
                                        Ghost Peek
                                    </div>
                                    <div className="mb-4">
                                        <h4 className="font-bold text-white/60 line-clamp-1 mb-1">{ghostCollege.name}</h4>
                                        <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold truncate">
                                            {ghostCollege.location || (ghostCollege.city ? `${ghostCollege.city}, ${ghostCollege.state}` : ghostCollege.state)}
                                        </p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-center opacity-60">
                                        <div className="p-2 rounded-xl bg-blue-500/5 border border-blue-500/10">
                                            <TrendingUp className="w-3 h-3 text-blue-400 mx-auto mb-1" />
                                            <span className="text-[10px] text-slate-500 block text-[6px]">PREDICTED</span>
                                            <span className="text-xs font-bold text-white">#{(ghostCollege.rankings?.[0]?.rank) || (ghostCollege.ceiScore ? Math.round(100 - ghostCollege.ceiScore) : 'TBA')}</span>
                                        </div>
                                        <div className="p-2 rounded-xl bg-green-500/5 border border-green-500/10">
                                            <IndianRupee className="w-3 h-3 text-green-400 mx-auto mb-1" />
                                            <span className="text-[10px] text-slate-500 block text-[6px]">AVG PKG</span>
                                            <span className="text-xs font-bold text-white">12.5L</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Empty Slot */}
                            {(pinnedColleges.length + (hasGhost ? 1 : 0)) < 4 && (
                                <div className="p-4 rounded-2xl border border-dashed border-white/10 flex flex-col items-center justify-center text-slate-600 group hover:border-white/20 transition-all min-h-[140px]">
                                    <div className="w-10 h-10 rounded-full border border-dashed border-white/20 flex items-center justify-center mb-2 group-hover:bg-white/5">
                                        <Layers className="w-4 h-4 opacity-50" />
                                    </div>
                                    <span className="text-[10px] font-bold uppercase tracking-widest">Empty Slot</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ComparisonDrawer;
