"use client";

import GlassPanel from "./GlassPanel";
import "./HomeSections.css";

export default function WhyCei() {
  const pillars = [
    {
      id: "trusted-data",
      title: "Trusted structure, not anecdotes",
      body: "CEI draws from verified sources, cross‑checks anomalies, and surfaces confidence so you always know which numbers are firm and which are soft.",
    },
    {
      id: "decision-context",
      title: "Decision context, not just scores",
      body: "Placements, cutoffs, and ROI are framed together, so an exam rank or fee number lives in a context you can actually reason with.",
    },
    {
      id: "explainability",
      title: "Explainable scoring, not black boxes",
      body: "Every CEI score can be unpacked. You can see what drove it, how stable it is, and where the data comes from.",
    },
  ];

  return (
    <section className="nexus-home-section why-cei-section">
      <div className="home-section-inner">
        <header className="nexus-section-header">
          <span className="nexus-kicker fadeIn">WHY_CEI_EXISTS</span>
          <h2 className="fadeIn delay-1">Because “just Google it” is not a <span className="serif-accent">decision system</span>.</h2>
          <p className="fadeIn delay-1">
            CEI is built for the moment when you stop collecting links and start asking:
            “What should I actually do?”
          </p>
        </header>

        <div className="nexus-why-cei-grid">
          {pillars.map((p, index) => (
            <GlassPanel
              key={p.id}
              variant="default"
              className={`nexus-glass-card nexus-why-cei-card fadeIn delay-${index + 2}`}
            >
              <h3>{p.title}</h3>
              <p>{p.body}</p>
            </GlassPanel>
          ))}
        </div>
      </div>
    </section>
  );
}

