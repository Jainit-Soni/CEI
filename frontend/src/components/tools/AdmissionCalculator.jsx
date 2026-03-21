"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  Calculator, 
  Target, 
  ShieldCheck, 
  Sparkles, 
  AlertCircle, 
  ChevronRight, 
  ChevronLeft,
  RotateCcw,
  Trophy,
  ArrowRight
} from "lucide-react";
import Magnet from "../animations/Magnet";
import { 
  Radar, 
  RadarChart, 
  PolarGrid, 
  PolarAngleAxis, 
  ResponsiveContainer, 
  Tooltip as RechartsTooltip 
} from 'recharts';
import { postPredict } from "@/lib/api";
import Link from "next/link";
import "./AdmissionCalculator.css";

// Re-using ResultCard logic with calculator-specific styling
const ResultCard = ({ rec, rank }) => {
    const displayVal = rec.scoreType === 'percentile' 
        ? rec.closingVal.toFixed(2) 
        : rec.closingVal.toLocaleString();
    
    const label = rec.scoreType === 'percentile' ? 'Percentile' 
                : rec.scoreType === 'score' ? 'Score' 
                : 'Closing Rank';

    return (
        <div className="dec-card" style={{ animation: `slideUp 0.3s ease ${rank * 0.05}s both` }}>
            <div className="dec-card-rank">#{rank}</div>
            <div className="dec-card-body">
                <h3 className="dec-card-name" style={{ color: '#0f172a', fontWeight: 800 }}>{rec.collegeName}</h3>
                <div className="dec-card-meta">
                    <span className="dec-pill dec-pill-state" style={{ background: '#e0f2fe', color: '#0369a1' }}>{rec.quota || 'General'} Quota</span>
                    <span className="dec-pill dec-pill-tier" style={{ background: '#f1f5f9', color: '#475569' }}>{rec.category}</span>
                    <span className="dec-pill dec-pill-cei" style={{ background: '#eef2ff', color: '#4338ca' }}>{rec.probability}</span>
                </div>
                <p style={{ fontSize: '0.875rem', color: '#64748b', marginTop: 8, lineHeight: 1.5 }}>{rec.courseName}</p>
            </div>
            <div className="dec-score-side">
                <div className="dec-score-number" style={{ color: '#3b82f6' }}>{displayVal}</div>
                <div className="dec-score-label">{label}</div>
                <div className={`dec-match-badge ${rec.zone === 'safe' ? 'Excellent' : rec.zone === 'target' ? 'Good' : 'Stretch'}`} 
                     style={{ 
                        background: rec.zone === 'safe' ? '#d1fae5' : rec.zone === 'target' ? '#fef3c7' : '#fee2e2',
                        color: rec.zone === 'safe' ? '#065f46' : rec.zone === 'target' ? '#92400e' : '#991b1b',
                        padding: '4px 12px', borderRadius: '20px', fontSize: '0.7rem', fontWeight: 800, marginTop: 8, display: 'inline-block'
                     }}>
                    {rec.zone.toUpperCase()}
                </div>
            </div>
            <Link 
                href={`/college/${rec.collegeId}`} 
                className="absolute inset-0 opacity-0"
                aria-label="View College"
            />
        </div>
    );
};

const STEP_LABELS = ["Exam & Score", "Category & Quota", "Final Profile"];

const DEFAULT_EXAMS = [
    { id: "JEE Main", type: "Engineering", scoreType: "Rank", label: "JEE Main (CRL)" },
    { id: "JEE Advanced", type: "Engineering", scoreType: "Rank", label: "JEE Advanced (CRL)" },
    { id: "WBJEE", type: "Engineering", scoreType: "Rank", label: "WBJEE Rank" },
    { id: "MHT-CET", type: "Engineering", scoreType: "Percentile", label: "MHT-CET Percentile" },
    { id: "CAT", type: "Management", scoreType: "Percentile", label: "CAT Percentile" },
    { id: "CMAT", type: "Management", scoreType: "Percentile", label: "CMAT Percentile" },
    { id: "NMAT", type: "Management", scoreType: "Score", label: "NMAT Scaled Score" },
    { id: "MICAT", type: "Management", scoreType: "Score", label: "MICAT Score" },
];

