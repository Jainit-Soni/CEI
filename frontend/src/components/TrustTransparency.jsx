"use client";

import GlassPanel from "./GlassPanel";
import DataConfidenceBadge from "./DataConfidenceBadge";
import "./HomeSections.css";

export default function TrustTransparency() {
  return (
    <section className="nexus-home-section trust-section">
      <div className="home-section-inner">
        <header className="nexus-section-header">
          <span className="nexus-kicker fadeIn">TRUST_AND_TRANSPARENCY</span>
          <h2 className="fadeIn delay-1">Scores you can look in the <span className="serif-accent">eye</span>.</h2>
          <p className="fadeIn delay-1">
            CEI does not ask for blind trust. It shows you how each score was built,
            how stable it is, and where the underlying data came from.
          </p>
        </header>

        <div className="nexus-why-cei-grid">
          <GlassPanel variant="strong" className="nexus-glass-card nexus-why-cei-card fadeIn delay-2">
            <h3>CEI score</h3>
            <p>
              Every college has a 0‑100 CEI score grounded in placements, entrance
              selectivity, and institutional track record — not vibes.
            </p>
            <div className="trust-inline-badge">
              <DataConfidenceBadge label="high" score={86} compact={false} />
            </div>
          </GlassPanel>

          <GlassPanel variant="default" className="nexus-glass-card nexus-why-cei-card fadeIn delay-3">
            <h3>Explainable, factor by factor</h3>
            <p>
              The scoring model can be unpacked into human words: academic strength,
              ROI, infrastructure, peer quality. No opaque “AI magic”.
            </p>
          </GlassPanel>

          <GlassPanel variant="default" className="nexus-glass-card nexus-why-cei-card fadeIn delay-4">
            <h3>Report and audit</h3>
            <p>
              If a number looks off, you can report it. CEI tracks anomalies against
              official registries and documents versioned changes to its methodology.
            </p>
          </GlassPanel>
        </div>
      </div>
    </section>
  );
}

