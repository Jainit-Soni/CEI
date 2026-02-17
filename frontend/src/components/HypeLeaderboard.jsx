"use client";

import React from 'react';
import { Trophy, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export default function HypeLeaderboard({ data }) {
    if (!data || data.length === 0) return <div className="text-center text-slate-500 py-8">No votes yet. Be the first!</div>;

    // Calculate max votes for relative bar width
    const maxVotes = Math.max(...data.map(d => d.votes));

    return (
        <div className="hype-leaderboard glass-panel">
            <h3 className="leaderboard-title">
                <Trophy className="text-yellow-400 mr-2" size={20} />
                Live Standings
            </h3>

            <div className="leaderboard-list">
                {data.map((item, index) => {
                    const widthStart = (item.votes / maxVotes) * 100;
                    const rank = index + 1;

                    // Simulate trend for demo (Randomize for now, would be real data later)
                    const trend = item.votes % 3 === 0 ? "up" : item.votes % 3 === 1 ? "down" : "flat";

                    return (
                        <div key={item.id} className={`leaderboard-item ${rank <= 3 ? 'top-rank' : ''}`}>
                            <div className="rank-col">
                                <span className={`rank-badge rank-${rank}`}>{rank}</span>
                                {trend === "up" && <TrendingUp size={14} className="text-green-400" />}
                                {trend === "down" && <TrendingDown size={14} className="text-red-400" />}
                                {trend === "flat" && <Minus size={14} className="text-slate-500" />}
                            </div>

                            <div className="info-col">
                                <div className="name-row">
                                    <span className="college-name">{item.name}</span>
                                    <span className="vote-count">{item.votes} Votes</span>
                                </div>
                                <div className="bar-bg">
                                    <div
                                        className={`bar-fill rank-${rank}`}
                                        style={{ width: `${widthStart}%` }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            <style jsx>{`
                .hype-leaderboard {
                    padding: 24px;
                    border-radius: 16px;
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.1);
                }

                .leaderboard-title {
                    font-family: var(--font-display);
                    font-size: 1.25rem;
                    margin-bottom: 24px;
                    display: flex;
                    align-items: center;
                    color: white;
                }

                .leaderboard-list {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .leaderboard-item {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                }

                .rank-col {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                    width: 30px;
                }

                .rank-badge {
                    font-size: 1rem;
                    font-weight: 800;
                    color: #64748b;
                    width: 24px;
                    height: 24px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .rank-badge.rank-1 { color: #facc15; font-size: 1.2rem; }
                .rank-badge.rank-2 { color: #94a3b8; font-size: 1.1rem; }
                .rank-badge.rank-3 { color: #b45309; font-size: 1.1rem; }

                .info-col {
                    flex: 1;
                }

                .name-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 6px;
                    font-size: 0.95rem;
                }
                .college-name { color: white; font-weight: 600; }
                .vote-count { color: #94a3b8; font-size: 0.85rem; }

                .bar-bg {
                    height: 8px;
                    background: rgba(255,255,255,0.05);
                    border-radius: 4px;
                    overflow: hidden;
                }

                .bar-fill {
                    height: 100%;
                    border-radius: 4px;
                    background: #3b82f6;
                    transition: width 1s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .bar-fill.rank-1 { background: linear-gradient(90deg, #facc15, #eab308); }
                .bar-fill.rank-2 { background: linear-gradient(90deg, #94a3b8, #64748b); }
                .bar-fill.rank-3 { background: linear-gradient(90deg, #fdba74, #ea580c); }

            `}</style>
        </div>
    );
}