const AdmissionCalculator = () => {
    const [step, setStep] = useState(0); // 0-2 wizard, 3 loading, 4 results
    const [exams, setExams] = useState(DEFAULT_EXAMS);
    const [formData, setFormData] = useState({
        rank: "",
        exam: "JEE Main",
        category: "OPEN",
        quota: "AI",
        gender: "Gender-Neutral",
        workEx: "0",
        stream: "Engineering"
    });
    
    const [results, setResults] = useState(null);
    const [error, setError] = useState(null);

    // Sync Exams with Backend
    useEffect(() => {
        const fetchExams = async () => {
            try {
                const res = await fetch(`${API_BASE}/exams`);
                if (!res.ok) throw new Error("Failed to sync exams");
                const data = await res.json();
                
                if (Array.isArray(data)) {
                    const mapped = data.map(ex => ({
                        id: ex.id || ex.name,
                        type: ex.type || "Other",
                        scoreType: ex.stats?.scoreType || "Rank",
                        label: `${ex.id || ex.name} ${ex.stats?.scoreType || "Rank"}`
                    }));

                    // Merge with defaults to ensure core logic stability
                    setExams(prev => {
                        const existing = new Set(prev.map(e => e.id));
                        const news = mapped.filter(m => !existing.has(m.id));
                        return [...prev, ...news];
                    });
                }
            } catch (err) {
                console.warn("[CALC] Using local exam registry fallback:", err.message);
            }
        };
        fetchExams();
    }, []);

    const categories = ["OPEN", "OBC-NCL", "SC", "ST", "EWS"];
    const quotas = [
        { id: "AI", label: "All India (AI)" },
        { id: "HS", label: "Home State (HS)" },
        { id: "OS", label: "Other State (OS)" }
    ];

    const currentExam = exams.find(e => e.id === formData.exam) || exams[0];
    const isMBA = currentExam.type === "Management";

    const canNext = () => {
        if (step === 0) return formData.rank && Number(formData.rank) >= 0;
        if (step === 1) return !!formData.category && !!formData.quota;
        return true;
    };

    const handlePredict = async () => {
        setStep(3);
        setError(null);
        try {
            const data = await postPredict(formData);
            setResults(data);
            setStep(4);
        } catch (err) {
            console.error(err);
            setError("The prediction engine encountered an anomaly. Please try again.");
            setStep(2);
        }
    };

    const handleNext = () => {
        if (step === 2) { handlePredict(); return; }
        setStep(s => s + 1);
    };

    const restart = () => {
        setStep(0);
        setResults(null);
        setError(null);
        setFormData({ ...formData, rank: "" });
    };

    const computeRadarData = (results) => {
        if (!results) return [];
        return [
            { subject: 'Probability', value: 85, fullMark: 100 },
            { subject: 'ROI', value: 78, fullMark: 100 },
            { subject: 'Eligibility', value: 100, fullMark: 100 },
            { subject: 'Fit', value: 82, fullMark: 100 },
            { subject: 'Power', value: 88, fullMark: 100 },
        ];
    };

    return (
        <div className="calculator-wizard-container">
            {/* Step Indicators */}
            {step < 3 && (
                <div className="calculator-steps-row">
                    {STEP_LABELS.map((label, i) => (
                        <div key={i} className="calculator-step-item">
                            <div className={`calculator-step-dot ${i === step ? 'active' : i < step ? 'done' : 'pending'}`}>
                                {i < step ? '✓' : i + 1}
                            </div>
                            <span className={`calculator-step-label ${i === step ? 'active' : ''}`}>
                                {label}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Step 0: Exam & Score */}
            {step === 0 && (
                <div className="calculator-card animate-in fade-in slide-in-from-bottom-4">
                    <h2 className="calculator-card-title">Select your exam</h2>
                    <p className="calculator-card-subtitle">Choose your entrance examination and enter your score.</p>
                    
                    <div className="calc-input-group">
                        <label className="calc-label">Examination</label>
                        <select 
                            className="calc-select"
                            value={formData.exam}
                            onChange={(e) => setFormData({...formData, exam: e.target.value})}
                        >
                            <optgroup label="Engineering">
                                {exams.filter(e => e.type.toLowerCase().includes("engineering")).map(e => (
                                    <option key={e.id} value={e.id}>{e.id}</option>
                                ))}
                            </optgroup>
                            <optgroup label="Management (MBA)">
                                {exams.filter(e => e.type.toLowerCase().includes("management")).map(e => (
                                    <option key={e.id} value={e.id}>{e.id}</option>
                                ))}
                            </optgroup>
                            <optgroup label="Other Examinations">
                                {exams.filter(e => 
                                    !e.type.toLowerCase().includes("engineering") && 
                                    !e.type.toLowerCase().includes("management")
                                ).map(e => (
                                    <option key={e.id} value={e.id}>{e.id}</option>
                                ))}
                            </optgroup>
                        </select>
                    </div>

                    <div className="calc-input-group">
                        <label className="calc-label">Your {currentExam.scoreType}</label>
                        <div className="relative">
                            <input 
                                type="number" 
                                placeholder={`Enter ${currentExam.scoreType.toLowerCase()}...`}
                                className="calc-input"
                                value={formData.rank}
                                onChange={(e) => setFormData({...formData, rank: e.target.value})}
                                autoFocus
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Step 1: Category */}
            {step === 1 && (
                <div className="calculator-card animate-in fade-in slide-in-from-bottom-4">
                    <h2 className="calculator-card-title">{isMBA ? "Diversity & Reservation" : "Reservation & Quota"}</h2>
                    <p className="calculator-card-subtitle">Help us filter colleges based on your eligibility criteria.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="calc-input-group">
                            <label className="calc-label">Category</label>
                            <select 
                                className="calc-select"
                                value={formData.category}
                                onChange={(e) => setFormData({...formData, category: e.target.value})}
                            >
                                {categories.map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>

                        <div className="calc-input-group">
                            <label className="calc-label">Seat Quota</label>
                            <select 
                                className="calc-select"
                                value={formData.quota}
                                onChange={(e) => setFormData({...formData, quota: e.target.value})}
                            >
                                {quotas.map(q => <option key={q.id} value={q.id}>{q.label}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 2: Final Profile */}
            {step === 2 && (
                <div className="calculator-card animate-in fade-in slide-in-from-bottom-4">
                    <h2 className="calculator-card-title">Profile Context</h2>
                    <p className="calculator-card-subtitle">Finalize your profile details for {isMBA ? "Composite Score" : "Admission Roadmap"} calculation.</p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="calc-input-group">
                            <label className="calc-label">Gender Pool</label>
                            <select 
                                className="calc-select"
                                value={formData.gender}
                                onChange={(e) => setFormData({...formData, gender: e.target.value})}
                            >
                                <option>Gender-Neutral</option>
                                <option>Female-Only</option>
                            </select>
                        </div>

                        {isMBA ? (
                            <div className="calc-input-group">
                                <label className="calc-label">Work Experience (Months)</label>
                                <input 
                                    type="number"
                                    className="calc-input"
                                    value={formData.workEx}
                                    onChange={(e) => setFormData({...formData, workEx: e.target.value})}
                                />
                            </div>
                        ) : (
                            <div className="calc-input-group">
                                <label className="calc-label">Home State</label>
                                <select className="calc-select">
                                    <option>Maharashtra</option>
                                    <option>West Bengal</option>
                                    <option>Delhi</option>
                                    <option>Karnataka</option>
                                    <option>Other</option>
                                </select>
                            </div>
                        )}
                    </div>

                    <div className="p-4 rounded-xl bg-blue-50 border border-blue-100 flex gap-3 text-sm text-blue-700">
                        <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                        <p>Analysing <strong>Truth-Grade</strong> data from official registries.</p>
                    </div>
                </div>
            )}

            {/* Step 3: Loading */}
            {step === 3 && (
                <div className="calculator-card calc-loading">
                    <div className="calc-loading-spinner" />
                    <h2 className="calculator-card-title">Analyzing Official Registries...</h2>
                    <p className="calculator-card-subtitle">Cross-referencing {formData.exam} trends for your profile.</p>
                </div>
            )}

            {/* Step 4: Results */}
            {step === 4 && results && (
                <div className="animate-in fade-in slide-in-from-bottom-8 duration-700">
                    <div className="results-header">
                        <div className="results-title">
                            <h2>Strategic Admission Roadmap</h2>
                            <p className="results-meta">{formData.exam} · {results.meta.sourceYear} Cycle</p>
                        </div>
                        <button className="calc-btn-back" onClick={restart} style={{ padding: '8px 16px', fontSize: '0.8rem' }}>
                            <RotateCcw size={14} className="mr-2 inline" /> New Analysis
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
                        <div className="lg:col-span-1 p-6 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col justify-center items-center text-center">
                            <Trophy className="w-10 h-10 text-yellow-500 mb-4" />
                            <h4 className="font-bold text-slate-800 uppercase tracking-widest text-xs mb-1">Truth-Score</h4>
                            <div className="text-4xl font-black text-blue-600 mb-2">{results.meta.dataIntegrityScore}%</div>
                            <p className="text-xs text-slate-500 max-w-[150px]">Algorithm Confidence for {formData.exam}</p>
                        </div>
                        <div className="lg:col-span-2 p-6 rounded-3xl bg-white border border-slate-200 shadow-sm h-[200px]">
                             <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={computeRadarData(results)}>
                                    <PolarGrid stroke="#e2e8f0" />
                                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748b', fontSize: 10, fontWeight: 700 }} />
                                    <Radar name="Strategy" dataKey="value" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="space-y-12">
                        {results.safe.length === 0 && results.target.length === 0 && results.dream.length === 0 ? (
                            <div className="p-12 text-center rounded-3xl bg-slate-50 border border-dashed border-slate-300">
                                <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                                <h3 className="text-xl font-bold text-slate-700">No Direct Matches Found</h3>
                                <p className="text-slate-500 max-w-md mx-auto mt-2 mb-6">
                                    Our "Truth-Grade" engine couldn't find matches for this specific combination of score, category, and quota. 
                                </p>
                                <div className="flex flex-wrap justify-center gap-4">
                                    <button onClick={() => setStep(0)} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
                                        Try Different Exam/Score
                                    </button>
                                    <button onClick={() => setStep(1)} className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
                                        Change Category/Quota
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {results.safe.length > 0 && (
                                    <div className="tier-section tier-safe">
                                        <div className="tier-label">
                                            <ShieldCheck className="w-5 h-5 text-green-500" />
                                            <h3>Safe Options</h3>
                                        </div>
                                        <div className="results-grid">
                                            {results.safe.map((rec, i) => <ResultCard key={i} rec={rec} rank={i+1} />)}
                                        </div>
                                    </div>
                                )}

                                {results.target.length > 0 && (
                                    <div className="tier-section tier-target">
                                        <div className="tier-label">
                                            <Target className="w-5 h-5 text-yellow-500" />
                                            <h3>Target Reach</h3>
                                        </div>
                                        <div className="results-grid">
                                            {results.target.map((rec, i) => <ResultCard key={i} rec={rec} rank={i+1} />)}
                                        </div>
                                    </div>
                                )}

                                {results.dream.length > 0 && (
                                    <div className="tier-section tier-dream">
                                        <div className="tier-label">
                                            <Sparkles className="w-5 h-5 text-purple-500" />
                                            <h3>Dream Targets</h3>
                                        </div>
                                        <div className="results-grid">
                                            {results.dream.map((rec, i) => <ResultCard key={i} rec={rec} rank={i+1} />)}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Navigation */}
            {step < 3 && (
                <div className="calc-nav">
                    {step > 0 && (
                        <button className="calc-btn-back" onClick={() => setStep(s => s - 1)}>
                            <ChevronLeft className="w-5 h-5 mr-2 inline" /> Back
                        </button>
                    )}
                    <button 
                        className="calc-btn-next" 
                        onClick={handleNext}
                        disabled={!canNext()}
                    >
                        {step === 2 ? "Run AI Predictor" : "Continue"}
                        <ChevronRight className="w-5 h-5 ml-2 inline" />
                    </button>
                </div>
            )}
        </div>
    );
};

export default AdmissionCalculator;
