"use client";

import { useState, useEffect } from "react";
import Container from "@/components/Container";
import GlassPanel from "@/components/GlassPanel";
import Button from "@/components/Button";
import Link from "next/link";
import { ShieldCheck, BarChart4, Scaling, Activity, Building, Award, Star, TrendingUp, Zap, Info } from "lucide-react";
import "./page.css";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const VECTOR_ICONS = {
    A: <Award size={16} className="inline mr-2" />,
    F: <Activity size={16} className="inline mr-2" />,
    I: <Building size={16} className="inline mr-2" />,
    S: <Scaling size={16} className="inline mr-2" />,
    D: <Star size={16} className="inline mr-2" />,
    U: <Activity size={16} className="inline mr-2" />,
};

const VECTOR_NAMES = {
    A: "Accreditation",
    F: "Faculty & Legacy",
    I: "Infrastructure",
    S: "Scale",
    D: "Demand",
    U: "Urban Proximity",
};

export default function MethodologyPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const res = await fetch(`${API_URL}/api/transparency/methodology`);
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
        { code: 'A', weight: 0.25, description: "Standardized mapping of NAAC grades. Proxies for Elite National Institutes." },
        { code: 'F', weight: 0.24, description: "Institutional age as a mathematical proxy for stability and faculty legacy." },
        { code: 'I', weight: 0.19, description: "Derived from categorical dimensions and National Importance classifications." },
        { code: 'S', weight: 0.18, description: "Mathematical representation of institution footprint and structural breadth." },
        { code: 'D', weight: 0.09, description: "Demand index crossing top-tier accreditation markers dynamically." },
        { code: 'U', weight: 0.05, description: "Standardized urban noise distributor derived across sub-continent scaling." }
    ];

    const bands = data?.bands || {
        Elite: 98, High: 90, Competitive: 65, Moderate: 25, Emerging: 0
    };

    return (
        <div className="methodology-page">
            <section className="methodology-hero">
                <div className="methodology-bg">
                    <div className="methodology-orb orb-1"></div>
                    <div className="methodology-orb orb-2"></div>
                    <div className="methodology-grid"></div>
                </div>

                <Container>
                    <div className="methodology-hero-content">
                        <div className="flex items-center justify-center mb-6">
                            <span className="methodology-badge">
                                <ShieldCheck size={16} className="mr-2" />
                                Transparent & Trustworthy
                            </span>
                        </div>
                        <h1 className="methodology-title">How We Score Colleges</h1>
                        <p className="methodology-subtitle">
                            The CEI engine analyzed data from over 66,000 verified colleges across India to give you a single, reliable score.
                            {data?.versionId && (
                                <span className="block mt-4 opacity-70 font-mono text-sm">
                                    Scoring Constitution: v{data.versionId}
                                </span>
                            )}
                        </p>
                    </div>
                </Container>
            </section>

            <Container>
                <section className="methodology-content-section">

                    {/* Constitutional Anchor Bar */}
                    {data?.versionId && (
                        <div className="constitutional-bar mb-12">
                            <Info size={16} />
                            <span>This methodology is currently active and anchored to Dataset Hash: <code>{data.datasetHash?.slice(0, 16)}...</code></span>
                            <Link href="/transparency" className="ml-auto underline">View Records ↗</Link>
                        </div>
                    )}

                    {/* Phase 1: Data Acquisition */}
                    <GlassPanel className="methodology-card mb-8">
                        <div className="card-header">
                            <div className="icon-wrap bg-blue-500/10 text-blue-400">
                                <Building size={24} />
                            </div>
                            <h2>1. Official Data & Determinism</h2>
                        </div>
                        <p className="text-gray-300">
                            Our engine is built entirely on the <strong>Official AISHE Database</strong> covering exactly {data?.stats?.totalRecords?.toLocaleString() || "66,133"} verified colleges.
                        </p>
                        <p className="text-gray-300 mt-4">
                            The CEI Score is strictly mathematical and <strong>100% deterministic</strong>. We use advanced Name-Hashing algorithms to securely normalize geographic scaling, ensuring our engine produces the exact same objective result every run—immune to human bias.
                        </p>
                        <div className="metrics-row mt-6">
                            <div className="metric">
                                <span className="value">{data?.stats?.totalRecords?.toLocaleString() || "66,133"}</span>
                                <span className="label">Verified Colleges</span>
                            </div>
                            <div className="metric">
                                <span className="value">100%</span>
                                <span className="label">Determinism</span>
                            </div>
                        </div>
                    </GlassPanel>

                    {/* Phase 2: Feature Engineering */}
                    <GlassPanel className="methodology-card mb-8">
                        <div className="card-header">
                            <div className="icon-wrap bg-purple-500/10 text-purple-400">
                                <Scaling size={24} />
                            </div>
                            <h2>2. The Six Weight Vectors</h2>
                        </div>
                        <p className="text-gray-300 mb-4">
                            We use Principal Component Analysis (PCA) to group institution strength into 6 mathematically standardized vectors. Each vector is weighted according to its national significance:
                        </p>

                        <div className="vector-grid mt-6">
                            {weights.map((v) => (
                                <div key={v.code} className="vector-box">
                                    <h4>
                                        {VECTOR_ICONS[v.code] || <Activity size={16} className="inline mr-2" />}
                                        {VECTOR_NAMES[v.code] || v.code}
                                        ({(v.weight * 100).toFixed(0)}%)
                                    </h4>
                                    <p>{v.description}</p>
                                </div>
                            ))}
                        </div>
                    </GlassPanel>

                    {/* Phase 3: The Formula */}
                    <GlassPanel className="methodology-card mb-8">
                        <div className="card-header">
                            <div className="icon-wrap bg-yellow-500/10 text-yellow-500">
                                <BarChart4 size={24} />
                            </div>
                            <h2>3. Z-Score & eCDF Mapping</h2>
                        </div>
                        <p className="text-gray-300 mb-6">
                            We do not simply add these vectors. We mathematically <strong>Standardize (Z-Score)</strong> them globally. This isolates mathematical anomalies, allowing Elite institutes to organically float to the top. The final composite is pushed through an <strong>Emperical Cumulative Distribution Function (eCDF)</strong>—converting variance into a pristine <strong>0 to 100 National Percentile Rank.</strong>
                        </p>

                        <h3 className="text-xl font-bold text-white mb-4 mt-8">Competitiveness Bands</h3>
                        <p className="text-gray-300 mb-6">
                            Based on their percentile rank, institutions are placed into active bands.
                        </p>

                        <div className="bands-grid">
                            <div className="band-card elite-band">
                                <div className="band-header">
                                    <Star size={20} className="text-yellow-300 mr-2" fill="currentColor" />
                                    <h3>Elite ({bands.Elite}+)</h3>
                                </div>
                                <p>The absolute top of the country. Dominant IITs, IIMs, AIIMS, and premium Universities.</p>
                            </div>

                            <div className="band-card high-band">
                                <div className="band-header">
                                    <TrendingUp size={20} className="text-blue-300 mr-2" />
                                    <h3>High ({bands.High} - {bands.Elite - 1})</h3>
                                </div>
                                <p>Top-tier universities and highly ranked regional powerhouses.</p>
                            </div>

                            <div className="band-card competitive-band">
                                <div className="band-header">
                                    <Zap size={20} className="text-green-300 mr-2" />
                                    <h3>Competitive ({bands.Competitive} - {bands.High - 1})</h3>
                                </div>
                                <p>Strong, established colleges providing excellent quality education.</p>
                            </div>

                            <div className="band-card moderate-band">
                                <div className="band-header">
                                    <ShieldCheck size={20} className="text-purple-300 mr-2" />
                                    <h3>Moderate/Emerging (&lt;{bands.Competitive})</h3>
                                </div>
                                <p>Institutes fulfilling essential local higher education needs.</p>
                            </div>
                        </div>

                    </GlassPanel>

                    <div className="text-center mt-12 mb-20">
                        <h2 className="text-2xl font-bold text-white mb-6">See the algorithm into action.</h2>
                        <Button href="/colleges" variant="primary" size="lg">
                            Explore Verified Colleges →
                        </Button>
                    </div>
                </section>
            </Container>
        </div>
    );
}

