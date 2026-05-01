'use client';

import React from 'react';
import { Landmark, Globe, Calendar, Award } from 'lucide-react';
import './NarrativeFoundation.css';

/**
 * NarrativeFoundation - Section 2
 * Presents the "Institutional Identity" in an editorial, high-prestige layout.
 */
const NarrativeFoundation = ({ college }) => {
  return (
    <section className="prestige-section narrative-foundation">
      <div className="section-container">
        <header className="narrative-header" data-aos="fade-up">
          <span className="prestige-subheading">The Foundation</span>
          <h2 className="prestige-heading section-title">Institutional Identity</h2>
        </header>

        <div className="foundation-grid">
          {/* Identity Story Block */}
          <div className="story-block" data-aos="fade-right">
            <p className="narrative-text">
              Established in <span className="highlight">{college?.establishedYear || college?.establishmentYear || 'recent years'}</span>, 
              {college?.name} has stood as a pillar of academic excellence in {college?.state || college?.location || 'India'}. 
              {college?.university && college.university !== 'NOT APPLICABLE' ? (
                  <>As an institution affiliated with <span className="highlight">{college.university}</span>, it bridges the gap between traditional heritage and modern innovation.</>
              ) : (
                  <> As an autonomous institution, it bridges the gap between traditional heritage and modern innovation.</>
              )}
            </p>
          </div>

          {/* Factual Modules */}
          <div className="fact-modules">
            <div className="fact-card" data-aos="zoom-in">
              <Landmark className="fact-icon" size={24} />
              <div className="fact-info">
                <span className="fact-label">Affiliation</span>
                <span className="fact-val">{college?.university}</span>
              </div>
            </div>

            <div className="fact-card" data-aos="zoom-in" data-aos-delay="100">
              <Globe className="fact-icon" size={24} />
              <div className="fact-info">
                <span className="fact-label">Regional Presence</span>
                <span className="fact-val">{college?.location}</span>
              </div>
            </div>

            <div className="fact-card" data-aos="zoom-in" data-aos-delay="200">
              <Calendar className="fact-icon" size={24} />
              <div className="fact-info">
                <span className="fact-label">Academic Legacy</span>
                <span className="fact-val" style={{ fontSize: (Number(college?.establishedYear || college?.establishmentYear) > 1800 && Number(college?.establishedYear || college?.establishmentYear) <= new Date().getFullYear()) ? 'inherit' : '0.85rem' }}>
                  {(Number(college?.establishedYear || college?.establishmentYear) > 1800 && Number(college?.establishedYear || college?.establishmentYear) <= new Date().getFullYear()) 
                    ? `${new Date().getFullYear() - Number(college?.establishedYear || college?.establishmentYear)} Years` 
                    : 'Official data unavailable'}
                </span>
              </div>
            </div>

            <div className="fact-card" data-aos="zoom-in" data-aos-delay="300">
              <Award className="fact-icon" size={24} />
              <div className="fact-info">
                <span className="fact-label">CEI Status</span>
                <span className="fact-val text-indigo">Vetted Institution</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NarrativeFoundation;
