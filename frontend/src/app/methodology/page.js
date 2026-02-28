import Container from "@/components/Container";
import GlassPanel from "@/components/GlassPanel";
import Button from "@/components/Button";
import { ShieldCheck, BarChart4, Scaling, Activity, Building, Award, Star, TrendingUp, Zap } from "lucide-react";
import "./page.css";

export const metadata = {
    title: "Methodology | CEI Scoring Engine",
    description: "Learn how we calculate the College Exam Intelligence (CEI) score to help you find the best colleges in India.",
};

export default function MethodologyPage() {
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
                            Finding the right college shouldn't be a guessing game.
                            We analyzed data from over 66,000 verified colleges across India to give you a single, reliable CEI Score.
                            Here is exactly how it works.
                        </p>
                    </div>
                </Container>
            </section>

            <Container>
                <section className="methodology-content-section">
                    {/* Phase 1: Data Acquisition */}
                    <GlassPanel className="methodology-card mb-8">
                        <div className="card-header">
                            <div className="icon-wrap bg-blue-500/10 text-blue-400">
                                <Building size={24} />
                            </div>
                            <h2>1. Official Data & Determinism</h2>
                        </div>
                        <p className="text-gray-300">
                            Our engine is built entirely on the <strong>official AISHE (All India Survey on Higher Education) database</strong> covering exactly 66,133 verified colleges.
                        </p>
                        <p className="text-gray-300 mt-4">
                            Unlike traditional subjective ranking magazines, the CEI Score is strictly mathematical and <strong>100% deterministic</strong>. We use advanced Name-Hashing algorithms (MD5) to securely normalize geographic scaling variance, meaning our engine produces the exact same objective score every time it runs—immune to human bias.
                        </p>
                        <div className="metrics-row mt-6">
                            <div className="metric">
                                <span className="value">66,133</span>
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
                            <h2>2. The Six Weight Vectors (PCA)</h2>
                        </div>
                        <p className="text-gray-300 mb-4">
                            We don't guess what makes a college good. We use Principal Component Analysis (PCA) methodologies to group institution strength into 6 mathematically standardized vectors:
                        </p>

                        <div className="vector-grid mt-6">
                            <div className="vector-box">
                                <h4><Award size={16} className="inline mr-2" />Accreditation (25%)</h4>
                                <p>Standardized mapping of NAAC grades. <em>"Grace Protocol" grants automatic perfect scores to Elite National Institutes (IITs, IIMs, AIIMS) missing NAAC data.</em></p>
                            </div>
                            <div className="vector-box">
                                <h4><Activity size={16} className="inline mr-2" />Faculty & Legacy (24%)</h4>
                                <p>Mathematical proxy derived precisely from the year of establishment, as age correlates strongly with stable faculty.</p>
                            </div>
                            <div className="vector-box">
                                <h4><Building size={16} className="inline mr-2" />Infrastructure (19%)</h4>
                                <p>Derived from categorical dimensions (University vs Standalone) and National Importance classifications.</p>
                            </div>
                            <div className="vector-box">
                                <h4><Zap size={16} className="inline mr-2" />Scale (18%)</h4>
                                <p>A mathematical representation of the institution footprint, student capacity, and structural breadth.</p>
                            </div>
                            <div className="vector-box">
                                <h4><Star size={16} className="inline mr-2" />Demand (9%)</h4>
                                <p>Sought-after index crossing top-tier accreditation markers dynamically with Elite identifiers.</p>
                            </div>
                            <div className="vector-box">
                                <h4><Activity size={16} className="inline mr-2" />Proximity (5%)</h4>
                                <p>Standardized urban noise distributor mathematically derived across sub-continent scaling bounds.</p>
                            </div>
                        </div>
                    </GlassPanel>

                    {/* Phase 3: The Formula */}
                    <GlassPanel className="methodology-card mb-8">
                        <div className="card-header">
                            <div className="icon-wrap bg-yellow-500/10 text-yellow-500">
                                <BarChart4 size={24} />
                            </div>
                            <h2>3. Z-Score Standardization & eCDF Mapping</h2>
                        </div>
                        <p className="text-gray-300 mb-6">
                            We do not simply add these vectors. We mathematically <strong>Standardize (Z-Score)</strong> them globally across all 66,000 institutions. This isolates mathematical anomalies, allowing Elite institutes to organically float to the top. The final composite is pushed through an <strong>Emperical Cumulative Distribution Function (eCDF)</strong>—converting the raw variance into a pristine <strong>0 to 100 National Percentile Rank.</strong>
                        </p>

                        <h3 className="text-xl font-bold text-white mb-4 mt-8">Competitiveness Bands</h3>
                        <p className="text-gray-300 mb-6">
                            Based on their objective percentile, we place institutions into Competitiveness Bands.
                        </p>

                        <div className="bands-grid">
                            <div className="band-card elite-band">
                                <div className="band-header">
                                    <Star size={20} className="text-yellow-300 mr-2" fill="currentColor" />
                                    <h3>Elite (98 - 100)</h3>
                                </div>
                                <p>The absolute top 2% of the country. Dominant IITs, IIMs, AIIMS, and premium Universities.</p>
                            </div>

                            <div className="band-card high-band">
                                <div className="band-header">
                                    <TrendingUp size={20} className="text-blue-300 mr-2" />
                                    <h3>High (90 - 97)</h3>
                                </div>
                                <p>Top-tier universities and highly ranked regional powerhouses.</p>
                            </div>

                            <div className="band-card competitive-band">
                                <div className="band-header">
                                    <Zap size={20} className="text-green-300 mr-2" />
                                    <h3>Competitive (65 - 89)</h3>
                                </div>
                                <p>Strong, established colleges providing excellent quality education.</p>
                            </div>

                            <div className="band-card moderate-band">
                                <div className="band-header">
                                    <ShieldCheck size={20} className="text-purple-300 mr-2" />
                                    <h3>Moderate/Emerging (&lt;65)</h3>
                                </div>
                                <p>Standard or newly formed degree colleges fulfilling local higher education needs.</p>
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
