import ROICalculator from "@/components/ROICalculator";
import Container from "@/components/Container";
import Button from "@/components/Button";

export const metadata = {
    title: "True ROI Calculator | CEI",
    description: "Calculate the real financial value of your degree. Estimate break-even time, EMI, and true disposable income.",
};

export default function ROICalculatorPage() {
    return (
        <div className="roi-page" style={{ marginTop: '8rem', paddingBottom: '4rem', position: 'relative' }}>
            <Container>
                <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                    <div style={{ marginBottom: '2rem', textAlign: 'center' }}>
                        <h1 style={{ fontSize: '2.5rem', fontWeight: '800', color: '#0f172a', marginBottom: '0.5rem', fontFamily: 'var(--font-display)' }}>
                            True ROI <span style={{ color: '#0ea5e9' }}>Simulator</span>
                        </h1>
                        <p style={{ color: '#64748b', fontSize: '1.1rem', lineHeight: '1.6' }}>
                            Simulate your financial future. Calculate break-even time and real disposable income.
                        </p>
                    </div>

                    <ROICalculator />

                    <div style={{ marginTop: '3rem', padding: '2rem', background: 'white', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                        <h3 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '1rem' }}>Why this matters?</h3>
                        <p style={{ color: '#475569', marginBottom: '1rem' }}>
                            A high placement package (e.g., 10 LPA) might seem great, but if the fees are astronomical (e.g., 25 Lakhs),
                            your <strong>Real Income</strong> after EMI might be lower than someone with a 6 LPA package from a cheaper college.
                        </p>
                        <ul style={{ paddingLeft: '1.5rem', color: '#475569', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            <li><strong>Break-Even Point:</strong> The moment you recover your total investment (Fees + Living).</li>
                            <li><strong>Disposable Income:</strong> What you actually take home after paying your Loan EMI and Taxes.</li>
                            <li><strong>Opportunity Cost:</strong> The income you lost while studying (relevant for Masters/MBA).</li>
                        </ul>
                    </div>
                </div>
            </Container>
        </div>
    );
}
