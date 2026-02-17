"use client";

import React, { useState, useEffect } from 'react';
import { Trophy, Swords, TrendingUp, History, Star, Share2 } from 'lucide-react';
import Button from './Button';

export default function BattleArena({ college1, college2 }) {
    const [winner, setWinner] = useState(null);
    const [calculating, setCalculating] = useState(false);
    const [stats, setStats] = useState({ c1: {}, c2: {} });

    // Helper to extract numeric value from string (e.g., "25 LPA" -> 25)
    const extractValue = (str) => {
        if (!str) return 0;
        const num = parseFloat(str.replace(/[^0-9.]/g, ''));
        return isNaN(num) ? 0 : num;
    };

    const calculateBattle = () => {
        setCalculating(true);
        setWinner(null);

        // 1. ROI Score (0-100)
        // Avg Package / Fees * arbitrary multiplier
        // Fees often "2 Lakhs", Avg "20 LPA"
        const getROI = (col) => {
            const fees = extractValue(col.fees); // e.g. 8
            const pkg = extractValue(col.placements?.averagePackage); // e.g. 25
            if (!fees || !pkg) return 50; // Default
            let ratio = (pkg / fees) * 20;
            return Math.min(Math.max(ratio, 20), 95); // Clamp
        };

        // 2. Legacy Score (0-100)
        // Older = better
        const getLegacy = (col) => {
            const est = parseInt(col.meta?.establishedYear || "2000");
            const age = new Date().getFullYear() - est;
            return Math.min(Math.max(age, 10), 100);
        };

        // 3. Popularity (0-100)
        // Based on rankingTier (Tier 1 = 90, Tier 2 = 70, etc)
        const getPopularity = (col) => {
            if (col.rankingTier === "Tier 1") return 95;
            if (col.rankingTier === "Tier 2") return 75;
            return 60;
        };

        const c1Stats = {
            roi: getROI(college1),
            legacy: getLegacy(college1),
            pop: getPopularity(college1)
        };
        const c2Stats = {
            roi: getROI(college2),
            legacy: getLegacy(college2),
            pop: getPopularity(college2)
        };

        c1Stats.total = c1Stats.roi + c1Stats.legacy + c1Stats.pop;
        c2Stats.total = c2Stats.roi + c2Stats.legacy + c2Stats.pop;

        setStats({ c1: c1Stats, c2: c2Stats });

        setTimeout(() => {
            setCalculating(false);
            if (c1Stats.total > c2Stats.total) setWinner(1);
            else if (c2Stats.total > c1Stats.total) setWinner(2);
            else setWinner(0); // Draw
        }, 1500); // Dramatic delay
    };

    useEffect(() => {
        if (college1 && college2) {
            calculateBattle();
        }
    }, [college1, college2]);

    if (!college1 || !college2) return null;

    const renderBar = (val1, val2, label, icon) => (
        <div className="battle-stat-row">
            <div className="stat-label">
                {icon} {label}
            </div>
            <div className="bars-container">
                <div className="bar-wrapper left">
                    <div
                        className={`stat-bar c1 ${calculating ? 'loading' : ''} ${winner === 1 ? 'win' : ''}`}
                        style={{ width: `${calculating ? 0 : val1}%` }}
                    >
                        <span className="bar-val">{Math.round(val1)}</span>
                    </div>
                </div>
                <div className="vs-divider"></div>
                <div className="bar-wrapper right">
                    <div
                        className={`stat-bar c2 ${calculating ? 'loading' : ''} ${winner === 2 ? 'win' : ''}`}
                        style={{ width: `${calculating ? 0 : val2}%` }}
                    >
                        <span className="bar-val">{Math.round(val2)}</span>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="battle-arena">
            {/* Fighters Header */}
            <div className="fighters-row">
                <div className={`fighter c1 ${winner === 1 ? 'winner' : ''} ${winner === 2 ? 'loser' : ''}`}>
                    {winner === 1 && <div className="crown">👑</div>}
                    <img src={college1.logo || "/placeholder-logo.png"} alt={college1.name} />
                    <h3>{college1.shortName || college1.name.substring(0, 15)}</h3>
                    {winner === 1 && <span className="win-badge">WINNER</span>}
                </div>

                <div className="vs-badge">
                    <Swords size={32} />
                    <span>VS</span>
                </div>

                <div className={`fighter c2 ${winner === 2 ? 'winner' : ''} ${winner === 1 ? 'loser' : ''}`}>
                    {winner === 2 && <div className="crown">👑</div>}
                    <img src={college2.logo || "/placeholder-logo.png"} alt={college2.name} />
                    <h3>{college2.shortName || college2.name.substring(0, 15)}</h3>
                    {winner === 2 && <span className="win-badge">WINNER</span>}
                </div>
            </div>

            {/* Stats Bars */}
            <div className="battle-stats">
                {renderBar(stats.c1.roi, stats.c2.roi, "ROI Power", <TrendingUp size={16} />)}
                {renderBar(stats.c1.legacy, stats.c2.legacy, "Legacy", <History size={16} />)}
                {renderBar(stats.c1.pop, stats.c2.pop, "Popularity", <Star size={16} />)}
            </div>

            {/* Total Score / Share */}
            {!calculating && winner !== null && (
                <div className="battle-result">
                    <div className="total-score">
                        <span>{Math.round(stats.c1.total)}</span>
                        <span className="label">TOTAL SCORE</span>
                        <span>{Math.round(stats.c2.total)}</span>
                    </div>

                    <div className="share-victory">
                        <p>
                            {winner === 0 ? "It's a draw!" :
                                winner === 1 ? `${college1.shortName} wins the battle!` :
                                    `${college2.shortName} wins the battle!`}
                        </p>
                        <Button variant="gradient" size="sm">
                            <Share2 size={16} className="mr-2" /> Share Result
                        </Button>
                    </div>
                </div>
            )}

            <style jsx>{`
                .battle-arena {
                    background: #1e293b; /* Dark theme for battle */
                    border-radius: 20px;
                    padding: 32px;
                    color: white;
                    box-shadow: 0 20px 40px -10px rgba(0,0,0,0.5);
                    position: relative;
                    overflow: hidden;
                }
                
                .fighters-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 40px;
                    position: relative;
                }
                
                .fighter {
                    text-align: center;
                    width: 35%;
                    position: relative;
                    transition: transform 0.5s;
                }
                .fighter img {
                    width: 80px;
                    height: 80px;
                    border-radius: 16px;
                    background: white;
                    padding: 4px;
                    object-fit: contain;
                    margin-bottom: 12px;
                    border: 4px solid transparent;
                }
                .fighter h3 { font-size: 1.1rem; font-weight: 700; margin: 0; }
                
                .fighter.winner { transform: scale(1.1); }
                .fighter.winner img { border-color: #fbbf24; box-shadow: 0 0 20px rgba(251, 191, 36, 0.5); }
                .fighter.loser { opacity: 0.5; transform: scale(0.9); filter: grayscale(1); }

                .crown {
                    position: absolute;
                    top: -30px;
                    left: 50%;
                    transform: translateX(-50%) rotate(-10deg);
                    font-size: 2rem;
                    animation: bounce 2s infinite;
                }
                
                .win-badge {
                    background: #fbbf24;
                    color: black;
                    font-weight: 900;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-size: 0.7rem;
                    margin-top: 4px;
                    display: inline-block;
                }

                .vs-badge {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    color: #94a3b8;
                    font-weight: 900;
                    font-size: 1.5rem;
                }

                /* Stats Bars */
                .battle-stats {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .battle-stat-row {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .stat-label {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    font-size: 0.8rem;
                    color: #94a3b8;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                
                .bars-container {
                    display: flex;
                    align-items: center;
                    height: 24px;
                    background: rgba(255,255,255,0.05);
                    border-radius: 12px;
                    overflow: hidden;
                    position: relative;
                }
                .vs-divider { width: 2px; height: 100%; background: rgba(255,255,255,0.1); z-index: 2; }
                
                .bar-wrapper { flex: 1; display: flex; height: 100%; }
                .bar-wrapper.left { justify-content: flex-end; }
                .bar-wrapper.right { justify-content: flex-start; }
                
                .stat-bar {
                    height: 100%;
                    display: flex;
                    align-items: center;
                    padding: 0 8px;
                    transition: width 1.5s cubic-bezier(0.34, 1.56, 0.64, 1);
                    position: relative;
                }
                .stat-bar.c1 { background: linear-gradient(90deg, #3b82f6, #60a5fa); justify-content: flex-end; border-radius: 0 4px 4px 0; }
                .stat-bar.c2 { background: linear-gradient(90deg, #ec4899, #f472b6); justify-content: flex-start; border-radius: 4px 0 0 4px; }
                
                .stat-bar.win { filter: brightness(1.2); }
                .bar-val { font-size: 0.75rem; font-weight: 700; color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.5); }

                /* Result */
                .battle-result {
                    margin-top: 32px;
                    text-align: center;
                    animation: fadeUp 0.5s ease;
                }
                .total-score {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-family: var(--font-display);
                    font-size: 1.5rem;
                    font-weight: 700;
                    margin-bottom: 16px;
                    padding: 0 10%;
                }
                .total-score .label { font-size: 0.8rem; color: #64748b; font-weight: 500; }
                
                .share-victory p { font-size: 1.1rem; margin-bottom: 12px; color: #cbd5e1; }

                @keyframes bounce { 0%, 100% { transform: translate(-50%, 0) rotate(-10deg); } 50% { transform: translate(-50%, -10px) rotate(-10deg); } }
                @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
}
