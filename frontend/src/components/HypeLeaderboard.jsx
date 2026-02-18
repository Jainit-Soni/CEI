"use client";

import React from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function HypeLeaderboard({ data }) {
    if (!data || data.length === 0) return <div className="text-center text-slate-500 py-8">No votes yet. Be the first!</div>;

    // Calculate max votes for relative bar width
    const maxVotes = Math.max(...data.map(d => d.votes));

    return (
        <div className="hype-leaderboard-container">
            <h3 className="flex items-center gap-2 text-xl font-extrabold text-slate-800 mb-8">
                <Trophy className="text-amber-400" size={24} />
                Live Standings
            </h3>

            <div className="flex flex-col gap-6">
                {data.map((item, index) => {
                    const widthStart = (item.votes / maxVotes) * 100;
                    const rank = index + 1;

                    // Simulate trend
                    const trend = item.votes % 3 === 0 ? "up" : item.votes % 3 === 1 ? "down" : "flat";

                    return (
                        <div key={item.id} className="flex items-center gap-6 group">
                            <div className="flex flex-col items-center gap-1 w-12 flex-shrink-0">
                                <span className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg shadow-sm border ${rank === 1 ? 'bg-amber-50 border-amber-200 text-amber-600 shadow-amber-100' :
                                        rank === 2 ? 'bg-slate-50 border-slate-200 text-slate-500 shadow-slate-100' :
                                            rank === 3 ? 'bg-orange-50 border-orange-200 text-orange-600 shadow-orange-100' :
                                                'bg-white border-slate-100 text-slate-400'
                                    }`}>
                                    {rank}
                                </span>
                                {trend === "up" && <TrendingUp size={14} className="text-emerald-500" />}
                                {trend === "down" && <TrendingDown size={14} className="text-rose-500" />}
                                {trend === "flat" && <Minus size={14} className="text-slate-300" />}
                            </div>

                            <div className="flex-1">
                                <div className="flex justify-between items-end mb-2">
                                    <span className="font-extrabold text-slate-700 text-lg group-hover:text-indigo-600 transition-colors">
                                        {item.name}
                                    </span>
                                    <div className="flex flex-col items-end">
                                        <span className="text-indigo-600 font-black text-lg">{item.votes}</span>
                                        <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Total Votes</span>
                                    </div>
                                </div>
                                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                                    <div
                                        className={`h-full rounded-full transition-all duration-1000 ease-out ${rank === 1 ? 'bg-gradient-to-r from-amber-400 to-yellow-500' :
                                                rank === 2 ? 'bg-gradient-to-r from-slate-400 to-slate-500' :
                                                    rank === 3 ? 'bg-gradient-to-r from-orange-400 to-orange-500' :
                                                        'bg-gradient-to-r from-indigo-400 to-indigo-500'
                                            }`}
                                        style={{ width: `${widthStart}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
