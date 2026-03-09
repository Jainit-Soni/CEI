import { useState, useEffect } from "react";
import Container from "@/components/Container";
import GlassPanel from "@/components/GlassPanel";
import Button from "@/components/Button";
import Link from "next/link";
import { ShieldCheck, BarChart4, Scaling, Activity, Building, Award, Star, TrendingUp, Zap, Info, Database, Workflow, Cpu, Layers } from "lucide-react";
import "./page.css";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");

const VECTOR_ICONS = {
    A: <Award size={18} />,
    F: <Activity size={18} />,
    I: <Building size={18} />,
    S: <Scaling size={18} />,
    D: <Star size={18} />,
    P: <Zap size={18} />,
};

const VECTOR_NAMES = {
    A: "Academic Excellence",
    F: "Institutional Age",
    I: "Infrastructure Quality",
    S: "Program Breadth",
    D: "Entrance Standards",
    P: "Placement Outcomes",
};

export default function MethodologyPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeStep, setActiveStep] = useState(0);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch(`${API_URL}/api/transparency/methodology?_t=${Date.now()}`);
                if (res.ok) {
                    const json = await res.json();
                    setData(json.methodology);
                }
            } catch (err) {
                console.error("Methodology fetch failed", err);
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const weights = data?.vectors || [
        { code: 'P', weight: 0.35, description: "Direct ROI measurement based on average and median salary packages. The strongest indicator of student success." },
        { code: 'A', weight: 0.25, description: "NIRF performance and Tier 1 accreditation status. Proxies for academic prestige." },
        { code: 'D', weight: 0.15, description: "Selectivity and demand based on entrance exams like CAT, GMAT, and CMAT." },
        { code: 'F', weight: 0.15, description: "Years of operation and stability. Established heritage usually translates to stronger alumni networks." },
        { code: 'S', weight: 0.10, description: "Number of specialized courses and total student capacity. Scale implies versatility." }
    ];

    const bands = data?.bands || {
        Elite: 85, High: 75, Competitive: 55, Moderate: 35, Emerging: 0
    };

    const steps = [
        {
            title: "Data Ingestion",
            icon: <Database className="text-blue-400" />,
            desc: "We pull raw data from the official AISHE database, placement reports, and accreditation boards covering 68,000+ colleges."
        },
        {
            title: "Normalization",
            icon: <Cpu className="text-purple-400" />,
            desc: "Addresses, city names (Bangalore vs Bengaluru), and currency (CPA vs LPA) are standardized using our custom canonical engine."
        },
        {
            title: "Vector Calculation",
            icon: <Workflow className="text-emerald-400" />,
            desc: "Institutions are scored across 6 standardized dimensions (Vectors) to ensure a multi-dimensional perspective."
        },
        {
            title: "Z-Score Percentile",
            icon: <Layers className="text-amber-400" />,
            desc: "Scores are globally normalized. An 87 CEI means the college is in the top tier of all institutions in that category."
        }
    ];

    return (
        <div className="methodology-page">
            <section className="methodology-hero">
                <div className="methodology-bg">
                    <div className="methodology-pulse"></div>
                    <div className="methodology-orb orb-1"></div>
                    <div className="methodology-orb orb-2"></div>
                    <div className="methodology-grid"></div>
                </div>

                <Container>
                    <div className="methodology-hero-content">
                        <div className="flex items-center justify-center mb-6">
                            <span className="methodology-badge">
                                <ShieldCheck size={16} className="mr-2" />
                                Premium Data Standard
                            </span>
                        </div>
                        <h1 className="methodology-title">The Intelligence<br />Behind the Score</h1>
                        <p className="methodology-subtitle">
                            CEI is not a popularity contest. It is a deterministic, math-heavy framework designed to find the real value of an Indian college.
                        </p>
                        {data?.versionId && (
                            <div className="mt-8 inline-flex items-center gap-2 px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs font-mono text-gray-400">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                Live Scoring Version: v{data.versionId}
                            </div>
                        )}
                    </div>
                </Container>
            </section>

            <Container>
                <div className="methodology-layout">
                    {/* Left Side: Algorithm Journey */}
                    <aside className="algo-sidebar">
                        <div className="sticky-box">
                            <h3 className="section-label">Algorithm Journey</h3>
                            <div className="journey-track">
                                {steps.map((s, idx) => (
                                    <div
                                        key={idx}
                                        className={`journey-step ${activeStep === idx ? 'active' : ''}`}
                                        onClick={() => setActiveStep(idx)}
                                    >
                                        <div className="step-icon-wrap">{s.icon}</div>
                                        <div className="step-text">
                                            <h4>{s.title}</h4>
                                            <p>{s.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </aside>

                    {/* Right Side: Main Content */}
                    <main className="algo-main">
                        <section id="vectors" className="main-section mb-16">
                            <h2 className="main-section-title">Standardized Weightage</h2>
                            <p className="main-section-desc">
                                Every college is put through the same strict criteria. We prioritize outcomes over infrastructure.
                            </p>

                            <div className="weight-grid">
                                {weights.sort((a, b) => b.weight - a.weight).map((v) => (
                                    <GlassPanel key={v.code} className="weight-card">
                                        <div className="weight-header">
                                            <div className="weight-icon">{VECTOR_ICONS[v.code]}</div>
                                            <span className="weight-pct">{(v.weight * 100).toFixed(0)}%</span>
                                        </div>
                                        <h4>{VECTOR_NAMES[v.code] || v.code}</h4>
                                        <p>{v.description}</p>
                                    </GlassPanel>
                                ))}
                            </div>
                        </section>

                        <section id="bands" className="main-section mb-16">
                            <h2 className="main-section-title">Performance Tiers</h2>
                            <p className="main-section-desc">
                                We group results into functional bands based on their national percentile.
                            </p>

                            <div className="bands-visual-grid">
                                <div className="band-visual elite">
                                    <div className="band-visual-header">
                                        <Star size={20} className="text-yellow-400" fill="currentColor" />
                                        <span>Elite (Top 5%)</span>
                                        <span className="band-range">{bands.Elite}+</span>
                                    </div>
                                    <p>Premier national institutes. Requires peak performance across all 6 vectors.</p>
                                </div>

                                <div className="band-visual high">
                                    <div className="band-visual-header">
                                        <TrendingUp size={20} className="text-blue-400" />
                                        <span>High Value</span>
                                        <span className="band-range">{bands.High}+</span>
                                    </div>
                                    <p>Institutes with strong ROIs and high admissions standards.</p>
                                </div>

                                <div className="band-visual competitive">
                                    <div className="band-visual-header">
                                        <Zap size={20} className="text-emerald-400" />
                                        <span>Competitive</span>
                                        <span className="band-range">{bands.Competitive}+</span>
                                    </div>
                                    <p>Established colleges with proven track records.</p>
                                </div>
                            </div>
                        </section>

                        <section id="formula" className="main-section formula-callout">
                            <div className="formula-box">
                                <div className="formula-icon"><BarChart4 /></div>
                                <div className="formula-text">
                                    <h3>Total Transparency</h3>
                                    <p>Our formula is open. We don't sell rankings. If an institute improves its placement data or accreditation, the score updates automatically in the next audit cycle.</p>
                                </div>
                            </div>
                        </section>
                    </main>
                </div>

                <div className="text-center mt-20 mb-32">
                    <h2 className="text-2xl font-bold text-white mb-2">Ready to find your match?</h2>
                    <p className="text-gray-400 mb-8">All rankings are based on the latest scoring audit from March 2026.</p>
                    <Button href="/colleges" variant="primary" size="lg">
                        Browse Verified Results →
                    </Button>
                </div>
            </Container>
        </div>
    );
}


