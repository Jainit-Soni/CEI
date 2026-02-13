"use client";

import ApplicationBoard from "@/components/ApplicationBoard";
import Container from "@/components/Container";

export default function ChoiceFillingClient() {
    return (
        <div className="choice-filling-page" style={{ paddingTop: '100px', minHeight: '100vh', background: '#f8fafc' }}>
            <Container>
                <header className="page-header" style={{ marginBottom: '40px' }}>
                    <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.5rem', fontWeight: 800, color: '#1e3a8a' }}>
                        Smart <span style={{ color: '#2563eb' }}>Choice Filling</span>
                    </h1>
                    <p style={{ color: '#64748b', fontSize: '1.1rem', maxWidth: '600px', marginTop: '8px' }}>
                        Refine your roadmap. Drag to prioritize institutions and generate your strategic admission report.
                    </p>
                </header>

                <ApplicationBoard />
            </Container>
        </div>
    );
}
