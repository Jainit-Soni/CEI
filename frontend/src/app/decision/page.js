"use client";

/**
 * app/decision/page.js — CEI Student Decision Tool
 * ==================================================
 * 4-step wizard → calls POST /api/decision/recommend → shows top-10 results
 *
 * Steps:
 *   1. Rank       — student's exam rank
 *   2. Preferences— branch, state, college type
 *   3. Budget     — annual tuition budget slider
 *   4. Career Goal— job / research / startup / abroad
 */

import { useState, useCallback } from "react";
import { ChevronRight, ChevronLeft, RotateCcw, Sparkles, Target } from "lucide-react";
import "./decision.css";
import ResultCard from "./ResultCard";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "https://ce-intelligence-backend.vercel.app").replace(/\/$/, "");

const STEP_LABELS = ["Your Rank", "Preferences", "Budget", "Career Goal"];

// Indian states for dropdown
const STATES = [
    "", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka",
    "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram",
    "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu",
    "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
    "Delhi", "Jammu & Kashmir", "Ladakh", "Chandigarh", "Puducherry",
];

const CAREER_GOALS = [
    { key: "job", emoji: "💼", title: "High-Paying Job", desc: "Top companies, campus placements, corporate career" },
    { key: "research", emoji: "🔬", title: "Research & Academia", desc: "PhD, R&D labs, faculty, scientific careers" },
    { key: "startup", emoji: "🚀", title: "Build a Startup", desc: "Entrepreneurship, innovation, product building" },
    { key: "abroad", emoji: "🌏", title: "Study / Work Abroad", desc: "MS/PhD abroad, MNCs, international exposure" },
];

const COLLEGE_TYPES = [
    { key: "either", label: "Any" },
    { key: "government", label: "Government" },
    { key: "private", label: "Private" },
];

const COMMON_BRANCHES = [
    "Computer Science", "Information Technology", "Electronics and Communication",
    "Electrical Engineering", "Mechanical Engineering", "Civil Engineering",
    "Chemical Engineering", "Biotechnology", "Data Science", "Artificial Intelligence",
    "Aerospace Engineering", "MBA / Management", "Arts", "Commerce", "Law", "Medicine", "Architecture",
];

function formatBudget(val) {
    if (val >= 100000) return `₹${(val / 100000).toFixed(1)}L`;
    return `₹${(val / 1000).toFixed(0)}K`;
}

// ── Step Components ──────────────────────────────────────────────────────────

