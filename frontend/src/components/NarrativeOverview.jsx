'use client';

import React from 'react';
import './NarrativeOverview.css';
import { ShieldCheck } from 'lucide-react';

const NarrativeOverview = ({ college }) => {
  return (
    <section className="prestige-section narrative-overview">
      <div className="section-container">
        <div className="glass-card-root overview-card">
          <div className="overview-content">
            <span className="prestige-subheading">Institutional Summary</span>
            <h2 className="prestige-heading overview-tagline">
              {college.name} Excellence Blueprint
            </h2>
            <p className="prestige-body-text">
              {college.description || `Situated in ${college.location || 'India'}, ${college.name} represents a significant node in our educational intelligence network. Optimized for ${college.type} performance gradients.`}
            </p>
            
            <div className="overview-actions">
              <span className="trust-pill evaluated">
                <ShieldCheck size={14} /> Official Profile
              </span>
            </div>
          </div>

          <div className="overview-stats-ring">
            <div className="score-grade-pill">
              <span className="grade-val">{college.ceiScore != null && Number.isFinite(Number(college.ceiScore)) ? Number(college.ceiScore).toFixed(2) : '---'}</span>
              <span className="grade-label">CEI SCORE</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NarrativeOverview;
