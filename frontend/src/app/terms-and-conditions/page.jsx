"use client";

import React from "react";
import Link from "next/link";
import { ShieldAlert, Scale, FileText, AlertTriangle, ShieldCheck } from "lucide-react";

export default function TermsAndConditions() {
    return (
        <main className="min-h-screen bg-slate-950 text-slate-300 py-32 px-6 sm:px-12 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950 -z-10"></div>
            <div className="absolute top-40 right-[-10%] w-[40rem] h-[40rem] bg-indigo-900/10 rounded-full blur-3xl -z-10 pointer-events-none"></div>
            
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-3 mb-6 text-indigo-400">
                    <Scale size={32} />
                    <span className="font-bold tracking-widest uppercase text-sm">Legal & Compliance</span>
                </div>
                
                <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-4">
                    Terms, Conditions & <br className="hidden md:block" /> Comprehensive Disclaimer
                </h1>
                
                <p className="text-slate-400 text-lg mb-12 max-w-2xl leading-relaxed">
                    By accessing or using the College Essentials of India (CEI) platform, you explicitly agree to these terms. If you do not agree to be bound by these provisions, you must immediately cease usage of this platform.
                </p>

                {/* Quick Nav */}
                <div className="flex flex-wrap gap-3 mb-16 p-4 bg-slate-900/50 border border-slate-800 rounded-2xl backdrop-blur-sm">
                    <a href="#disclaimer" className="text-sm px-4 py-2 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg transition-colors">1. Disclaimer of Liability</a>
                    <a href="#predictive" className="text-sm px-4 py-2 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg transition-colors">2. Predictive Engine Notice</a>
                    <a href="#privacy" className="text-sm px-4 py-2 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg transition-colors">3. Privacy Policy</a>
                    <a href="#intellectual" className="text-sm px-4 py-2 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-lg transition-colors">4. Intellectual Property</a>
                </div>

                <div className="space-y-16">
                    
                    {/* SECTION 1: Disclaimer of Liability */}
                    <section id="disclaimer" className="scroll-mt-32">
                        <div className="flex items-center gap-3 mb-6">
                            <ShieldAlert className="text-rose-500" size={24} />
                            <h2 className="text-2xl font-bold text-white">1. Absolute Disclaimer of Liability</h2>
                        </div>
                        <div className="p-6 bg-rose-950/20 border border-rose-900/50 rounded-2xl text-rose-200/80 mb-6 font-mono text-sm leading-relaxed">
                            THE CEI PLATFORM, INCLUDING ALL DATA, SCORES, RANKINGS, AND PREDICTIVE ENGINES, IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS, WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. UNDER NO CIRCUMSTANCES SHALL COLLEGE ESSENTIALS OF INDIA, ITS CREATORS, AFFILIATES, OR DATA PROVIDERS BE HELD LIABLE FOR ANY INDIRECT, INCIDENTAL, CONSEQUENTIAL, SPECIAL, OR EXEMPLARY DAMAGES ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THIS PLATFORM.
                        </div>
                        <div className="prose prose-invert prose-slate max-w-none">
                            <p>
                                <strong>Information Accuracy:</strong> While we utilize complex data aggregation and mathematical modeling, CEI acts exclusively as an algorithmic intelligence layer. We do not guarantee the absolute accuracy, completeness, or timeliness of any data (including fees, placement statistics, cutoffs, or admission statuses).
                            </p>
                            <p>
                                <strong>No Legal Endorsement:</strong> The term "Verified" or "Evaluated" on our platform strictly refers to mathematical data normalization protocols and does NOT constitute a legal endorsement, accreditation, or partnership with any university or institution.
                            </p>
                            <p>
                                <strong>User Responsibility:</strong> You must independently verify all information (such as application deadlines, eligibility criteria, and fee structures) directly with the official institution authorities before making any financial or academic decisions. We bear zero liability for missed deadlines, rejected applications, or financial loss.
                            </p>
                        </div>
                    </section>

                    {/* SECTION 2: Predictive Engine Notice */}
                    <section id="predictive" className="scroll-mt-32">
                        <div className="flex items-center gap-3 mb-6">
                            <AlertTriangle className="text-amber-500" size={24} />
                            <h2 className="text-2xl font-bold text-white">2. Predictive Engine & Algorithms</h2>
                        </div>
                        <div className="prose prose-invert prose-slate max-w-none">
                            <p>
                                The CEI platform features proprietary predictive technology, including the <strong>Admission Predictor</strong>, <strong>ROI Simulator</strong>, and <strong>CEI Score (Z-Score Percentile)</strong>.
                            </p>
                            <ul className="list-disc pl-5 mt-4 space-y-2">
                                <li><strong>Not a Guarantee:</strong> The Admission Predictor relies on historical cutoff data and Monte Carlo simulations. An indication of a "Safe" or "High Probability" match is an algorithmic estimate, <strong>not an admission guarantee</strong>. Actual admission depends on cohort dynamics, changing institutional policies, and reservation matrices which are outside our control.</li>
                                <li><strong>ROI Simulator Variability:</strong> Projected salaries and Return on Investment (ROI) trajectories are estimations based on past declared placements. Past performance does not guarantee future outcomes. CEI holds zero liability for disparate career outcomes.</li>
                                <li><strong>Methodology:</strong> You may review our open-source <Link href="/methodology" className="text-indigo-400 hover:text-indigo-300 underline">Ranking Methodology</Link>, which uses standardized vectors to normalize institutional performance. We reserve the right to alter the weightage and algorithms at any time without prior notice.</li>
                            </ul>
                        </div>
                    </section>

                    {/* SECTION 3: Privacy Policy */}
                    <section id="privacy" className="scroll-mt-32">
                        <div className="flex items-center gap-3 mb-6">
                            <ShieldCheck className="text-emerald-500" size={24} />
                            <h2 className="text-2xl font-bold text-white">3. Privacy Policy</h2>
                        </div>
                        <div className="prose prose-invert prose-slate max-w-none">
                            <p>
                                This Privacy Policy is incorporated into, and is subject to, these Terms and Conditions. By utilizing the CEI platform, you consent to our data collection and processing practices.
                            </p>
                            <h3>Data Collection & Usage</h3>
                            <ul className="list-disc pl-5 space-y-2 mt-4">
                                <li><strong>Account Information:</strong> If you use authenticated features (e.g., Firebase Auth), we securely store your email and profile name. We do not sell your personal identifying information to third parties.</li>
                                <li><strong>Academic Telemetry:</strong> To power the Admission Predictor and Choice Filling algorithms, we locally or remotely store the mock scores and exam percentiles you input.</li>
                                <li><strong>Cookies & Local Storage:</strong> We heavily utilize browser Local Storage and minimal cookies to cache your search preferences, comparison lists, and session states for performance. You can clear this at any time via your browser settings.</li>
                            </ul>
                            <h3>Third-Party Integrations</h3>
                            <p>
                                We utilize third-party services (e.g., Vercel, Firebase) for hosting and backend infrastructure. These providers operate under their own strict privacy compliances. CEI acts merely as a conduit and cannot be held liable for third-party infrastructure breaches.
                            </p>
                        </div>
                    </section>

                    {/* SECTION 4: Intellectual Property */}
                    <section id="intellectual" className="scroll-mt-32">
                        <div className="flex items-center gap-3 mb-6">
                            <FileText className="text-indigo-400" size={24} />
                            <h2 className="text-2xl font-bold text-white">4. Intellectual Property</h2>
                        </div>
                        <div className="prose prose-invert prose-slate max-w-none">
                            <p>
                                <strong>Ownership:</strong> The algorithms, codebase, UI/UX design (including the "Premium Light Glass" and "Elite" aesthetics), logic structures, and structured datasets presented on CEI are the exclusive intellectual property of College Essentials of India.
                            </p>
                            <p>
                                <strong>Scraping & API Usage:</strong> Unauthorized automated data extraction (scraping) is strictly prohibited. If you wish to utilize our Intelligence Layer programmatically, you must utilize the official <Link href="/developers" className="text-indigo-400 hover:text-indigo-300 underline">Developer API</Link>. Unsanctioned scraping will result in immediate API blacklisting and potential legal recourse.
                            </p>
                            <p>
                                <strong>Trademarks:</strong> All college names, logos, official examination marks (e.g., CAT, GATE, JEE), and institutional crests displayed on this platform remain the property and trademarks of their respective owners/authorities. Their inclusion on CEI is strictly for nominative fair use and educational identification.
                            </p>
                        </div>
                    </section>

                    <hr className="border-slate-800 my-12" />

                    <section className="text-center pb-12">
                        <p className="text-slate-500 text-sm">
                            Last Updated: March 2026. <br />
                            These terms constitute the entire agreement between you and CEI. Continual use of the site signifies binding acceptance of these terms and any subsequent modifications.
                        </p>
                        <div className="mt-8">
                            <Link href="/" className="inline-flex items-center justify-center px-8 py-3 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition-all shadow-lg shadow-indigo-900/20">
                                Acknowledge & Return Home
                            </Link>
                        </div>
                    </section>
                </div>
            </div>
        </main>
    );
}
