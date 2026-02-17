"use client";

import React from 'react';
import Link from 'next/link';
import { Award, Calendar, GraduationCap, ArrowRight } from 'lucide-react';

export default function ScholarshipCard({ scholarship }) {
    return (
        <div className="scholarship-card glass-panel">
            <div className="card-header">
                <div className="provider-badge">{scholarship.provider}</div>
                {scholarship.logo && (
                    <img src={scholarship.logo} alt={scholarship.provider} className="provider-logo" />
                )}
            </div>

            <div className="card-content">
                <h3 className="scholarship-name">{scholarship.name}</h3>

                <div className="meta-row">
                    <div className="meta-item">
                        <Award size={16} className="text-yellow-400" />
                        <span>{scholarship.amount}</span>
                    </div>
                    <div className="meta-item">
                        <Calendar size={16} className="text-blue-400" />
                        <span>Deadline: {scholarship.deadline}</span>
                    </div>
                </div>

                <div className="tags-row">
                    <span className="sc-tag">{scholarship.category}</span>
                </div>
            </div>

            <div className="card-footer">
                <Link href={`/scholarship/${scholarship.id}`} className="view-btn">
                    View Details <ArrowRight size={16} />
                </Link>
            </div>

            <style jsx>{`
                .scholarship-card {
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 16px;
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    transition: transform 0.3s, box-shadow 0.3s;
                    position: relative;
                    overflow: hidden;
                }
                .scholarship-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5);
                    border-color: rgba(255, 255, 255, 0.2);
                }

                .card-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 16px;
                }

                .provider-badge {
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    background: rgba(59, 130, 246, 0.1);
                    color: #60a5fa;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-weight: 600;
                }

                .provider-logo {
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    object-fit: contain;
                    background: white;
                    padding: 2px;
                }

                .scholarship-name {
                    font-family: var(--font-display);
                    font-size: 1.25rem;
                    color: white;
                    margin-bottom: 16px;
                    line-height: 1.4;
                    font-weight: 700;
                }

                .meta-row {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                    margin-bottom: 16px;
                }

                .meta-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: #cbd5e1;
                    font-size: 0.9rem;
                }

                .tags-row {
                    margin-bottom: 20px;
                }

                .sc-tag {
                    font-size: 0.75rem;
                    background: rgba(255,255,255,0.05);
                    padding: 4px 10px;
                    border-radius: 20px;
                    color: #94a3b8;
                    border: 1px solid rgba(255,255,255,0.1);
                }

                .card-footer {
                    margin-top: auto;
                }

                .view-btn {
                    width: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 10px;
                    background: linear-gradient(90deg, #3b82f6, #2563eb);
                    color: white;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 0.9rem;
                    transition: filter 0.2s;
                }
                .view-btn:hover {
                    filter: brightness(1.1);
                }
            `}</style>
        </div>
    );
}
