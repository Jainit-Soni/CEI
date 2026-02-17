"use client";

import React, { useState } from 'react';
import { Share2, Lock, Unlock, Download, Scan, CheckCircle, Smartphone } from 'lucide-react';
import Button from '@/components/Button';
import Confetti from 'react-confetti';

export default function PredictorPage() {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({ exam: "JEE Advanced", rank: "", category: "General" });
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [isShared, setIsShared] = useState(false);

    const handlePredict = async () => {
        setIsLoading(true);
        // Simulate "Scanning" delay for suspense
        setTimeout(async () => {
            try {
                const res = await fetch('/api/predict', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
                const data = await res.json();
                setResults(data);
                setStep(4); // Results step
            } catch (err) {
                console.error(err);
                alert("Prediction failed");
            }
            setIsLoading(false);
        }, 3000); // 3-second suspense
    };

    const handleShare = () => {
        // web share api
        if (navigator.share) {
            navigator.share({
                title: 'My College Chances 🎓',
                text: `I just checked my admission chances for ${formData.exam}! Check yours now.`,
                url: window.location.href,
            }).then(() => setIsShared(true));
        } else {
            // Fallback
            alert("Link copied to clipboard! (Simulated share)");
            setIsShared(true);
        }
    };

    return (
        <div className="predictor-page">
            {step === 4 && <Confetti recycle={false} numberOfPieces={200} />}

            <div className="container mx-auto px-4 py-12 max-w-2xl">

                {/* Header */}
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-blue-500 mb-4 font-display">
                        AI College Predictor <span className="text-xs align-top bg-blue-500/20 text-blue-400 px-2 py-1 rounded ml-2">BETA</span>
                    </h1>
                    <p className="text-slate-400">
                        Enter your rank. We'll scan 500+ colleges to find your <span className="text-white font-semibold">Perfect Match</span>.
                    </p>
                </div>

                {/* Wizard Container */}
                <div className="wizard-box glass-panel relative overflow-hidden">

                    {/* Progress Bar */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-slate-800">
                        <div
                            className="h-full bg-cyan-500 transition-all duration-500"
                            style={{ width: `${(step / 4) * 100}%` }}
                        ></div>
                    </div>

                    {/* Step 1: Exam */}
                    {step === 1 && (
                        <div className="step-content p-8">
                            <h2 className="text-2xl font-bold mb-6 text-white">Which exam did you take?</h2>
                            <div className="grid gap-4">
                                {["JEE Advanced", "JEE Main", "BITSAT", "NEET"].map(exam => (
                                    <button
                                        key={exam}
                                        className={`option-btn ${formData.exam === exam ? 'active' : ''}`}
                                        onClick={() => setFormData({ ...formData, exam })}
                                    >
                                        <span className="w-4 h-4 rounded-full border border-slate-400 mr-3 flex items-center justify-center">
                                            {formData.exam === exam && <div className="w-2 h-2 bg-cyan-400 rounded-full" />}
                                        </span>
                                        {exam}
                                    </button>
                                ))}
                            </div>
                            <Button className="w-full mt-8" onClick={() => setStep(2)}>Next Step</Button>
                        </div>
                    )}

                    {/* Step 2: Rank */}
                    {step === 2 && (
                        <div className="step-content p-8">
                            <h2 className="text-2xl font-bold mb-6 text-white">What is your Rank?</h2>
                            <input
                                type="number"
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-4 text-2xl text-center text-white focus:border-cyan-500 focus:outline-none mb-2"
                                placeholder="e.g. 5400"
                                value={formData.rank}
                                onChange={e => setFormData({ ...formData, rank: e.target.value })}
                                autoFocus
                            />
                            <p className="text-center text-slate-500 text-sm mb-8">If you don't know exact rank, enter expected.</p>
                            <Button className="w-full" disabled={!formData.rank} onClick={() => setStep(3)}>Next Step</Button>
                        </div>
                    )}

                    {/* Step 3: Category */}
                    {step === 3 && (
                        <div className="step-content p-8">
                            <h2 className="text-2xl font-bold mb-6 text-white">Select Category</h2>
                            <div className="grid grid-cols-2 gap-4">
                                {["General", "OBC", "SC", "ST", "EWS"].map(cat => (
                                    <button
                                        key={cat}
                                        className={`option-btn ${formData.category === cat ? 'active' : ''}`}
                                        onClick={() => setFormData({ ...formData, category: cat })}
                                    >
                                        {formData.category === cat && <CheckCircle size={16} className="text-cyan-400 mr-2" />}
                                        {cat}
                                    </button>
                                ))}
                            </div>
                            <Button className="w-full mt-8" onClick={handlePredict}>
                                {isLoading ? "Scanning Databases..." : "Reveal My Colleges 🚀"}
                            </Button>
                        </div>
                    )}

                    {/* Loading Overlay */}
                    {isLoading && (
                        <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center z-20 backdrop-blur-sm">
                            <div className="scanner-line"></div>
                            <Scan size={64} className="text-cyan-400 animate-pulse mb-6" />
                            <h3 className="text-xl font-mono text-cyan-400">ANALYZING CUTOFFS...</h3>
                            <p className="text-slate-500 mt-2">Checking {formData.exam} 2025 Trends</p>
                        </div>
                    )}

                    {/* Step 4: Results */}
                    {step === 4 && results && (
                        <div className="step-content p-6">
                            <div className="text-center mb-6">
                                <h2 className="text-2xl font-bold text-white">Prediction Report 🎯</h2>
                                <p className="text-slate-400 text-sm">Based on Rank {formData.rank} ({formData.category})</p>
                            </div>

                            <div className="zones-container space-y-4 mb-8 h-64 overflow-y-auto pr-2 custom-scrollbar">
                                {/* Safe Zone */}
                                {results.safe.length > 0 && (
                                    <div className="zone-card border-l-4 border-green-500">
                                        <h3 className="text-green-400 font-bold mb-2 flex items-center"><CheckCircle size={16} className="mr-2" /> 100% Safe (High Probability)</h3>
                                        {results.safe.map(c => (
                                            <div key={c.collegeId} className="result-item">{c.collegeName} <span className="text-slate-500 text-xs">({c.program})</span></div>
                                        ))}
                                    </div>
                                )}

                                {/* Target Zone */}
                                {results.target.length > 0 && (
                                    <div className="zone-card border-l-4 border-yellow-500">
                                        <h3 className="text-yellow-400 font-bold mb-2 flex items-center"><Scan size={16} className="mr-2" /> Target (50/50 Chance)</h3>
                                        {results.target.map(c => (
                                            <div key={c.collegeId} className="result-item">{c.collegeName} <span className="text-slate-500 text-xs">({c.program})</span></div>
                                        ))}
                                    </div>
                                )}

                                {/* Dream Zone */}
                                {results.dream.length > 0 && (
                                    <div className="zone-card border-l-4 border-red-500 opacity-75">
                                        <h3 className="text-red-400 font-bold mb-2 flex items-center"><Lock size={16} className="mr-2" /> Ambitious (Hard to get)</h3>
                                        {results.dream.map(c => (
                                            <div key={c.collegeId} className="result-item">{c.collegeName} <span className="text-slate-500 text-xs">({c.program})</span></div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Viral Lock */}
                            <div className="viral-lock bg-slate-800/50 p-6 rounded-xl border border-slate-700 text-center">
                                {!isShared ? (
                                    <>
                                        <Lock size={32} className="mx-auto text-amber-500 mb-3" />
                                        <h3 className="text-white font-bold mb-2">Unlock Detailed Report PDF</h3>
                                        <p className="text-slate-400 text-sm mb-4">Share this tool with friends to download the complete analysis with fee structures.</p>
                                        <Button variant="secondary" className="w-full justify-center" onClick={handleShare}>
                                            <Share2 size={16} className="mr-2" /> Share on WhatsApp to Unlock
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Unlock size={32} className="mx-auto text-green-500 mb-3" />
                                        <h3 className="text-white font-bold mb-2">Report Unlocked!</h3>
                                        <Button variant="primary" className="w-full justify-center">
                                            <Download size={16} className="mr-2" /> Download Predictor PDF
                                        </Button>
                                    </>
                                )}
                            </div>

                            <button onClick={() => setStep(1)} className="text-slate-500 text-sm underline w-full text-center mt-6 hover:text-white">Start Over</button>
                        </div>
                    )}

                </div>
            </div>

            <style jsx>{`
                .predictor-page {
                    min-height: 100vh;
                    background: transparent; /* Handled by global.css */
                    background-image: 
                        radial-gradient(at 0% 0%, rgba(56, 189, 248, 0.1) 0px, transparent 50%),
                        radial-gradient(at 100% 100%, rgba(139, 92, 246, 0.1) 0px, transparent 50%);
                    padding-bottom: 40px;
                }
                .wizard-box {
                    max-width: 100%; /* Responsive width */
                }
                
                @media (max-width: 640px) {
                    .step-content { padding: 24px 16px; }
                    .option-btn { padding: 12px; font-size: 0.95rem; }
                    .zones-container { max-height: none; overflow-y: visible; }
                }

                .option-btn {
                    width: 100%;
                    text-align: left;
                    padding: 16px;
                    background: rgba(255,255,255,0.03);
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 12px;
                    color: #cbd5e1;
                    font-weight: 500;
                    display: flex;
                    align-items: center;
                    transition: all 0.2s;
                }
                .option-btn:hover { background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.2); }
                .option-btn.active {
                    background: rgba(6, 182, 212, 0.1);
                    border-color: #06b6d4;
                    color: white;
                    box-shadow: 0 0 15px rgba(6, 182, 212, 0.2);
                }

                .scanner-line {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 2px;
                    background: #06b6d4;
                    box-shadow: 0 0 10px #06b6d4;
                    animation: scan 2s linear infinite;
                }
                @keyframes scan {
                    0% { top: 0; opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }

                .zone-card {
                    background: rgba(0,0,0,0.2);
                    padding: 16px;
                    border-radius: 8px;
                }
                .result-item {
                    color: white;
                    padding: 4px 0;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }
                .result-item:last-child { border-bottom: none; }
            `}</style>
        </div>
    );
}
