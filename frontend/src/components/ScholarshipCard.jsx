"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, GraduationCap } from 'lucide-react';
import "./Card.css";

export default function ScholarshipCard({ scholarship }) {
    const [imgError, setImgError] = useState(false);

    return (
        <Link href={`/scholarship/${scholarship.id}`} className="card-wrapper" style={{ textDecoration: 'none', color: 'inherit', display: 'block', height: '100%' }}>
            <div className="card card-scholarship" data-type="scholarship">
                {/* 1. Category Badge */}
                <div className="card-badge" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>
                    {scholarship.category || "Scholarship"}
                </div>

                <div className="card-top">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                        <div className="card-heading-group">
                            <h3 className="card-full-name">{scholarship.name}</h3>
                            <span className="card-acronym" style={{ background: '#ecfdf5', color: '#059669', borderColor: '#d1fae5' }}>
                                {scholarship.provider}
                            </span>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-white shadow-sm border border-slate-100 p-2 flex items-center justify-center flex-shrink-0">
                            {!imgError && scholarship.logo ? (
                                <img
                                    src={scholarship.logo}
                                    alt={scholarship.provider}
                                    className="w-full h-full object-contain"
                                    onError={() => setImgError(true)}
                                />
                            ) : (
                                <GraduationCap size={24} className="text-emerald-500" />
                            )}
                        </div>
                    </div>
                </div>

                {/* Content - Massive Numbers */}
                <div className="card-tags">
                    <span style={{ fontSize: '0.65rem', color: '#64748b' }}>Grant Amount</span>
                    <div style={{ width: '100%', fontSize: '1.25rem', fontWeight: '800', color: '#0f172a', marginTop: '4px' }}>
                        {scholarship.amount}
                    </div>
                </div>

                {/* footer */}
                <div className="card-footer">
                    <div className="flex flex-col">
                        <span style={{ fontSize: '0.7rem', textTransform: 'uppercase', fontWeight: '600', color: '#94a3b8' }}>Deadline</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#475569' }}>{scholarship.deadline}</span>
                    </div>

                    <div className="w-9 h-9 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">
                        <ArrowUpRight size={18} />
                    </div>
                </div>
            </div>
        </Link>
    );
}
