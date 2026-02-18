"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export default function ScholarshipCard({ scholarship }) {
    const [imgError, setImgError] = useState(false);

    // V2: Removed redundant badge logic for cleaner look.
    // Focusing on typography and whitespace.

    return (
        <Link href={`/scholarship/${scholarship.id}`} className="block group h-full">
            <div className="h-full bg-white/60 backdrop-blur-md border border-white/60 rounded-[32px] p-8 md:p-10 transition-all duration-300 hover:bg-white/80 hover:shadow-xl hover:shadow-indigo-900/5 hover:-translate-y-1 flex flex-col">

                {/* Header: Logo Only (Clean) */}
                <div className="mb-8 flex justify-between items-start">
                    <div className="w-14 h-14 rounded-2xl bg-white shadow-sm border border-slate-100 p-3 flex items-center justify-center">
                        {!imgError && scholarship.logo ? (
                            <img
                                src={scholarship.logo}
                                alt={scholarship.provider}
                                className="w-full h-full object-contain"
                                onError={() => setImgError(true)}
                            />
                        ) : (
                            <span className="text-xl font-bold text-slate-300">
                                {scholarship.provider[0]}
                            </span>
                        )}
                    </div>
                    {/* Badge is now minimal text only */}
                    <span className="text-xs font-bold uppercase tracking-widest text-slate-400 bg-slate-50 px-3 py-1 rounded-full">{scholarship.category}</span>
                </div>

                {/* Content - Massive Numbers */}
                <div className="flex-1">
                    <h3 className="text-2xl font-bold text-slate-900 mb-2 leading-tight group-hover:text-indigo-600 transition-colors font-display">
                        {scholarship.name}
                    </h3>
                    <p className="text-sm text-slate-500 font-medium mb-8 truncate">{scholarship.provider}</p>

                    <div className="space-y-4">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Grant Amount</span>
                            <span className="text-lg md:text-3xl font-bold text-slate-900 tracking-tight">{scholarship.amount}</span>
                        </div>
                    </div>
                </div>

                {/* Subtle Footer */}
                <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex flex-col">
                        <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-1">Deadline</span>
                        <span className="text-sm font-bold text-slate-700">{scholarship.deadline}</span>
                    </div>

                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-slate-900 group-hover:text-white transition-all duration-300">
                        <ArrowUpRight size={18} />
                    </div>
                </div>
            </div>
        </Link>
    );
}
