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
                    <ROICalculator />
                </div>
            </Container>
        </div>
    );
}
