import AdmissionCalculator from "@/components/tools/AdmissionCalculator";
import { Sparkles } from "lucide-react";

export const metadata = {
  title: "Admission Chance Predictor | CE Intelligence",
  description: "Predict your admission chances in top engineering colleges using official JoSAA/CSAB 'Truth-Grade' data.",
};

export default function AdmissionCalculatorPage() {
  return (
    <main className="calculator-page">
      <div className="calculator-hero">
        <div className="calculator-hero-badge">
          <Sparkles size={12} className="mr-1" /> Truth-Grade Active
        </div>
        <h1>AI Admission <span>Strategist</span></h1>
        <p>
          Powered by the CEI "Truth-Grade" Engine. Get precise probabilities based on verified national admission registries for the entire Indian collegiate catalog.
        </p>
      </div>
      
      <AdmissionCalculator />
    </main>
  );
}
