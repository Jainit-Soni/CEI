'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    Search, Target, Shield, AlertTriangle, Info, Zap,
    ChevronRight, ArrowRight, Activity, MapPin,
    FileText, Lightbulb, XOctagon, CheckCircle2,
    Filter, Star, User, ChevronLeft, Loader2,
    Layers, ArrowUpRight, BarChart3, Plus, X,
    ChevronDown, ChevronUp, Download, Share2
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchCollege, api } from '@/lib/api';
import './UnifiedPredictorDashboard.css';

/**
 * CEI ADMISSION STRATEGY FLOW
 * A premium, deterministic discovery system.
 */

// --- HELPERS ---

function isRoutableCollegeId(id) {
    if (!id || typeof id !== "string") return false;
    return (
        id.startsWith("CORE-") ||
        /^C-\d+/i.test(id) ||
        id.startsWith("aicte:") ||
        id.startsWith("college:") ||
        /^[U|C]-\d+$/.test(id)
    );
}

function getCanonicalCollegeId(item) {
    if (!item) return null;
    const candidates = [
        item.parent_core_id,
        item.core_id,
        item.institution_id,
        item.college_id,
        item.collegeId,
        item.id
    ];
    for (const id of candidates) {
        if (isRoutableCollegeId(id)) return id;
    }
    return null;
}

function buildCollegeName(item, cache = {}) {
    const id = getCanonicalCollegeId(item) || item.medical_entity_id;
    return (
        cache[id]?.name ||
        item.institution_name ||
        item.institute_name ||
        item.college_name ||
        item.medical_institution_name ||
        item.name ||
        null
    );
}

function buildLocationLabel(college) {
    if (!college) return null;
    const label = college.locationLabel || college.location_label || college.displayLocation || college.display_location;
    if (label && typeof label === 'string') return label;
    const city = college.city || college.district || college.location?.city || college.location?.district || college.address?.city || college.address?.district || null;
    const state = college.state || college.state_name || college.location?.state || college.location?.state_name || college.address?.state || college.address?.state_name || null;
    if (city && state) return `${city}, ${state}`;
    if (city) return city;
    if (state) return state;
    return null;
}

function getCollegeLocationLabel(item, cache = {}) {
    const id = getCanonicalCollegeId(item) || item.medical_entity_id;
    const cached = cache[id]?.locationLabel;
    if (cached) return cached;
    return buildLocationLabel(item);
}

// --- SUB-COMPONENTS (Moved outside to prevent re-render issues) ---

const Hero = ({ onStartWizard }) => (
    <motion.div 
        className="hero-section"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
    >
        <div className="hero-tag">
            <Shield size={14} /> Official Intelligence
        </div>
        <h1 className="hero-title">
            Know what is <span className="serif-accent">real</span>, risky, and worth chasing.
        </h1>
        <p className="hero-sub">
            CEI separates safe, realistic, and risky admission paths using official cutoff data and deterministic college identity.
        </p>
        <button className="hero-cta" onClick={onStartWizard}>
            Show My Strategy <ArrowRight size={20} style={{ marginLeft: 8, display: 'inline' }} />
        </button>
    </motion.div>
);

