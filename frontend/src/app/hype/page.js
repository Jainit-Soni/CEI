"use client";

import React, { useState, useEffect } from 'react';
import { Search, Trophy, TrendingUp, Zap, Clock, Calendar, Globe } from 'lucide-react';
import HypeLeaderboard from '@/components/HypeLeaderboard';
import Button from '@/components/Button';
import Spinner from '@/components/Spinner';

const TIMEFRAMES = [
    { id: 'daily', label: 'Today', icon: <Clock size={16} /> },
    { id: 'weekly', label: 'This Week', icon: <Calendar size={16} /> },
    { id: 'monthly', label: 'This Month', icon: <TrendingUp size={16} /> },
    { id: 'yearly', label: 'All Time', icon: <Globe size={16} /> }
];

export default function HypePage() {
    const [leaderboard, setLeaderboard] = useState([]);
    const [recentVotes, setRecentVotes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [timeframe, setTimeframe] = useState('daily');

    // Voting State
    const [search, setSearch] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isVoting, setIsVoting] = useState(false);

    // Mock User (Replace with real auth context)
    const mockUser = { uid: "user-x", name: "Jainit Soni" };

    // Fetch Data
    const fetchStats = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/hype/stats?timeframe=${timeframe}`);
            const data = await res.json();
            setLeaderboard(data.leaderboard);
            setRecentVotes(data.recentVotes);
        } catch (err) {
            console.error("Failed to load hype stats", err);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchStats();
    }, [timeframe]);

    // Handle Search for Voting
    useEffect(() => {
        if (search.length > 2) {
            fetch(`/api/colleges?search=${search}`)
                .then(res => res.json())
                .then(data => setSearchResults(data.slice(0, 5)))
                .catch(err => console.error(err));
        } else {
            setSearchResults([]);
        }
    }, [search]);

    // Handle Vote
    const handleVote = async (college) => {
        if (!confirm(`Cast your vote for ${college.name}?`)) return;

        setIsVoting(true);
        try {
            const res = await fetch('/api/hype/vote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    collegeId: college.id,
                    collegeName: college.name,
                    userId: mockUser.uid,
                    userName: mockUser.name
                })
            });

            if (res.ok) {
                alert(`🚀 Vote cast for ${college.name}!`);
                setSearch("");
                setSearchResults([]);
                fetchStats(); // Refresh stats
            } else {
                alert("Voting failed!");
            }
        } catch (err) {
            console.error(err);
            alert("Error casting vote");
        }
        setIsVoting(false);
    };

    return (
        <div className="hype-page">

            {/* Live Ticker */}
            <div className="live-ticker">
                <div className="ticker-label"><Zap size={14} className="mr-1" /> LIVE ACTIONS</div>
                <div className="ticker-track">
                    {recentVotes.map((vote, i) => (
                        <span key={i} className="ticker-item">
                            <span className="user-name">{vote.userName}</span> voted for <span className="college-hl">{vote.collegeName}</span>
                            <span className="time-ago">Just now</span>
                        </span>
                    ))}
                    {/* Duplicate for loop effect */}
                    {recentVotes.map((vote, i) => (
                        <span key={`dup-${i}`} className="ticker-item">
                            <span className="user-name">{vote.userName}</span> voted for <span className="college-hl">{vote.collegeName}</span>
                            <span className="time-ago">Just now</span>
                        </span>
                    ))}
                </div>
            </div>

            {/* Hero */}
            <div className="hype-hero">
                <div className="container mx-auto px-4 text-center">
                    <div className="badge-pill mb-4"><Trophy size={14} /> The Student Battleground</div>
                    <h1 className="hero-title">Support Your <span className="text-gradient">Alma Mater</span></h1>
                    <p className="hero-subtitle">Authentic votes. Real students. Who rules the campus charts today?</p>

                    {/* Vote Box */}
                    <div className="vote-box">
                        <div className="search-wrapper">
                            <Search className="search-icon" size={20} />
                            <input
                                type="text"
                                placeholder="Search & Vote (e.g., IIT Bombay, BITS Pilani)..."
                                className="vote-input"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        {searchResults.length > 0 && (
                            <div className="search-dropdown glass-panel">
                                {searchResults.map(college => (
                                    <div key={college.id} className="search-item" onClick={() => handleVote(college)}>
                                        <span>{college.name}</span>
                                        <button className="vote-btn-small" disabled={isVoting}>
                                            {isVoting ? "..." : "Vote 🚀"}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="hero-glow"></div>
            </div>

            {/* Leaderboard Section */}
            <div className="container mx-auto px-4 py-8 max-w-4xl">

                {/* Timeframe Tabs */}
                <div className="tabs-container">
                    {TIMEFRAMES.map(tf => (
                        <button
                            key={tf.id}
                            className={`tab-btn ${timeframe === tf.id ? 'active' : ''}`}
                            onClick={() => setTimeframe(tf.id)}
                        >
                            {tf.icon} {tf.label}
                        </button>
                    ))}
                </div>

                {/* Chart */}
                {loading ? (
                    <div className="flex justify-center p-12"><Spinner /></div>
                ) : (
                    <HypeLeaderboard data={leaderboard} />
                )}

            </div>

            <style jsx>{`
                .hype-page {
                    min-height: 100vh;
                    background: transparent; /* Handled by global.css */
                    color: white;
                    overflow-x: hidden;
                }

                /* Ticker */
                .live-ticker {
                    background: rgba(30, 41, 59, 0.8);
                    backdrop-filter: blur(8px);
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                    height: 36px;
                    display: flex;
                    align-items: center;
                    overflow: hidden;
                    font-size: 0.85rem;
                }
                .ticker-label {
                    background: #3b82f6;
                    color: white;
                    padding: 0 12px;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                    flex-shrink: 0;
                    z-index: 2;
                    font-size: 0.75rem;
                }
                .ticker-track {
                    display: flex;
                    align-items: center;
                    animation: ticker 30s linear infinite;
                    white-space: nowrap;
                    padding-left: 20px;
                }
                .ticker-item {
                    margin-right: 40px;
                    color: #94a3b8;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                
                /* Hero Responsive */
                .hype-hero {
                    padding: 60px 0 40px; /* Reduced top padding */
                    position: relative;
                    overflow: hidden;
                    text-align: center;
                }
                @media (max-width: 768px) {
                    .hype-hero { padding: 40px 0 20px; }
                    .hero-title { font-size: 2.5rem !important; }
                    .hero-subtitle { font-size: 1rem !important; padding: 0 1rem; }
                }

                .hero-title {
                    font-family: var(--font-display);
                    font-size: 3.5rem;
                    line-height: 1.1;
                    margin-bottom: 16px;
                }

                /* ... existing styles ... */

                /* Vote Box Responsive */
                .vote-box {
                    max-width: 600px;
                    margin: 0 auto;
                    position: relative;
                    z-index: 10;
                    width: 90%; /* Responsive width */
                }

                /* Tabs Responsive */
                .tabs-container {
                    display: flex;
                    justify-content: center;
                    gap: 4px; /* Tighter gap */
                    margin-bottom: 24px;
                    background: rgba(255,255,255,0.03);
                    padding: 4px;
                    border-radius: 12px;
                    display: inline-flex;
                    position: relative;
                    left: 50%;
                    transform: translateX(-50%);
                    border: 1px solid rgba(255,255,255,0.05);
                    flex-wrap: wrap; /* Allow wrap on very small screens */
                    width: max-content;
                    max-width: 100%;
                }
                @media (max-width: 480px) {
                    .tab-btn { padding: 6px 10px; font-size: 0.8rem; }
                    .tabs-container { width: 100%; display: flex; }
                }
                .tab-btn {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 16px;
                    border-radius: 8px;
                    color: #94a3b8;
                    font-size: 0.9rem;
                    font-weight: 500;
                    transition: all 0.2s;
                }
                .tab-btn:hover { color: white; background: rgba(255,255,255,0.05); }
                .tab-btn.active {
                    background: #3b82f6;
                    color: white;
                    font-weight: 600;
                    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
                }
            `}</style>
        </div>
    );
}
