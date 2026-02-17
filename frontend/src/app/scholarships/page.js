"use client";

import React, { useState, useEffect } from 'react';
import ScholarshipCard from '@/components/ScholarshipCard';
import Spinner from '@/components/Spinner';
import { Search, Filter } from 'lucide-react';

const CATEGORIES = ["All", "Government", "Private", "Merit-Based", "Minority", "Girls Only", "Sports"];

export default function ScholarshipsPage() {
    const [scholarships, setScholarships] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("All");
    const [search, setSearch] = useState("");

    useEffect(() => {
        fetch('/api/scholarships')
            .then(res => res.json())
            .then(data => {
                setScholarships(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load scholarships:", err);
                setLoading(false);
            });
    }, []);

    const filteredScholarships = scholarships.filter(s => {
        const matchesCategory = filter === "All" || s.category.toLowerCase().includes(filter.toLowerCase()) ||
            (filter === "Government" && (s.provider.includes("Govt") || s.provider.includes("Ministry")));
        const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
            s.provider.toLowerCase().includes(search.toLowerCase());
        return matchesCategory && matchesSearch;
    });

    return (
        <div className="scholarships-page">
            {/* Hero Section */}
            <div className="scholarship-hero">
                <div className="content-wrapper">
                    <h1 className="hero-title">Find Your <span className="text-gradient">Financial Aid</span></h1>
                    <p className="hero-subtitle">Explore curated scholarships to fund your education. From government schemes to private grants.</p>

                    <div className="search-bar-container">
                        <Search className="search-icon" size={20} />
                        <input
                            type="text"
                            placeholder="Search scholarships (e.g., Tata, NSP, Merit)..."
                            className="search-input"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>
                <div className="hero-glow"></div>
            </div>

            {/* Filters */}
            <div className="filters-container">
                <div className="filter-scroll">
                    {CATEGORIES.map(cat => (
                        <button
                            key={cat}
                            className={`filter-chip ${filter === cat ? 'active' : ''}`}
                            onClick={() => setFilter(cat)}
                        >
                            {cat}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid */}
            <div className="scholarships-grid container mx-auto px-4 py-8">
                {loading ? (
                    <div className="flex justify-center p-20"><Spinner /></div>
                ) : filteredScholarships.length > 0 ? (
                    filteredScholarships.map(s => (
                        <ScholarshipCard key={s.id} scholarship={s} />
                    ))
                ) : (
                    <div className="empty-state">
                        <h3>No scholarships found</h3>
                        <p>Try adjusting your search or filters.</p>
                    </div>
                )}
            </div>

            <style jsx>{`
                .scholarships-page {
                    min-height: 100vh;
                    background: #0f172a;
                    padding-bottom: 80px;
                }

                .scholarship-hero {
                    position: relative;
                    padding: 80px 20px;
                    text-align: center;
                    overflow: hidden;
                    background: radial-gradient(circle at 50% 0%, #1e293b 0%, #0f172a 100%);
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }

                .content-wrapper {
                    position: relative;
                    z-index: 2;
                    max-width: 800px;
                    margin: 0 auto;
                }

                .hero-title {
                    font-family: var(--font-display);
                    font-size: 3.5rem;
                    color: white;
                    margin-bottom: 16px;
                    letter-spacing: -1px;
                }

                .text-gradient {
                    background: linear-gradient(135deg, #60a5fa, #a855f7);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                }

                .hero-subtitle {
                    color: #94a3b8;
                    font-size: 1.2rem;
                    margin-bottom: 40px;
                }

                .search-bar-container {
                    position: relative;
                    max-width: 600px;
                    margin: 0 auto;
                }

                .search-icon {
                    position: absolute;
                    left: 16px;
                    top: 50%;
                    transform: translateY(-50%);
                    color: #64748b;
                }

                .search-input {
                    width: 100%;
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    padding: 16px 16px 16px 48px;
                    border-radius: 50px;
                    color: white;
                    font-size: 1.1rem;
                    outline: none;
                    backdrop-filter: blur(10px);
                    transition: border-color 0.3s, background 0.3s;
                }
                .search-input:focus {
                    border-color: #3b82f6;
                    background: rgba(255,255,255,0.1);
                }

                .hero-glow {
                    position: absolute;
                    top: -50%;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 800px;
                    height: 800px;
                    background: radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%);
                    z-index: 1;
                    pointer-events: none;
                }

                /* Filters */
                .filters-container {
                    position: sticky;
                    top: 0; /* Or header height */
                    z-index: 10;
                    background: rgba(15, 23, 42, 0.8);
                    backdrop-filter: blur(10px);
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    padding: 16px 0;
                }

                .filter-scroll {
                    display: flex;
                    justify-content: center;
                    gap: 12px;
                    overflow-x: auto;
                    padding: 0 20px;
                    scrollbar-width: none;
                }
                .filter-scroll::-webkit-scrollbar { display: none; }

                .filter-chip {
                    background: rgba(255,255,255,0.05);
                    border: 1px solid rgba(255,255,255,0.1);
                    color: #94a3b8;
                    padding: 8px 20px;
                    border-radius: 20px;
                    font-size: 0.9rem;
                    white-space: nowrap;
                    transition: all 0.2s;
                }
                .filter-chip:hover {
                    background: rgba(255,255,255,0.1);
                    color: white;
                }
                .filter-chip.active {
                    background: #3b82f6;
                    border-color: #3b82f6;
                    color: white;
                }

                .scholarships-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
                    gap: 24px;
                }

                .empty-state {
                    grid-column: 1 / -1;
                    text-align: center;
                    padding: 60px;
                    color: #64748b;
                }
                .empty-state h3 { font-size: 1.5rem; margin-bottom: 8px; color: white; }

                @media (max-width: 768px) {
                    .hero-title { font-size: 2.5rem; }
                    .filter-scroll { justify-content: flex-start; }
                }
            `}</style>
        </div>
    );
}
