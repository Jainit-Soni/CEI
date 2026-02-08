
import ChoiceFillingClient from "./ChoiceFillingClient";
import "./choice-filling.css";

export const metadata = {
    title: "Smart Choice Filling Generator | Admission Intelligence",
    description: "Build your perfect college preference list with our AI-assisted Choice Filling tool. Analyze reach, safe, and backup options based on your rank.",
};

export default function ChoiceFillingPage() {
    return <ChoiceFillingClient />;
}
