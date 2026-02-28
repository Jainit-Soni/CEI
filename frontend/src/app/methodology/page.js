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
                            <h2>1. Only Verified Data</h2>
                        </div>
                        <p className="text-gray-300">
                            We don't rely on random internet lists or paid placements. Our engine is built entirely on the <strong>official AISHE (All India Survey on Higher Education) database</strong> from the Government of India.
                        </p>
                        <p className="text-gray-300 mt-4">
                            We carefully cleaned and verified every single record to ensure you are only looking at perfectly accurate, real institutions.
                        </p>
                        <div className="metrics-row mt-6">
                            <div className="metric">
                                <span className="value">66,133</span>
                                <span className="label">Verified Colleges</span>
                            </div>
                            <div className="metric">
                                <span className="value">100%</span>
                                <span className="label">Official Government Data</span>
                            </div>
                        </div>
                    </GlassPanel>

                    {/* Phase 2: Feature Engineering */}
                    <GlassPanel className="methodology-card mb-8">
                        <div className="card-header">
                            <div className="icon-wrap bg-purple-500/10 text-purple-400">
                                <Scaling size={24} />
                            </div>
                            <h2>2. Fair Comparisons</h2>
                        </div>
                        <p className="text-gray-300 mb-4">
                            It isn't fair to compare a massive University like IIT Kharagpur to a small local degree college. That's why we group institutions into categories (Universities, Colleges, and Standalone Institutes) before scoring them.
                        </p>
                        <p className="text-gray-300 mb-4">
                            We look at 6 key areas to determine a college's quality:
                        </p>

                        <div className="vector-grid mt-6">
                            <div className="vector-box">
                                <h4><Award size={16} className="inline mr-2" />Accreditation</h4>
                                <p>Official NAAC grades and recognitions.</p>
                            </div>
                            <div className="vector-box">
                                <h4><Activity size={16} className="inline mr-2" />Legacy</h4>
                                <p>How long the institution has been established.</p>
                            </div>
                            <div className="vector-box">
                                <h4><Building size={16} className="inline mr-2" />Infrastructure</h4>
                                <p>Campus scale and premium institute status (like IITs/NITs).</p>
                            </div>
                            <div className="vector-box">
                                <h4><Zap size={16} className="inline mr-2" />Demand</h4>
                                <p>How sought-after the college is by top students.</p>
                            </div>
                        </div>
                    </GlassPanel>

                    {/* Phase 3: The Formula */}
                    <GlassPanel className="methodology-card mb-8">
                        <div className="card-header">
                            <div className="icon-wrap bg-yellow-500/10 text-yellow-500">
                                <BarChart4 size={24} />
                            </div>
                            <h2>3. The Final Score (0 - 100)</h2>
                        </div>
                        <p className="text-gray-300 mb-6">
                            We combine all these factors into a single mathematical formula. The result is a simple, easy-to-understand <strong>CEI Score from 0 to 100</strong>.
                            The closer a college is to 100, the better it is compared to its peers.
                        </p>

                        <h3 className="text-xl font-bold text-white mb-4 mt-8">Competitiveness Bands</h3>
                        <p className="text-gray-300 mb-6">
                            Based on the CEI Score, we place each college into a "Competitiveness Band" to instantly tell you its national standing.
                        </p>

                        <div className="bands-grid">
                            <div className="band-card elite-band">
                                <div className="band-header">
                                    <Star size={20} className="text-yellow-300 mr-2" fill="currentColor" />
                                    <h3>Elite (98 - 100)</h3>
                                </div>
                                <p>The top 2% of institutions nationally. Includes premium IITs, IIMs, AIIMS, and NITs.</p>
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
                                    <h3>Moderate (25 - 64)</h3>
                                </div>
                                <p>Standard degree colleges fulfilling essential higher education needs.</p>
                            </div>
                        </div>

                    </GlassPanel>

                    <div className="text-center mt-12 mb-20">
                        <h2 className="text-2xl font-bold text-white mb-6">Ready to see top-ranked colleges?</h2>
                        <Button href="/colleges" variant="primary" size="lg">
                            Explore Verified Colleges →
                        </Button>
                    </div>
                </section>
            </Container>
        </div>
    );
}
