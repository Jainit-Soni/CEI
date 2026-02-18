"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Award, Calendar, ArrowRight, Building2, GraduationCap } from 'lucide-react';

export default function ScholarshipCard({ scholarship }) {
    const [imgError, setImgError] = useState(false);

    // Check for Government or Ministry providers
    const isGov = scholarship.provider.toLowerCase().includes('govt') ||
        scholarship.provider.toLowerCase().includes('ministry') ||
        scholarship.provider.toUpperCase().includes('NSP');

    // Specific check for NSP / National Scholarship Portal
    const isNSP = scholarship.provider.toUpperCase().includes('NSP') ||
        scholarship.name.toUpperCase().includes('NATIONAL SCHOLARSHIP');

    return (
        <Link href={`/scholarship/${scholarship.id}`} className="block group h-full">
            <div className={`scholarship-card glass-panel h-full ${isNSP ? 'nsp-card' : ''}`}>
                <div className="card-header">
                    <div className={`provider-badge ${isGov ? 'gov-badge' : ''}`}>
                        {scholarship.provider}
                    </div>
                    <div className="provider-logo-wrapper">
                        {!imgError && scholarship.logo ? (
                            <img
                                src={scholarship.logo}
                                alt={scholarship.provider}
                                className="provider-logo"
                                onError={() => setImgError(true)}
                            />
                        ) : (
                            <div className="provider-logo-fallback">
                                {isGov ? <Building2 size={20} className="text-amber-500/50" /> : <GraduationCap size={20} className="text-slate-400" />}
                            </div>
                        )}
                    </div>
                </div>

                <div className="card-content flex-1">
                    <h3 className="scholarship-name">{scholarship.name}</h3>

                    <div className="meta-row">
                        <div className="meta-item">
                            <Award size={16} className={isGov ? "text-amber-600" : "text-indigo-500"} />
                            <span className="font-bold">{scholarship.amount}</span>
                        </div>
                        <div className="meta-item">
                            <Calendar size={16} className="text-slate-400" />
                            <span>Deadline: {scholarship.deadline}</span>
                        </div>
                    </div>

                    <div className="tags-row">
                        <span className="sc-tag">{scholarship.category}</span>
                    </div>
                </div>

                <div className="card-footer">
                    <div className={`view-action ${isNSP ? 'text-amber-700' : 'text-indigo-600'}`}>
                        View Details <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                </div>
            </div>

            <style jsx>{`
                .scholarship-card {
                    background: rgba(255, 255, 255, 0.6);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.6);
                    border-radius: 24px;
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.02), 0 2px 4px -1px rgba(0, 0, 0, 0.02);
                }
                
                .scholarship-card:hover {
                    transform: translateY(-8px) scale(1.01);
                    background: rgba(255, 255, 255, 0.85);
                    box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.08);
                    border-color: rgba(99, 102, 241, 0.3);
                }

                /* NSP Variation - Sovereign Gold Badge/Theme */
                .nsp-card {
                    background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(254, 252, 232, 0.8));
                    border: 1px solid rgba(251, 191, 36, 0.3);
                }
                .nsp-card:hover {
                    border-color: rgba(251, 191, 36, 0.6);
                    box-shadow: 0 20px 40px -15px rgba(251, 191, 36, 0.15);
                }

                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 20px;
                }

                .provider-badge {
                    font-size: 0.65rem;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    background: #f1f5f9;
                    color: #64748b;
                    padding: 6px 12px;
                    border-radius: 99px;
                    font-weight: 800;
                    max-width: 70%;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .provider-badge.gov-badge {
                    background: #fff7ed;
                    color: #d97706;
                    border: 1px solid #ffedd5;
                }
                
                .nsp-card .provider-badge.gov-badge {
                    background: #fef3c7;
                    color: #92400e;
                    border-color: #fcd34d;
                }

                .provider-logo, .provider-logo-fallback {
                    width: 44px;
                    height: 44px;
                    border-radius: 12px;
                    background: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
                    border: 1px solid rgba(0,0,0,0.05);
                }
                
                .provider-logo {
                    padding: 6px;
                    object-fit: contain;
                }

                .scholarship-name {
                    font-family: var(--font-display);
                    font-size: 1.15rem;
                    color: #0f172a;
                    margin-bottom: 16px;
                    line-height: 1.4;
                    font-weight: 700;
                    overflow: hidden;
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                }

                .meta-row {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    margin-bottom: 24px;
                }

                .meta-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    color: #475569;
                    font-size: 0.9rem;
                    font-weight: 600;
                }

                .tags-row {
                    margin-top: auto;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }

                .sc-tag {
                    font-size: 0.65rem;
                    background: rgba(0,0,0,0.04);
                    padding: 4px 10px;
                    border-radius: 6px;
                    color: #64748b;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .card-footer {
                    margin-top: 24px;
                    border-top: 1px solid rgba(0,0,0,0.05);
                    padding-top: 16px;
                }

                .view-action {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-weight: 800;
                    font-size: 0.8rem;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                }
            `}</style>
        </Link>
    );
}
