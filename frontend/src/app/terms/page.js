"use client";

import Container from "@/components/Container";
import GlassPanel from "@/components/GlassPanel";

export default function TermsPage() {
    return (
        <div className="page-wrapper" style={{ paddingTop: "120px", paddingBottom: "80px" }}>
            <Container>
                <div style={{ maxWidth: "800px", margin: "0 auto" }}>
                    <h1 style={{ fontSize: "2.5rem", fontWeight: "800", marginBottom: "1.5rem", color: "#1e293b" }}>
                        Terms & Conditions
                    </h1>
                    <p style={{ color: "#64748b", marginBottom: "2rem" }}>
                        Last Updated: February 2026
                    </p>

                    <GlassPanel className="terms-content" style={{ padding: "1.5rem" }}>
                        <section style={{ marginBottom: "2rem" }}>
                            <h2 style={{ fontSize: "1.5rem", fontWeight: "700", marginBottom: "1rem", color: "#334155" }}>1. Introduction</h2>
                            <p style={{ lineHeight: "1.7", color: "#475569" }}>
                                Welcome to College Explorer India (CEI). By accessing our website and using our services, you agree to comply with and be bound by the following terms and conditions. If you do not agree to these terms, you should not use this platform.
                            </p>
                        </section>

                        <div className="liability-alert" style={{ background: "#fff1f2", borderLeft: "4px solid #f43f5e", padding: "1.5rem", borderRadius: "8px", marginBottom: "2rem" }}>
                            <h2 style={{ fontSize: "1.25rem", fontWeight: "700", marginBottom: "0.5rem", color: "#be123c", display: "flex", alignItems: "center", gap: "8px" }}>
                                ⚠️ NO LIABILITY CLAUSE
                            </h2>
                            <p style={{ lineHeight: "1.6", color: "#881337", fontWeight: "500" }}>
                                CEI aggregates data from various sources (official websites, NIRF, student reports) to provide a unified view. <strong>We strictly claim NO LIABILITY for the accuracy, completeness, or timeliness of this data.</strong> Admission policies, fee structures, and placement statistics change frequently. Users MUST verify all details directly with the official institute websites before making any financial or academic decisions. CEI is an information facilitator, not an admission authority.
                            </p>
                        </div>

                        <section style={{ marginBottom: "2rem" }}>
                            <h2 style={{ fontSize: "1.5rem", fontWeight: "700", marginBottom: "1rem", color: "#334155" }}>2. Accuracy of Data</h2>
                            <p style={{ lineHeight: "1.7", color: "#475569" }}>
                                While we strive to provide accurate and up-to-date information regarding colleges, acceptances, fees, and placements, we cannot guarantee the absolute accuracy of all data. Information is aggregated from official institute websites, NIRF filings, and third-party sources. We explicitly disclaim liability for any errors or omissions. Users are strongly advised to verify critical information directly with the respective institutes before making admission decisions.
                            </p>
                        </section>

                        <section style={{ marginBottom: "2rem" }}>
                            <h2 style={{ fontSize: "1.5rem", fontWeight: "700", marginBottom: "1rem", color: "#334155" }}>3. User Accounts</h2>
                            <p style={{ lineHeight: "1.7", color: "#475569" }}>
                                To access certain features like "My List" or "ROI Calculator", you may be required to create an account. You are responsible for maintaining the confidentiality of your account credentials. We reserve the right to terminate accounts that violate our community guidelines or engage in suspicious activity.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                                <span className="w-1 h-6 bg-blue-600 rounded-full"></span>
                                3. User Conduct
                            </h2>
                            <p className="text-slate-600 leading-relaxed">
                                You agree to use the site only for lawful purposes. You are prohibited from posting on or transmitting through the site any material that differs from our community standards, including but not limited to unlawful, harmful, threatening, abusive, harassing, defamatory, vulgar, obscene, sexually explicit, profane, hateful, racially, ethnically, or otherwise objectionable material of any kind.
                            </p>
                        </section>

                        <section>
                            <h2 className="text-xl font-bold text-slate-800 mb-3 flex items-center gap-2">
                                <span className="w-1 h-6 bg-blue-600 rounded-full"></span>
                                4. Intellectual Property
                            </h2>
                            <p className="text-slate-600 leading-relaxed">
                                All content included on this site, such as text, graphics, logos, button icons, images, audio clips, digital downloads, data compilations, and software, is the property of the site owner or its content suppliers and protected by international copyright laws.
                            </p>
                        </section>

                        <div className="pt-8 border-t border-slate-200 mt-8">
                            <p className="text-sm text-slate-400 text-center">
                                © {new Date().getFullYear()} College Essentials of India. All rights reserved.
                            </p>
                        </div>
                </div>
            </Container>
            <style jsx>{`
                @media (max-width: 768px) {
                    .terms-content {
                        padding: 1.5rem !important;
                    }
                    .liability-alert {
                        padding: 1rem !important;
                    }
                }
            `}</style>
        </div>
    );
}
