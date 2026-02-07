import "./Container.css";

export default function Container({ children, className = "" }) {
  return <div className={`cei-container ${className}`}>{children}</div>;
}
