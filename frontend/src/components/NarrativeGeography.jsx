'use client';

import React from 'react';
import { Plane, Train, Car, Home } from 'lucide-react';
import './NarrativeGeography.css';
import IndiaMap from './IndiaMap';

const NarrativeGeography = ({ college }) => {
  // Highlight the current college's state to create an institutional "radar"
  const mapStats = college?.state ? {
    [college.state.toLowerCase()]: { count: 10, topColleges: [college.name] }
  } : {};

  return (
    <section className="prestige-section narrative-geography">
      <div className="section-container">
        <div className="geo-frame">
          <div className="geo-content" data-aos="fade-right">
            <span className="prestige-subheading">Geographic Pulse</span>
            <h2 className="prestige-heading">Regional Context</h2>
            
            <div className="dossier-stamp">Location Verified: {college.city || 'Regional Core'}</div>
            
            <p className="geo-text">
              Strategically positioned in <span className="highlight-dark">{college.location}</span>, this institution 
              serves as a primary intellectual node for the {college.state} region. The institutional footprint 
              is optimized for professional immersion and regional connectivity.
            </p>
          </div>

          <div className="geo-visual-spot" data-aos="zoom-in" style={{ height: '400px', width: '100%', overflow: 'hidden' }}>
             <IndiaMap stats={mapStats} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default NarrativeGeography;
