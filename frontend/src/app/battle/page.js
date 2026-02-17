"use client";

import React, { useState, useEffect } from 'react';
import { Swords } from 'lucide-react';
import BattleArena from '@/components/BattleArena';
import Spinner from '@/components/Spinner';

export default function BattlePage() {
    const [colleges, setColleges] = useState([]);
    const [loading, setLoading] = useState(true);

    // Selections
    const [fighter1, setFighter1] = useState(null);
    const [fighter2, setFighter2] = useState(null);

    // Load Colleges
    useEffect(() => {
        fetch('/api/colleges')
            .then(res => res.json())
            .then(data => {
                setColleges(data.filter(c => c.rankingTier === 'Tier 1' || c.rankingTier === 'Tier 2')); // Pre-filter for better battles
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load battle data:", err);
                setLoading(false);
            });
    }, []);

    const handleSelect = (idx, id) => {
        const selected = colleges.find(c => c._id === id || c.id === id);
        if (idx === 1) setFighter1(selected);
        else setFighter2(selected);
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-900"><Spinner /></div>;

    return (
        <div className="battle-page">
            <h1 className="battle-title">COLLEGE BATTLE ROYALE ⚔️</h1>
            <p className="battle-subtitle">Pick two fighters. The AI decides the winner.</p>

            <div className="selectors-container">
                <div className="selector-group">
                    <label className="text-blue-400 font-bold mb-2 block">Choose Fighter 1</label>
                    <select
                        className="battle-select"
                        onChange={(e) => handleSelect(1, e.target.value)}
                        value={fighter1?._id || fighter1?.id || ""}
                    >
                        <option value="">Select College...</option>
                        {colleges.map(c => (
                            <option key={c._id || c.id} value={c._id || c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                <div className="vs-text">VS</div>

                <div className="selector-group">
                    <label className="text-pink-400 font-bold mb-2 block">Choose Fighter 2</label>
                    <select
                        className="battle-select"
                        onChange={(e) => handleSelect(2, e.target.value)}
                        value={fighter2?._id || fighter2?.id || ""}
                    >
                        <option value="">Select College...</option>
                        {colleges.map(c => (
                            <option key={c._id || c.id} value={c._id || c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="arena-container">
                {fighter1 && fighter2 ? (
                    <BattleArena college1={fighter1} college2={fighter2} />
                ) : (
                    <div className="empty-arena">
                        <Swords size={60} className="text-slate-600 mb-4" />
                        <h3>Arena Empty</h3>
                        <p>Select two colleges above to start the fight.</p>
                    </div>
                )}
            </div>

            <style jsx>{`
                .battle-page {
                    min-height: 100vh;
                    background: #0f172a;
                    padding: 40px 20px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                }

                .battle-title {
                    font-family: var(--font-display);
                    font-size: 3rem;
                    background: linear-gradient(135deg, #f59e0b, #fbbf24);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    margin-bottom: 8px;
                    text-align: center;
                    text-shadow: 0 0 30px rgba(245, 158, 11, 0.3);
                }

                .battle-subtitle {
                    color: #94a3b8;
                    font-size: 1.1rem;
                    margin-bottom: 40px;
                }

                .selectors-container {
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    margin-bottom: 40px;
                    background: rgba(255,255,255,0.05);
                    padding: 20px;
                    border-radius: 16px;
                    border: 1px solid rgba(255,255,255,0.1);
                    width: 100%;
                    max-width: 800px;
                }

                .selector-group { flex: 1; }

                .battle-select {
                    width: 100%;
                    background: #1e293b;
                    border: 1px solid #334155;
                    color: white;
                    padding: 12px;
                    border-radius: 8px;
                    font-size: 1rem;
                    outline: none;
                }
                .battle-select:focus { border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2); }

                .vs-text {
                    font-size: 1.5rem;
                    font-weight: 900;
                    color: #475569;
                    font-style: italic;
                }

                .arena-container {
                    width: 100%;
                    max-width: 800px;
                }

                .empty-arena {
                    height: 300px;
                    background: rgba(255,255,255,0.03);
                    border: 2px dashed rgba(255,255,255,0.1);
                    border-radius: 20px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    color: #475569;
                }
                .empty-arena h3 { font-size: 1.5rem; margin-bottom: 4px; color: #64748b; font-weight: 700; }

                @media (max-width: 768px) {
                    .battle-title { font-size: 2rem; }
                    .selectors-container { flex-direction: column; gap: 10px; }
                    .vs-text { margin: 10px 0; font-size: 1rem; }
                }
            `}</style>
        </div>
    );
}