function StepRank({ value, onChange }) {
    return (
        <div>
            <h2 className="decision-card-title">What's your exam rank?</h2>
            <p className="decision-card-subtitle">Enter your JEE, state CET, or any competitive exam rank.</p>
            <div className="decision-input-group">
                <label className="decision-label">Your Rank</label>
                <input
                    className="decision-input"
                    type="number"
                    min={1}
                    max={10000000}
                    placeholder="e.g. 5000"
                    value={value || ""}
                    onChange={e => onChange(parseInt(e.target.value) || "")}
                    autoFocus
                />
            </div>
            {value && (
                <div style={{ background: '#f0f4ff', borderRadius: 12, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.875rem', color: '#4338ca' }}>
                    <Target size={16} />
                    {value <= 5000 ? "Elite range — top IITs, NITs are within reach." :
                        value <= 25000 ? "Strong rank — good NITs and IIITs are achievable." :
                            value <= 100000 ? "Competitive — state colleges and private Tier 1 options." :
                                "Wide options — state and private colleges across India."}
                </div>
            )}
        </div>
    );
}

function StepPreferences({ branch, state, collegeType, onBranch, onState, onType }) {
    const [query, setQuery] = useState(branch);
    const [suggestions, setSuggestions] = useState([]);

    function handleBranchInput(val) {
        setQuery(val);
        onBranch(val);
        if (val.length > 0) {
            const filtered = COMMON_BRANCHES.filter(b => b.toLowerCase().includes(val.toLowerCase())).slice(0, 6);
            setSuggestions(filtered);
        } else {
            setSuggestions([]);
        }
    }

    return (
        <div>
            <h2 className="decision-card-title">Your Preferences</h2>
            <p className="decision-card-subtitle">Tell us what you're looking for.</p>

            {/* Branch */}
            <div className="decision-input-group" style={{ position: 'relative' }}>
                <label className="decision-label">Preferred Branch / Course</label>
                <input
                    className="decision-input"
                    type="text"
                    placeholder="e.g. Computer Science"
                    value={query}
                    onChange={e => handleBranchInput(e.target.value)}
                    autoComplete="off"
                />
                {suggestions.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.08)', zIndex: 10, overflow: 'hidden' }}>
                        {suggestions.map(s => (
                            <div key={s}
                                style={{ padding: '10px 16px', cursor: 'pointer', fontSize: '0.9rem', color: '#374151' }}
                                onMouseDown={() => { setQuery(s); onBranch(s); setSuggestions([]); }}
                                onMouseEnter={e => e.target.style.background = '#f8fafc'}
                                onMouseLeave={e => e.target.style.background = 'white'}
                            >{s}</div>
                        ))}
                    </div>
                )}
            </div>

            {/* State */}
            <div className="decision-input-group">
                <label className="decision-label">Preferred State <span style={{ color: '#94a3b8', fontWeight: 400 }}>(optional)</span></label>
                <select className="decision-input decision-select" value={state} onChange={e => onState(e.target.value)}>
                    <option value="">Any state in India</option>
                    {STATES.filter(Boolean).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>

            {/* College Type */}
            <div className="decision-input-group">
                <label className="decision-label">College Type</label>
                <div className="decision-type-row">
                    {COLLEGE_TYPES.map(t => (
                        <button key={t.key}
                            className={`decision-type-btn ${collegeType === t.key ? 'selected' : ''}`}
                            onClick={() => onType(t.key)}
                        >{t.label}</button>
                    ))}
                </div>
            </div>
        </div>
    );
}

function StepBudget({ value, onChange }) {
    const MIN = 50000;
    const MAX = 2000000;
    const budget = value || 300000;

    function handleSlider(e) {
        onChange(parseInt(e.target.value));
    }

    return (
        <div>
            <h2 className="decision-card-title">Annual Tuition Budget</h2>
            <p className="decision-card-subtitle">Set your maximum yearly fee (tuition only, not hostel/food).</p>

            <div className="decision-budget-display" style={{ margin: '32px 0 24px' }}>
                <div className="decision-budget-amount">{formatBudget(budget)}</div>
                <div className="decision-budget-label">per year</div>
            </div>

            <input
                type="range"
                className="decision-slider"
                min={MIN}
                max={MAX}
                step={10000}
                value={budget}
                onChange={handleSlider}
            />
            <div className="decision-slider-range">
                <span>₹50K (Free / Govt)</span>
                <span>₹20L (Premium Private)</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 24 }}>
                {[
                    { label: 'Government', val: 80000, hint: '₹80K/yr' },
                    { label: 'NIT/IIIT', val: 200000, hint: '₹2L/yr' },
                    { label: 'Top Private', val: 500000, hint: '₹5L/yr' },
                ].map(preset => (
                    <button key={preset.label}
                        onClick={() => onChange(preset.val)}
                        style={{
                            border: budget === preset.val ? '2px solid #4f46e5' : '1.5px solid #e2e8f0',
                            background: budget === preset.val ? '#eef2ff' : '#f8fafc',
                            color: budget === preset.val ? '#4f46e5' : '#64748b',
                            borderRadius: 12, padding: '10px 8px', cursor: 'pointer',
                            fontSize: '0.8125rem', fontFamily: 'Inter, sans-serif', fontWeight: 600,
                        }}
                    >
                        <div>{preset.label}</div>
                        <div style={{ fontWeight: 400, fontSize: '0.75rem', marginTop: 2 }}>{preset.hint}</div>
                    </button>
                ))}
            </div>
        </div>
    );
}

