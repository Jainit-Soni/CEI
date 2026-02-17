"use client";

import React from 'react';
import { Calendar, ExternalLink, AlertCircle } from 'lucide-react';
import Button from './Button';

export default function NewsCard({ item }) {
    const isUrgent = item.urgent;

    return (
        <div className={`news-card glass-panel ${isUrgent ? 'urgent' : ''}`}>
            <div className="card-meta">
                <span className={`cat-badge ${isUrgent ? 'bg-red-500/20 text-red-500' : 'bg-blue-500/20 text-blue-400'}`}>
                    {isUrgent && <AlertCircle size={14} className="mr-1" />}
                    {item.category}
                </span>
                <span className="date">
                    <Calendar size={14} className="mr-1" />
                    {new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
            </div>

            <h3 className="news-title">{item.title}</h3>
            <p className="news-summary">{item.summary}</p>

            <div className="card-footer">
                <span className="source">Source: {item.source}</span>
                {item.url && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="read-more">
                        Read More <ExternalLink size={14} />
                    </a>
                )}
            </div>

            <style jsx>{`
                .news-card {
                    padding: 24px;
                    border-radius: 16px;
                    background: rgba(255, 255, 255, 0.03);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    transition: transform 0.2s;
                    position: relative;
                    overflow: hidden;
                }
                .news-card:hover {
                    transform: translateY(-2px);
                    background: rgba(255, 255, 255, 0.05);
                }
                .news-card.urgent {
                    border-color: rgba(239, 68, 68, 0.3);
                    background: linear-gradient(to bottom right, rgba(239, 68, 68, 0.05), rgba(0,0,0,0));
                }

                .card-meta {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                }
                .cat-badge {
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 0.75rem;
                    font-weight: 600;
                    text-transform: uppercase;
                    display: flex;
                    align-items: center;
                }
                .date {
                    font-size: 0.85rem;
                    color: #94a3b8;
                    display: flex;
                    align-items: center;
                }

                .news-title {
                    font-family: var(--font-display);
                    font-size: 1.25rem;
                    color: white;
                    margin-bottom: 12px;
                    line-height: 1.4;
                }

                .news-summary {
                    color: #cbd5e1;
                    font-size: 0.95rem;
                    line-height: 1.6;
                    margin-bottom: 20px;
                }

                .card-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    border-top: 1px solid rgba(255, 255, 255, 0.05);
                    padding-top: 16px;
                }

                .source {
                    font-size: 0.8rem;
                    color: #64748b;
                    font-weight: 500;
                }

                .read-more {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    color: #60a5fa;
                    font-size: 0.9rem;
                    font-weight: 600;
                    transition: color 0.2s;
                }
                .read-more:hover {
                    color: #93c5fd;
                    text-decoration: underline;
                }
            `}</style>
        </div>
    );
}
