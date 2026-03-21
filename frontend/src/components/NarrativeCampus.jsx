'use client';

import React from 'react';
import TruthSeatsSection from './college/TruthSeatsSection';
import './NarrativeCampus.css';

const NarrativeCampus = ({ college }) => {
  return (
    <section className="prestige-section narrative-campus">
      <div className="section-container">
        <div className="glass-card-root capacity-card">
          <header className="narrative-header">
            <span className="prestige-subheading">Seats & Intake</span>
            <h2 className="prestige-heading">Institutional Capacity</h2>
            <div className="dossier-stamp">Source: 2026 Seat Matrix</div>
          </header>

          <div className="campus-intel-wrapper">
            <TruthSeatsSection collegeId={college.id} />
          </div>

          <div className="campus-meta-footer">
            <div className="metric-tag">Institutional Latitude: {college.raw?.location?.latitude || '28.6139'}</div>
            <div className="metric-tag">Institutional Longitude: {college.raw?.location?.longitude || '77.2090'}</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NarrativeCampus;
