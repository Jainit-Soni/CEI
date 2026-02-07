import "./GradientSection.css";

export default function GradientSection({ children, className = "" }) {
  return <section className={`gradient-section ${className}`}>{children}</section>;
}
