"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

export default function ScholarshipCard({ scholarship }) {
    const [imgError, setImgError] = useState(false);

    // Simple categorization for badge color (if needed, but keeping it minimal)
    const isGov = scholarship.provider.toLowerCase().includes('govt') ||
        scholarship.provider.toUpperCase().includes('NSP');

    return (
        <Link href={`/scholarship/${scholarship.id}`} className="block group h-full">
            <div className="h-full bg-white/40 backdrop-blur-md border border-white/50 rounded-2xl p-8 hover:bg-white/60 transition-all duration-300 flex flex-col hover:shadow-xl hover:shadow-indigo-500/5 hover:-translate-y-1">

                {/* Header: Logo & Type */}
                <div className="flex items-start justify-between mb-6">
                    <div className="w-12 h-12 rounded-xl bg-white shadow-sm p-2 flex items-center justify-center">
                        {!imgError && scholarship.logo ? (
                            <img
                                src={scholarship.logo}
                                alt={scholarship.provider}
                                className="w-full h-full object-contain"
                                onError={() => setImgError(true)}
                            />
                        ) : (
                            <span className="text-lg font-bold text-slate-300">
                                {scholarship.provider[0]}
                            </span>
                        )}
                    </div>
                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${isGov ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>
                        {scholarship.category}
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-900 mb-4 leading-tight group-hover:text-indigo-600 transition-colors">
                        {scholarship.name}
                    </h3>

                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm border-b border-slate-900/5 pb-2">
                            <span className="text-slate-500 font-medium">Amount</span>
                            <span className="font-bold text-slate-800">{scholarship.amount}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm border-b border-slate-900/5 pb-2">
                            <span className="text-slate-500 font-medium">Deadline</span>
                            <span className="font-bold text-slate-800">{scholarship.deadline}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm pb-2">
                            <span className="text-slate-500 font-medium">Provider</span>
                            <span className="font-bold text-slate-800 truncate max-w-[150px]">{scholarship.provider}</span>
                        </div>
                    </div>
                </div>

                {/* Footer / Action */}
                <div className="mt-8 pt-6 border-t border-slate-900/5 flex items-center justify-between text-slate-900 font-bold text-sm">
                    <span>View Details</span>
                    <ArrowUpRight size={18} className="text-slate-400 group-hover:text-indigo-600 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </div>
            </div>
        </Link>
    );
}
