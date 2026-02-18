"use client";

import React from 'react';
import Link from 'next/link';
import { Calendar, ArrowUpRight, Clock, Tag, ExternalLink, AlertCircle } from 'lucide-react';

export default function NewsCard({ item, variant = "standard" }) {
    // Variants: "standard", "featured", "compact"

    const isFeatured = variant === "featured";
    const isUrgent = item.urgent;

    return (
        <article className={`news-card group ${isFeatured ? 'featured' : ''} ${isUrgent ? 'urgent' : ''}`}>
            {item.image && (
                <div className="news-image-wrapper">
                    <img src={item.image} alt={item.title} className="news-image" />
                    <div className="news-overlay" />
                </div>
            )}

            <div className="news-content">
                <div className="news-meta-top">
                    <span className={`news-category ${item.category.toLowerCase().replace(" ", "-")}`}>
                        {isUrgent && <AlertCircle size={12} className="mr-1" />}
                        {item.category}
                    </span>
                    <span className="news-date">
                        <Clock size={12} className="mr-1" />
                        {new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                </div>

                <h3 className="news-title">
                    <Link href={item.url || `/news/${item.id}`} className="hover:text-indigo-600 transition-colors">
                        {item.title}
                    </Link>
                </h3>

                <p className="news-excerpt">{item.summary}</p>

                <div className="news-footer">
                    <span className="source-tag">{item.source}</span>
                    <Link href={item.url || `/news/${item.id}`} className="read-more-btn">
                        Read Story <ArrowUpRight size={16} />
                    </Link>
                </div>
            </div>

            <style jsx>{`
                .news-card {
                    background: #ffffff;
                    border: 1px solid rgba(226, 232, 240, 0.8);
                    border-radius: 20px;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
                    position: relative;
                }

                .news-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
                    border-color: #6366f1;
                }
                
                .news-card.urgent {
                    border-left: 4px solid #ef4444;
                    background: #fffafa;
                }

                .news-image-wrapper {
                    position: relative;
                    height: 220px;
                    overflow: hidden;
                }
                
                .featured .news-image-wrapper {
                    height: 400px;
                }

                .news-image {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    transition: transform 0.5s ease;
                }

                .news-card:hover .news-image {
                    transform: scale(1.05);
                }

                .news-content {
                    padding: 28px;
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                }

                .news-meta-top {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 16px;
                }

                .news-category {
                    font-size: 0.7rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    padding: 6px 12px;
                    border-radius: 8px;
                    background: #f1f5f9;
                    color: #475569;
                    display: flex;
                    align-items: center;
                }

                .news-category.exam-alert { background: #fee2e2; color: #b91c1c; }
                .news-category.results { background: #ebf8ff; color: #2b6cb0; }
                .news-category.admissions { background: #f0fdf4; color: #15803d; }

                .news-date {
                    font-size: 0.8rem;
                    color: #94a3b8;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                }

                .news-title {
                    font-family: var(--font-display);
                    font-size: 1.35rem;
                    font-weight: 800;
                    line-height: 1.35;
                    color: #1e293b;
                    margin-bottom: 12px;
                    display: -webkit-box;
                    -webkit-line-clamp: 3;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                    letter-spacing: -0.02em;
                }
                
                .featured .news-title {
                    font-size: 2.5rem;
                    line-height: 1.1;
                    letter-spacing: -0.03em;
                }

                .news-excerpt {
                    font-size: 1rem;
                    color: #64748b;
                    line-height: 1.6;
                    margin-bottom: 24px;
                    display: -webkit-box;
                    -webkit-line-clamp: 3;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                    flex: 1;
                }

                .news-footer {
                    margin-top: auto;
                    padding-top: 24px;
                    border-top: 1px solid #f1f5f9;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .source-tag {
                    font-size: 0.75rem;
                    color: #94a3b8;
                    font-weight: 700;
                    text-transform: uppercase;
                }

                .read-more-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.9rem;
                    font-weight: 700;
                    color: #4f46e5;
                    transition: all 0.2s;
                    padding: 8px 16px;
                    border-radius: 8px;
                    background: #eef2ff;
                }

                .read-more-btn:hover {
                    gap: 8px;
                    color: #4338ca;
                    background: #e0e7ff;
                }
            `}</style>
        </article>
    );
}
