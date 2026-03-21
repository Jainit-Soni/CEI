'use client';

import React from 'react';
import { DoorOpen, Users, BarChart3 } from 'lucide-react';
import TruthSeatsSection from './college/TruthSeatsSection';
import TruthCutoffsSection from './college/TruthCutoffsSection';
import './NarrativeGateway.css';

/**
 * NarrativeGateway - Section 4
 * The final barrier to entry: Seats, Admissions, and Cutoffs.
 * Integrated directly into the narrative scroll.
 */
const NarrativeGateway = ({ collegeId }) => {
  return (
    <section className="prestige-section narrative-gateway">
      <div className="section-container">
        <div className="glass-card-root gateway-card">
          <header className="narrative-header">
            <span className="prestige-subheading">Strategic Entry</span>
            <h2 className="prestige-heading">Admission Thresholds</h2>
            <div className="dossier-stamp">Status: 2026 Cutoffs Evaluated</div>
          </header>

          <div className="gateway-narrative">
            {/* Cutoffs Content Wrapper */}
            <div className="gateway-block">
              <div className="block-header">
                <BarChart3 size={24} color="var(--color-accent)" />
                <h3 className="prestige-heading small">Institutional Cutoffs</h3>
              </div>
              <div className="data-frame">
                <TruthCutoffsSection collegeId={collegeId} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NarrativeGateway;
