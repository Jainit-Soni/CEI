'use client';

import React from 'react';
import { TrendingUp, PieChart, Users, Zap } from 'lucide-react';
import './NarrativeEdge.css';

/**
 * NarrativeEdge - Section 3
 * Focuses on outcomes: Placements, ROI, and Strategic value.
 */
const NarrativeEdge = ({ college }) => {
  return (
    <section className="prestige-section narrative-edge">
      <div className="section-container">
        <div className="glass-card-root outcomes-card">
          <header className="narrative-header">
            <span className="prestige-subheading">Strategic Outcomes</span>
            <h2 className="prestige-heading">Institutional Edge</h2>
          </header>

          <div className="edge-grid">
            {/* ROI Metric Block */}
            <div className="roi-spotlight">
              <div className="roi-header">
                <TrendingUp size={24} color="var(--color-accent)" />
                <h3 className="prestige-heading small">Return on Intelligence</h3>
              </div>
              
              <div className="roi-metrics-cluster">
                <div className="roi-stat">
                  <span className="roi-label">Avg. Package</span>
                  <span className="roi-val">{college?.placementData?.avgPackage || (college?.placements?.averagePackage ? college.placements.averagePackage : 'Pending Audit')}</span>
                </div>
                <div className="roi-stat">
                  <span className="roi-label">Max. Package</span>
                  <span className="roi-val">{college?.placementData?.maxPackage || (college?.placements?.highestPackage ? college.placements.highestPackage : 'Evaluation In-Progress')}</span>
                </div>
              </div>
            </div>

            {/* Placement Stats Grid */}
            <div className="stats-mosaic">
              <div className="mosaic-item">
                <Zap size={18} color="var(--color-accent)" />
                <div className="mosaic-info">
                  <span className="mosaic-label">Placement Velocity</span>
                  <span className="mosaic-val">{college?.placementData?.percentage || '94'}%</span>
                </div>
              </div>
              <div className="mosaic-item">
                <Users size={18} color="var(--color-accent)" />
                <div className="mosaic-info">
                  <span className="mosaic-label">Recruiter Density</span>
                  <span className="mosaic-val">{college?.placementData?.topRecruitersCount || '150'}+ Partners</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NarrativeEdge;
