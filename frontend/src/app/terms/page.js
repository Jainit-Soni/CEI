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

                    <GlassPanel className="terms-content" style={{ padding: "2.5rem" }}>
                        <section style={{ marginBottom: "2rem" }}>
                            <h2 style={{ fontSize: "1.5rem", fontWeight: "700", marginBottom: "1rem", color: "#334155" }}>1. Introduction</h2>
                            <p style={{ lineHeight: "1.7", color: "#475569" }}>
                                Welcome to College Explorer India (CEI). By accessing our website and using our services, you agree to comply with and be bound by the following terms and conditions. If you do not agree to these terms, you should not use this platform.
                            </p>
                        </section>

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

                        <section style={{ marginBottom: "2rem" }}>
                            <h2 style={{ fontSize: "1.5rem", fontWeight: "700", marginBottom: "1rem", color: "#334155" }}>4. Intellectual Property</h2>
                            <p style={{ lineHeight: "1.7", color: "#475569" }}>
                                All content on this platform, including text, graphics, logos, and software, is the property of CEI or its content suppliers and is protected by international copyright laws. Unauthorized reproduction or redistribution of this content is strictly prohibited.
                            </p>
                        </section>

                        <section style={{ marginBottom: "2rem" }}>
                            <h2 style={{ fontSize: "1.5rem", fontWeight: "700", marginBottom: "1rem", color: "#334155" }}>5. Limitation of Liability</h2>
                            <p style={{ lineHeight: "1.7", color: "#475569" }}>
                                CEI shall not be liable for any direct, indirect, incidental, or consequential damages resulting from the use or inability to use our services. This includes, but is not limited to, damages for loss of data, profits, or goodwill.
                            </p>
                        </section>

                        <section>
                            <h2 style={{ fontSize: "1.5rem", fontWeight: "700", marginBottom: "1rem", color: "#334155" }}>6. Contact Us</h2>
                            <p style={{ lineHeight: "1.7", color: "#475569" }}>
                                If you have any questions regarding these terms, please contact us at <a href="mailto:support@cei.edu.in" style={{ color: "#2563eb", textDecoration: "underline" }}>support@cei.edu.in</a>.
                            </p>
                        </section>
                    </GlassPanel>
                </div>
            </Container>
        </div>
    );
}
