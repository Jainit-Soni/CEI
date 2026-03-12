"use client";

import { Database, Filter, UserCheck, Zap } from "lucide-react";
import "./IntelligenceFacts.css"; // Reuse premium styles
import "./HomeSections.css";

const PIPELINE_STAGES = [
  {
    id: 1,
    title: "Data Harvesting",
    value: "10M+",
    label: "DATA POINTS",
    description: "Real-time aggregation of placement data, NIRF metrics, and student sentiment from verified nodes.",
    icon: <Database className="w-5 h-5" />,
    accent: "blue"
  },
  {
    id: 2,
    title: "Signal Extraction",
    value: "99.9%",
    label: "NOISE FILTER",
    description: "Advanced AI eliminates institutional marketing bias and stale stats to find the raw truth.",
    icon: <Filter className="w-5 h-5" />,
    accent: "purple"
  },
  {
    id: 3,
    title: "Profile Alignment",
    value: "MATCH",
    label: "PERSONALIZED",
    description: "Your scores and aspirations are mathematically mapped to institution performance models.",
    icon: <UserCheck className="w-5 h-5" />,
    accent: "emerald"
  },
  {
    id: 4,
    title: "Decision Delivery",
    value: "FINAL",
    label: "STRATEGY",
    description: "A definitive, ROI-backed choice designed to maximize your long-term career trajectory.",
    icon: <Zap className="w-5 h-5" />,
    accent: "slate"
  }
];

export default function IntelligencePipeline() {
  return (
    <section className="intel-facts-nexus pipeline-section">
      <div className="intel-container">
        <header className="intel-header">
          <span className="intel-kicker fadeIn">DECISION_ARCHITECTURE</span>
          <h2 className="intel-main-title fadeIn delay-1">
            The architecture of a <span className="serif-accent">perfect choice</span>.
          </h2>
          <p className="nexus-subtitle fadeIn delay-2">
            CEI doesn't just show you data; it manufactures clarity through a rigorous technical pipeline.
          </p>
        </header>

        <div className="intel-hub-grid">
          {PIPELINE_STAGES.map((stage, index) => (
            <div key={stage.id} className={`intel-hub-card fadeIn delay-${index + 1}`}>
              <div className="hub-card-inner">
                <div className={`hub-icon-mini ${stage.accent}`}>
                  {stage.icon}
                </div>
                <div className="hub-data">
                  <div className="hub-value">{stage.value}</div>
                  <div className="hub-label">{stage.label}</div>
                  <div className="hub-title-mini">{stage.title}</div>
                </div>
              </div>
              <div className="hub-description-overlay">
                <p>{stage.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

