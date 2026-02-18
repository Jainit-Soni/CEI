"use client";

import React, { useState } from 'react';
import { Share2, Lock, Unlock, Download, Scan, CheckCircle, Target, Sparkles, ChevronRight, RefreshCw, Cpu, Radio, Activity } from 'lucide-react';
import Button from '@/components/Button';
import Container from '@/components/Container';
import GlassPanel from '@/components/GlassPanel';
import Confetti from 'react-confetti';
import { postPredict } from '@/lib/api';
import { RevealOnScroll } from '@/lib/useIntersectionObserver';
import "../colleges/page.css";

export default function PredictorPage() {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({ exam: "JEE Advanced", inputType: "rank", value: "", category: "General" });
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState(null);
    const [isShared, setIsShared] = useState(false);

    const handlePredict = async () => {
        setIsLoading(true);
        // Simulate API call with "Safe" and "Target" buckets
        setTimeout(async () => {
            try {
                // In a real scenario, this would be the actual API call
                // const data = await postPredict(formData); 

                // MOCK RESPONSE for UI demonstration based on user request
                const mockData = {
                    safe: [], // Simulating empty for "No guaranteed matches" check
                    target: [
                        { collegeId: 1, collegeName: "IIT Bombay", probability: 55 },
                        { collegeId: 2, collegeName: "IIT Delhi", probability: 48 }
                    ]
                };

                setResults(mockData);
                setStep(4);
            } catch (err) {
                console.error(err);
                alert("Prediction failed");
            }
            setIsLoading(false);
        }, 2500);
    };

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: 'College Admission Prediction',
                text: `I just checked my admission chances for ${formData.exam}. Check yours now!`,
                url: window.location.href,
            }).then(() => setIsShared(true));
        } else {
            alert("Link copied to clipboard!");
            setIsShared(true);
        }
    };

    return (
        <div className="predictor-page min-h-screen bg-transparent text-slate-900 selection:bg-indigo-500/30">
            {step === 4 && <Confetti recycle={false} numberOfPieces={300} colors={['#6366f1', '#a855f7', '#06b6d4']} />}

            {/* Premium Hero Section */}
            <section className="relative pt-32 pb-20 overflow-hidden">
                {/* Global orbs provide background now */}

                <Container className="relative z-10 text-center">
                    <RevealOnScroll>
                        <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 text-slate-900">
                            College <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-cyan-500">Predictor</span>
                        </h1>
                        <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed font-medium">
                            Advanced algorithms to calculate your admission probability based on historical cutoffs and seat matrices.
                        </p>
                    </RevealOnScroll>
                </Container>
            </section>

            {/* Main Interface */}
            <section className="pb-24 relative z-10">
                <Container>
                    <div className="max-w-4xl mx-auto">
                        <RevealOnScroll>
                            <GlassPanel className="p-0 overflow-hidden shadow-2xl border-white/60 backdrop-blur-3xl bg-white/60" variant="strong">
                                <div className="min-h-[500px] relative">
                                    {/* Step 1: Exam Selection */}
                                    {step === 1 && (
                                        <div className="p-8 md:p-12 animate-in fade-in zoom-in-95 duration-500">
                                            <div className="mb-10 text-center">
                                                <h3 className="text-2xl font-bold text-slate-900 mb-2">Select Examination</h3>
                                                <p className="text-slate-500 text-sm">Choose the entrance exam you appeared for</p>
                                            </div>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                {[
                                                    "JEE Advanced", "JEE Main", "NEET", "BITSAT",
                                                    "VITEEE", "MHT CET", "COMEDK", "KCET",
                                                    "WBJEE", "GATE", "CAT", "XAT", "CMAT"
                                                ].map(exam => (
                                                    <button
                                                        key={exam}
                                                        className={`p-4 rounded-xl border transition-all relative overflow-hidden group flex flex-col items-center justify-center gap-3 h-[110px] ${formData.exam === exam
                                                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-md'
                                                            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-600'
                                                            }`}
                                                        onClick={() => setFormData({ ...formData, exam })}
                                                    >
                                                        <span className="font-bold text-sm text-center">{exam}</span>
                                                        {formData.exam === exam && (
                                                            <div className="absolute inset-0 border-2 border-indigo-500 rounded-xl" />
                                                        )}
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="mt-12 flex justify-center">
                                                <Button
                                                    onClick={() => setStep(2)}
                                                    className="px-10 py-4 bg-slate-900 text-white hover:bg-slate-800 font-bold rounded-full"
                                                >
                                                    Next Step <ChevronRight size={16} className="ml-2" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Step 2: Input (Rank/Percentile) */}
                                    {step === 2 && (
                                        <div className="p-8 md:p-12 text-center animate-in fade-in slide-in-from-right-8 duration-500">
                                            <div className="mb-12">
                                                <h3 className="text-2xl font-bold text-slate-900 mb-2">Enter Score Details</h3>
                                                <p className="text-slate-500 text-sm">Switch between Rank or Percentile mode</p>
                                            </div>

                                            {/* Toggle */}
                                            <div className="flex justify-center mb-10">
                                                <div className="bg-slate-100 p-1 rounded-full flex border border-slate-200">
                                                    <button
                                                        onClick={() => setFormData({ ...formData, inputType: 'rank' })}
                                                        className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${formData.inputType === 'rank' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                                                    >
                                                        Rank
                                                    </button>
                                                    <button
                                                        onClick={() => setFormData({ ...formData, inputType: 'percentile' })}
                                                        className={`px-6 py-2 rounded-full text-sm font-bold transition-all ${formData.inputType === 'percentile' ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                                                    >
                                                        Percentile
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="max-w-xs mx-auto mb-12">
                                                <div className="relative group">
                                                    <input
                                                        type="number"
                                                        className="w-full bg-transparent border-b-2 border-slate-300 py-4 text-5xl text-center text-slate-900 font-bold focus:outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-200"
                                                        placeholder={formData.inputType === 'rank' ? "e.g., 5000" : "e.g., 98.5"}
                                                        value={formData.value}
                                                        onChange={e => setFormData({ ...formData, value: e.target.value })}
                                                        autoFocus
                                                    />
                                                    <div className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-4">
                                                        Enter your {formData.inputType === 'rank' ? "CRL Rank" : "NTA Percentile Score"}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="flex justify-center gap-4">
                                                <button onClick={() => setStep(1)} className="px-6 py-3 text-slate-400 hover:text-slate-600 transition-colors font-bold">Back</button>
                                                <Button
                                                    onClick={() => setStep(3)}
                                                    disabled={!formData.value}
                                                    className="px-8 py-3 bg-slate-900 text-white hover:bg-slate-800 font-bold rounded-full"
                                                >
                                                    Continue <ChevronRight size={16} className="ml-2" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Step 3: Category */}
                                    {step === 3 && (
                                        <div className="p-8 md:p-12 text-center animate-in fade-in slide-in-from-right-8 duration-500">
                                            <div className="mb-10">
                                                <h3 className="text-2xl font-bold text-slate-900 mb-2">Select Category</h3>
                                                <p className="text-slate-500 text-sm">For accurate reservation-based prediction</p>
                                            </div>

                                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-12">
                                                {["General", "OBC", "SC", "ST", "EWS"].map(cat => (
                                                    <button
                                                        key={cat}
                                                        className={`py-4 rounded-xl border transition-all ${formData.category === cat
                                                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700 font-bold'
                                                            : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:border-indigo-300'
                                                            }`}
                                                        onClick={() => setFormData({ ...formData, category: cat })}
                                                    >
                                                        <span className="font-bold text-sm tracking-wide">{cat}</span>
                                                    </button>
                                                ))}
                                            </div>

                                            <div className="flex justify-center">
                                                <Button
                                                    onClick={handlePredict}
                                                    disabled={isLoading}
                                                    className="w-full max-w-md py-4 text-lg justify-center bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25 rounded-xl font-bold"
                                                >
                                                    {isLoading ? (
                                                        <span className="flex items-center gap-2">
                                                            <RefreshCw className="animate-spin" size={20} /> Analyzing...
                                                        </span>
                                                    ) : "Predict My Colleges"}
                                                </Button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Step 4: Results */}
                                    {step === 4 && results && (
                                        <div className="p-8 md:p-12 animate-in fade-in duration-700 bg-slate-50/50">
                                            <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-200">
                                                <h2 className="text-2xl font-bold text-slate-900">Prediction Report</h2>
                                                <button onClick={() => setStep(1)} className="text-xs font-bold text-indigo-600 hover:text-indigo-500 uppercase tracking-widest flex items-center gap-2">
                                                    <RefreshCw size={12} /> Reset
                                                </button>
                                            </div>

                                            <div className="space-y-8">
                                                {/* Safe Zone */}
                                                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="p-2 bg-emerald-100 rounded-lg text-emerald-600">
                                                            <CheckCircle size={20} />
                                                        </div>
                                                        <h3 className="text-lg font-bold text-emerald-700">Safe Zone (90%+ Chance)</h3>
                                                    </div>

                                                    {results.safe && results.safe.length > 0 ? (
                                                        <div className="space-y-3">
                                                            {results.safe.map((c, i) => (
                                                                <div key={i} className="flex justify-between items-center p-3 bg-white rounded-lg border border-emerald-100 shadow-sm">
                                                                    <span className="font-medium text-slate-900">{c.collegeName}</span>
                                                                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded">HIGH PROBABILITY</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="text-slate-500 italic text-sm py-2">
                                                            No guaranteed matches found for this {formData.inputType}.
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Target Zone */}
                                                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
                                                    <div className="flex items-center gap-3 mb-4">
                                                        <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
                                                            <Target size={20} />
                                                        </div>
                                                        <h3 className="text-lg font-bold text-amber-700">Target Zone (50/50 Chance)</h3>
                                                    </div>

                                                    {results.target && results.target.length > 0 ? (
                                                        <div className="space-y-3">
                                                            {results.target.map((c, i) => (
                                                                <div key={i} className="flex justify-between items-center p-3 bg-white rounded-lg border border-amber-100 shadow-sm">
                                                                    <span className="font-medium text-slate-900">{c.collegeName}</span>
                                                                    <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">MODERATE</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <div className="text-slate-500 italic text-sm py-2">
                                                            No target matches found.
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="pt-6">
                                                    <Button onClick={handleShare} className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl justify-center">
                                                        <Share2 size={16} className="mr-2" /> Share Report
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </GlassPanel>
                        </RevealOnScroll>
                    </div>
                </Container>
            </section>

            <style jsx>{`
                .list-hero--predictor {
                    background: transparent;
                }
                .reverse-spin {
                    animation-direction: reverse;
                    animation-duration: 3s;
                }
                @keyframes scan {
                    0%, 100% { transform: translateX(-100%); }
                    50% { transform: translateX(100%); }
                }
            `}</style>
        </div>
    );
}