function StepCareerGoal({ value, onChange }) {
    return (
        <div>
            <h2 className="decision-card-title">What's your career goal?</h2>
            <p className="decision-card-subtitle">This helps us prioritize placement records and alumni networks.</p>
            <div className="decision-goal-grid" style={{ marginTop: 4 }}>
                {CAREER_GOALS.map(g => (
                    <div
                        key={g.key}
                        className={`decision-goal-card ${value === g.key ? 'selected' : ''}`}
                        onClick={() => onChange(g.key)}
                    >
                        <span className="decision-goal-emoji">{g.emoji}</span>
                        <p className="decision-goal-title">{g.title}</p>
                        <p className="decision-goal-desc">{g.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DecisionPage() {
    const [step, setStep] = useState(0); // 0-3 = wizard, 4 = loading, 5 = results

    // Form state
    const [rank, setRank] = useState("");
    const [branch, setBranch] = useState("");
    const [state, setState] = useState("");
    const [collegeType, setCollegeType] = useState("either");
    const [budget, setBudget] = useState(300000);
    const [careerGoal, setCareerGoal] = useState("job");

    // Result state
    const [results, setResults] = useState(null);
    const [error, setError] = useState("");
    const [perfMs, setPerfMs] = useState(null);

    const canNext = () => {
        if (step === 0) return rank && Number(rank) > 0;
        if (step === 1) return branch.trim().length >= 2;
        if (step === 2) return budget >= 50000;
        if (step === 3) return !!careerGoal;
        return false;
    };

    const submit = useCallback(async () => {
        setStep(4); // loading
        setError("");
        try {
            const start = Date.now();
            const res = await fetch(`${API_BASE}/api/decision/recommend`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    rank: Number(rank),
                    budgetPerYear: budget,
                    preferredBranch: branch.trim(),
                    preferredState: state || undefined,
                    collegeType,
                    careerGoal,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Engine error');
            setResults(data);
            setPerfMs(Date.now() - start);
            setStep(5);
        } catch (err) {
            setError(err.message);
            setStep(3);
        }
    }, [rank, budget, branch, state, collegeType, careerGoal]);

    function handleNext() {
        if (step === 3) { submit(); return; }
        setStep(s => s + 1);
    }

    function restart() {
        setStep(0);
        setResults(null);
        setError("");
        setRank("");
        setBranch("");
        setState("");
        setCollegeType("either");
        setBudget(300000);
        setCareerGoal("job");
    }

    return (
        <main className="decision-page">
            {/* Hero */}
            <div className="decision-hero">
                <div className="decision-hero-badge">
                    <Sparkles size={12} /> AI-Powered
                </div>
                <h1>Find Your <span>Perfect College</span></h1>
                <p>CEI's decision engine scores 68,000+ colleges against your profile and returns your best matches — with reasons.</p>
            </div>

            <div className="decision-wizard-container">

                {/* ── Step Indicator (only wizard steps) ── */}
                {step < 4 && (
                    <div className="decision-steps-row">
                        {STEP_LABELS.map((label, i) => (
                            <div key={i} className="decision-step-item">
                                <div className={`decision-step-dot ${i === step ? 'active' : i < step ? 'done' : 'pending'}`}>
                                    {i < step ? '✓' : i + 1}
                                </div>
                                <span className={`decision-step-label ${i === step ? 'active' : i < step ? 'done' : ''}`}>
                                    {label}
                                </span>
                            </div>
                        ))}
                    </div>
                )}

                {/* ── Loading ── */}
                {step === 4 && (
                    <div className="decision-card decision-loading">
                        <div className="decision-loading-ring" />
                        <h3>Analysing 68,000+ colleges…</h3>
                        <p>Scoring CEI data, placement records, rank probability, and budget fit for your profile.</p>
                    </div>
                )}

                {/* ── Results ── */}
                {step === 5 && results && (
                    <div>
                        <div className="decision-results-header">
                            <h2>Your Top {results.recommendations?.length} Matches</h2>
                            <p className="decision-results-meta">
                                From {results.meta?.totalEligible?.toLocaleString('en-IN')} eligible colleges · {perfMs}ms
                                {results.source === 'cache' && ' · from cache'}
                            </p>
                        </div>
                        {error && <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>}
                        {results.recommendations?.length === 0 ? (
                            <div className="decision-empty">
                                <div style={{ fontSize: '3rem' }}>🎓</div>
                                <h3>No matches found</h3>
                                <p>Try relaxing your budget or state filter.</p>
                            </div>
                        ) : (
                            <div className="decision-results-grid">
                                {results.recommendations.map((rec, i) => (
                                    <ResultCard key={rec.collegeId || i} rec={rec} rank={i + 1} />
                                ))}
                            </div>
                        )}
                        <div className="decision-restart-row">
                            <button className="decision-btn-restart" onClick={restart}>
                                <RotateCcw size={14} /> Refine My Search
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Wizard Card ── */}
                {step < 4 && (
                    <div className="decision-card">
                        {step === 0 && <StepRank value={rank} onChange={setRank} />}
                        {step === 1 && <StepPreferences branch={branch} state={state} collegeType={collegeType} onBranch={setBranch} onState={setState} onType={setCollegeType} />}
                        {step === 2 && <StepBudget value={budget} onChange={setBudget} />}
                        {step === 3 && <StepCareerGoal value={careerGoal} onChange={setCareerGoal} />}

                        {error && (
                            <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: 10, marginTop: 16, fontSize: '0.875rem' }}>
                                {error}
                            </div>
                        )}

                        <div className="decision-nav">
                            {step > 0 ? (
                                <button className="decision-btn-back" onClick={() => setStep(s => s - 1)}>
                                    <ChevronLeft size={16} /> Back
                                </button>
                            ) : <div />}
                            <button
                                className="decision-btn-next"
                                onClick={handleNext}
                                disabled={!canNext()}
                            >
                                {step === 3 ? <><Sparkles size={16} /> Find My Colleges</> : <>Next <ChevronRight size={16} /></>}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
