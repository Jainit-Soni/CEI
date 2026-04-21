'use client';

import React from 'react';
import TruthSeatsSection from './college/TruthSeatsSection';
import TruthSeatMatrixSection from './college/TruthSeatMatrixSection';
import './NarrativeCampus.css';

const NarrativeCampus = ({ college }) => {
  // 3-state management: 'loading' | 'available' | 'unavailable'
  // Hint from isEngineering for the initial state
  const [matrixStatus, setMatrixStatus] = React.useState(college.isEngineering ? 'loading' : 'loading');

  const handleMatrixStatus = (status) => {
    console.log(`[CEI][NarrativeCampus] Matrix status change: ${status}`);
    setMatrixStatus(status);
  };

  return (
    <section id="truth-campus" className="prestige-section narrative-campus">
      <div className="section-container">
        <div className="glass-card-root capacity-card">
          <header className="narrative-header">
            <span className="prestige-subheading">Seats & Intake</span>
            <h2 className="prestige-heading">Institutional Capacity</h2>
            <div className="dossier-stamp">Source: 2026 Seat Matrix</div>
          </header>

          {/* Unified Loading Experience */}
          {matrixStatus === 'loading' && (
            <div className="truth-section-loading unified-capacity-loading">
              <span className="spinner"></span>
              Synchronizing High-Fidelity Intake Data...
            </div>
          )}

          {/* Legacy Summary — Primary only if Matrix is unavailable */}
          {matrixStatus === 'unavailable' && (
            <div className="campus-intel-wrapper">
              <TruthSeatsSection collegeId={college.id} />
            </div>
          )}

          {/* Official Truth-Grade Seat Matrix — Primary if available */}
          <div className={`campus-intel-wrapper secondary-intel ${matrixStatus !== 'available' ? 'hidden-truth' : ''}`}>
            <TruthSeatMatrixSection 
              collegeId={college.id} 
              collegeName={college.name} 
              seatSearchName={college.raw?.names?.cutoffName || college.name} 
              onStatusChange={handleMatrixStatus}
            />
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