const Wizard = ({ 
    wizardStep, setWizardStep, 
    domain, setDomain, 
    rank, setRank, 
    category, setCategory, 
    quota, setQuota, 
    gender, setGender,
    onBack, onPredict,
    setViewState
}) => {
    const renderStep = () => {
        switch(wizardStep) {
            case 1:
                return (
                    <div className="wizard-step">
                        <h2 className="wizard-step-title">Choose your domain</h2>
                        <div className="options-grid">
                            <button className={`option-btn ${domain === 'engineering' ? 'active' : ''}`} onClick={() => setDomain('engineering')}>
                                <span className="option-label">Engineering</span>
                                <span className="option-sub">JEE Main, JoSAA, CSAB</span>
                            </button>
                            <button className={`option-btn ${domain === 'medical' ? 'active' : ''}`} onClick={() => setDomain('medical')}>
                                <span className="option-label">Medical</span>
                                <span className="option-sub">NEET UG, MCC, State</span>
                            </button>
                        </div>
                    </div>
                );
            case 2:
                return (
                    <div className="wizard-step">
                        <h2 className="wizard-step-title">What is your {domain === 'engineering' ? 'CRL' : 'NEET'} rank?</h2>
                        <div className="rank-input-container">
                            <input 
                                autoFocus
                                type="number" 
                                className="rank-input" 
                                placeholder="e.g. 45000"
                                value={rank}
                                onChange={(e) => setRank(e.target.value)}
                            />
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div className="wizard-step">
                        <h2 className="wizard-step-title">Select your category</h2>
                        <div className="pill-grid" style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
                            {['OPEN', 'OBC-NCL', 'SC', 'ST', 'EWS'].map(cat => (
                                <button key={cat} className={`option-btn ${category === cat ? 'active' : ''}`} onClick={() => setCategory(cat)} style={{ padding: '12px 24px', textAlign: 'center' }}>
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>
                );
            case 4:
                return (
                    <div className="wizard-step">
                        <h2 className="wizard-step-title">Quota & Details</h2>
                        {domain === 'engineering' ? (
                            <div className="options-grid">
                                <button className={`option-btn ${quota === 'AI' ? 'active' : ''}`} onClick={() => setQuota('AI')}><span className="option-label">All India</span></button>
                                <button className={`option-btn ${quota === 'HS' ? 'active' : ''}`} onClick={() => setQuota('HS')}><span className="option-label">Home State</span></button>
                                <button className={`option-btn ${gender === 'GENDER_NEUTRAL' ? 'active' : ''}`} onClick={() => setGender('GENDER_NEUTRAL')}><span className="option-label">Neutral</span></button>
                                <button className={`option-btn ${gender === 'FEMALE_ONLY' ? 'active' : ''}`} onClick={() => setGender('FEMALE_ONLY')}><span className="option-label">Female Only</span></button>
                            </div>
                        ) : (
                            <div className="options-grid">
                                <button className={`option-btn ${quota === 'AI' ? 'active' : ''}`} onClick={() => setQuota('AI')}><span className="option-label">All India</span></button>
                                <button className={`option-btn ${quota === 'Deemed/Paid Seats Quota' ? 'active' : ''}`} onClick={() => setQuota('Deemed/Paid Seats Quota')}><span className="option-label">Deemed</span></button>
                            </div>
                        )}
                    </div>
                );
            default: return null;
        }
    };

    return (
        <motion.div className="wizard-card" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
            <div className="wizard-progress">
                {[1, 2, 3, 4].map(s => <div key={s} className={`progress-step ${s <= wizardStep ? 'active' : ''}`} />)}
            </div>
            {renderStep()}
            <div className="wizard-footer">
                <button className="back-btn" onClick={() => wizardStep === 1 ? setViewState('hero') : setWizardStep(s => s - 1)}>
                    <ChevronLeft size={18} /> Back
                </button>
                {wizardStep < 4 ? (
                    <button className="next-btn" disabled={wizardStep === 2 && !rank} onClick={() => setWizardStep(s => s + 1)}>Continue</button>
                ) : (
                    <button className="next-btn" onClick={onPredict}>Generate Strategy</button>
                )}
            </div>
        </motion.div>
    );
};

const LoadingTransition = ({ loadingStep }) => (
    <div className="loading-view">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }} style={{ margin: '0 auto', width: 48, height: 48 }}>
            <Zap size={48} color="var(--color-accent)" fill="var(--color-accent)" />
        </motion.div>
        <h2 className="verdict-title" style={{ marginTop: 24 }}>Analyzing your path...</h2>
        <div className="loading-steps">
            {["Reading official cutoff windows...", "Checking rank against closing patterns...", "Applying category and quota rules...", "Separating admission bands...", "Finalizing strategy..."].map((text, i) => (
                <div key={i} className={`loading-step ${i <= loadingStep ? 'active' : ''}`}>
                    <div className="step-dot" />
                    <span className="step-text">{text}</span>
                </div>
            ))}
        </div>
    </div>
);

const Verdict = ({ results }) => {
    const riskProfile = results?.journey?.current_state?.risk_profile || 'REALISTIC';
    const profileMap = {
        SAFE: { label: 'Strong Position', class: 'safe', desc: 'You are in a strong position. Focus on quality choices, not random backups.' },
        REALISTIC: { label: 'Competitive', class: 'realistic', desc: 'You have real options, but strategy matters now.' },
        RISKY: { label: 'Strategic Caution', class: 'risky', desc: 'This is a risky zone. Build backups before chasing stretch options.' }
    };
    const p = profileMap[riskProfile] || profileMap.REALISTIC;
    const meterPos = riskProfile === 'SAFE' ? 20 : riskProfile === 'REALISTIC' ? 50 : 80;

    return (
        <div className="verdict-header">
            <div className={`verdict-badge ${p.class}`}>{p.label}</div>
            <h1 className="verdict-title">{p.desc}</h1>
            <div className="admission-meter">
                <div className="meter-fill" style={{ width: '100%' }} />
                <div className="meter-pointer" style={{ left: `${meterPos}%` }} />
            </div>
            <p className="verdict-desc">{results?.journey?.current_state?.rank_context || "Your strategy is generated based on official cutoff history."}</p>
        </div>
    );
};

const Strategy = () => (
    <div className="strategy-grid">
        <div className="strategy-box do">
            <div className="box-title do"><CheckCircle2 size={16} /> WHAT YOU SHOULD DO</div>
            <ul className="strategy-list">
                <li className="strategy-item"><ArrowUpRight size={14} /> Prioritize realistic options first in your choice list.</li>
                <li className="strategy-item"><ArrowUpRight size={14} /> Keep at least 2 safe backups active from the Safe band.</li>
                <li className="strategy-item"><ArrowUpRight size={14} /> Use risky options only after locking safer choices.</li>
            </ul>
        </div>
        <div className="strategy-box avoid">
            <div className="box-title avoid"><XOctagon size={16} /> WHAT TO AVOID</div>
            <ul className="strategy-list">
                <li className="strategy-item"><X size={14} /> Do not chase only high-closing-rank colleges.</li>
                <li className="strategy-item"><X size={14} /> Do not ignore quota/category differences.</li>
                <li className="strategy-item"><X size={14} /> Do not treat one round as a guarantee.</li>
            </ul>
        </div>
    </div>
);

const DecisionStrip = ({ item, collegeMetaCache, toggleCompare, compareList, router }) => {
    const id = getCanonicalCollegeId(item);
    const name = buildCollegeName(item, collegeMetaCache) || (id ? "Loading..." : null);
    if (!name && !id) return null;
    const location = getCollegeLocationLabel(item, collegeMetaCache);
    const branch = item.program_type || item.branch_name || item.program_title || null;
    const closingRank = item.stats?.p50 || item.looseBoundary || item.closing_rank;
    const roundText = item.earliestRound && item.latestRound ? `Round ${item.earliestRound}–${item.latestRound}` : "Likely Rounds 2–3";

    return (
        <motion.div className={`decision-strip ${!id ? 'unroutable' : ''}`} onClick={() => id && router.push(`/college/${id}`)} layout>
            <div className="strip-main">
                <div className="strip-left">
                    <div className="inst-name">{name}</div>
                    <div className="prog-info">{branch} {location ? `• ${location}` : ''}</div>
                </div>
                <div className="strip-right">
                    <div className="rank-label">Closing Rank</div>
                    <div className="closing-rank">{closingRank?.toLocaleString() || '—'}</div>
                </div>
            </div>
            <div className="rank-cue-container">
                <div className="rank-cue-zone" style={{ left: '40%', width: '30%' }} />
                <div className="rank-marker" style={{ left: '45%' }}><div className="rank-marker-label">YOU</div></div>
            </div>
            <div className="strip-footer">
                <div className="meta-badges">
                    <span className="meta-badge">{roundText}</span>
                    {item.quota && <span className="meta-badge">{item.quota}</span>}
                </div>
                <div className="action-btns">
                    <button className="action-btn" onClick={(e) => { e.stopPropagation(); toggleCompare(id); }}>
                        {compareList.includes(id) ? <CheckCircle2 size={14} /> : <Plus size={14} />} Compare
                    </button>
                    <button className="action-btn">View Details <ArrowUpRight size={14} /></button>
                </div>
            </div>
        </motion.div>
    );
};

const Results = ({ results, activeBand, setActiveBand, collegeMetaCache, toggleCompare, compareList, router, setShowFilters }) => {
    const bandKey = activeBand.toLowerCase();
    const bandItems = results?.decisionSignals?.[bandKey] || [];
    return (
        <div className="results-section">
            <div className="results-toolbar">
                <div className="band-tabs">
                    {['SAFE', 'REALISTIC', 'RISKY'].map(b => (
                        <button key={b} className={`band-tab ${activeBand === b ? `active ${b.toLowerCase()}` : ''}`} onClick={() => setActiveBand(b)}>
                            {b} ({results?.decisionSignals?.[b.toLowerCase()]?.length || 0})
                        </button>
                    ))}
                </div>
                <button className="action-btn" onClick={() => setShowFilters(true)}><Filter size={16} /> Refine</button>
            </div>
            <div className="strips-container">
                {bandItems.length > 0 ? bandItems.slice(0, 10).map((item, idx) => (
                    <DecisionStrip key={idx} item={item} collegeMetaCache={collegeMetaCache} toggleCompare={toggleCompare} compareList={compareList} router={router} />
                )) : (
                    <div className="empty-results"><Info size={40} style={{ opacity: 0.2, marginBottom: 16 }} /><p>No results found for this band with your current filters.</p></div>
                )}
            </div>
            {bandItems.length > 10 && (
                <button className="hero-cta" style={{ width: '100%', marginTop: 24, background: 'transparent', color: 'var(--color-accent)', border: '1px solid var(--color-border)', boxShadow: 'none' }}>
                    Explore All {bandItems.length} Options
                </button>
            )}
        </div>
    );
};

const CompareTray = ({ compareList, collegeMetaCache, toggleCompare, router }) => {
    if (compareList.length === 0) return null;
    return (
        <motion.div className="compare-tray" initial={{ y: 100 }} animate={{ y: 0 }}>
            <div className="compare-count"><BarChart3 size={16} style={{ display: 'inline', marginRight: 8 }} />{compareList.length} / 3 Colleges Selected</div>
            <div style={{ display: 'flex', gap: 8 }}>
                {compareList.map(id => (
                    <div key={id} className="meta-badge" style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none' }}>
                        {collegeMetaCache[id]?.name?.substring(0, 10) || '...'}
                        <X size={12} style={{ marginLeft: 6, cursor: 'pointer' }} onClick={() => toggleCompare(id)} />
                    </div>
                ))}
            </div>
            <button className="compare-launch" onClick={() => router.push(`/compare?ids=${compareList.join(',')}`)}>Compare Now</button>
        </motion.div>
    );
};

const WhyThisResultDrawer = ({ isOpen, onClose, domain }) => {
    if (!isOpen) return null;
    return (
        <motion.div className="drawer-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose}>
            <motion.div className="drawer-content" initial={{ y: "100%" }} animate={{ y: 0 }} onClick={e => e.stopPropagation()}>
                <div className="drawer-header"><h2 className="drawer-title">Admission Intelligence Basis</h2><button className="drawer-close" onClick={onClose}><X size={20} /></button></div>
                <div className="drawer-body">
                    <section className="drawer-section"><span className="section-tag">Data Source</span><p className="section-body">This prediction is based on official 2024 cutoff data released by {domain === 'engineering' ? ' JoSAA (Joint Seat Allocation Authority)' : ' MCC (Medical Counselling Committee)'}.</p></section>
                    <section className="drawer-section"><span className="section-tag">Methodology</span><p className="section-body">We map your rank against historical closing boundaries across all rounds. The bands represent the statistical probability of your rank falling within the admission window of previous years.</p></section>
                    <section className="strategy-box do" style={{ background: 'var(--color-bg-subtle)' }}>
                        <div className="flex gap-3"><Shield className="text-accent" size={20} style={{ color: 'var(--color-accent)' }} /><div><h4 className="font-bold text-sm">Deterministic Identity</h4><p className="text-xs text-ink-muted">All colleges are linked via unique institutional IDs to prevent fuzzy matching errors.</p></div></div>
                    </section>
                </div>
            </motion.div>
        </motion.div>
    );
};

// --- MAIN COMPONENT ---

const UnifiedPredictorDashboard = () => {
    const router = useRouter();
    const [viewState, setViewState] = useState('hero');
    const [wizardStep, setWizardStep] = useState(1);
    const [domain, setDomain] = useState('engineering');
    const [rank, setRank] = useState('');
    const [category, setCategory] = useState('OPEN');
    const [quota, setQuota] = useState('AI');
    const [gender, setGender] = useState('GENDER_NEUTRAL');
    const [statePref, setStatePref] = useState('All');
    const [loading, setLoading] = useState(false);
    const [loadingStep, setLoadingStep] = useState(0);
    const [results, setResults] = useState(null);
    const [activeBand, setActiveBand] = useState('REALISTIC');
    const [compareList, setCompareList] = useState([]);
    const [showFilters, setShowFilters] = useState(false);
    const [collegeMetaCache, setCollegeMetaCache] = useState({});
    const [hydratingIds, setHydratingIds] = useState(new Set());
    const [showEvidence, setShowEvidence] = useState(false);

    useEffect(() => {
        if (!results?.decisionSignals) return;
        const signals = results.decisionSignals;
        const allItems = [...(signals.safe || []), ...(signals.realistic || []), ...(signals.risky || [])];
        const missingIds = new Set();
        allItems.forEach(item => {
            const id = getCanonicalCollegeId(item);
            if (id && !collegeMetaCache[id] && !hydratingIds.has(id)) missingIds.add(id);
        });
        if (missingIds.size > 0) hydrateBatch(Array.from(missingIds));
    }, [results, activeBand]);

    const hydrateBatch = async (ids) => {
        const batch = ids.slice(0, 10);
        setHydratingIds(prev => new Set([...prev, ...batch]));
        try {
            await Promise.all(batch.map(async (id) => {
                try {
                    const data = await fetchCollege(id);
                    if (data) setCollegeMetaCache(prev => ({ ...prev, [id]: { name: data.name, locationLabel: buildLocationLabel(data) } }));
                } catch (err) {
                    console.error(`Failed to hydrate ${id}`, err);
                    setCollegeMetaCache(prev => ({ ...prev, [id]: { name: null, locationLabel: null } }));
                }
            }));
        } finally {
            setHydratingIds(prev => {
                const next = new Set(prev);
                batch.forEach(id => next.delete(id));
                return next;
            });
        }
    };

    const startWizard = () => setViewState('wizard');
    
    const handlePredict = async () => {
        if (!rank || isNaN(rank)) return;
        setViewState('loading');
        setLoading(true);
        const steps = ["Reading official cutoff windows...", "Checking rank against closing patterns...", "Applying category and quota rules...", "Separating admission bands...", "Finalizing strategy..."];
        for (let i = 0; i < steps.length; i++) {
            setLoadingStep(i);
            await new Promise(r => setTimeout(r, 600));
        }
        try {
            let response;
            if (domain === 'engineering') {
                response = await api.get(`/api/predict/engineering-v2`, { params: { rank, category, quota, genderPool: gender, authority: 'JOSAA' } });
            } else {
                response = await api.get(`/api/medical/predict`, { params: { rank, category, quota: quota === 'AI' ? 'All India' : quota, programType: 'MBBS', state: statePref } });
            }
            const journeyRes = await api.post(`/api/journey`, { domain, rank, category, quota, predictionResult: response.data });
            setResults({ ...response.data, journey: journeyRes.data });
            if (response.data.decisionSignals.safe?.length > 0) setActiveBand('SAFE');
            else if (response.data.decisionSignals.realistic?.length > 0) setActiveBand('REALISTIC');
            else setActiveBand('RISKY');
            setViewState('results');
        } catch (err) {
            console.error(err);
            setViewState('wizard');
            alert("Analysis failed. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const toggleCompare = (id) => {
        setCompareList(prev => {
            if (prev.includes(id)) return prev.filter(i => i !== id);
            if (prev.length >= 3) return prev;
            return [...prev, id];
        });
    };

    return (
        <div className="predictor-root">
            {/* CHROMATIC BANDS BACKGROUND */}
            <div className="chromatic-bands">
                <div className="chromatic-band-3" />
                <div className="chromatic-band-4" />
            </div>

            <div className="strategy-container">
                <AnimatePresence mode="wait">
                    {viewState === 'hero' && <Hero key="hero" onStartWizard={startWizard} />}
                    {viewState === 'wizard' && (
                        <Wizard 
                            key="wizard" 
                            wizardStep={wizardStep} setWizardStep={setWizardStep}
                            domain={domain} setDomain={setDomain}
                            rank={rank} setRank={setRank}
                            category={category} setCategory={setCategory}
                            quota={quota} setQuota={setQuota}
                            gender={gender} setGender={setGender}
                            onBack={() => wizardStep === 1 ? setViewState('hero') : setWizardStep(s => s - 1)}
                            onPredict={handlePredict}
                            setViewState={setViewState}
                        />
                    )}
                    {viewState === 'loading' && <LoadingTransition key="loading" loadingStep={loadingStep} />}
                    {viewState === 'results' && (
                        <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <Verdict results={results} />
                            <Strategy />
                            <Results 
                                results={results} 
                                activeBand={activeBand} setActiveBand={setActiveBand} 
                                collegeMetaCache={collegeMetaCache} 
                                toggleCompare={toggleCompare} compareList={compareList}
                                router={router} setShowFilters={setShowFilters}
                            />
                            <CompareTray compareList={compareList} collegeMetaCache={collegeMetaCache} toggleCompare={toggleCompare} router={router} />
                            
                            <div style={{ marginTop: 80, padding: 40, background: 'var(--color-bg-subtle)', borderRadius: 24, textAlign: 'center', position: 'relative', zIndex: 5 }}>
                                <Info size={24} style={{ color: 'var(--color-accent)', marginBottom: 16 }} />
                                <h3 style={{ fontWeight: 800 }}>Why this result?</h3>
                                <p style={{ color: 'var(--color-ink-muted)', fontSize: '0.9rem', maxWidth: 500, margin: '12px auto' }}>
                                    This strategy uses 2024 official cutoff history from {domain === 'engineering' ? 'JoSAA' : 'MCC'}. 
                                    Determinism is maintained through verified institutional IDs.
                                </p>
                                <button className="action-btn" style={{ margin: '0 auto' }} onClick={() => setShowEvidence(true)}>
                                    View Decision Signals <ArrowRight size={14} />
                                </button>
                            </div>
                            
                            <WhyThisResultDrawer isOpen={showEvidence} onClose={() => setShowEvidence(false)} domain={domain} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default UnifiedPredictorDashboard;
