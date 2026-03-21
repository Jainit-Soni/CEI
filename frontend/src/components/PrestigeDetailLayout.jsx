'use client';

import React from 'react';
import './PrestigeTheme.css';

/**
 * PrestigeDetailLayout
 * Orchestrates the vertical narrative flow for the "Prestige Story" redesign.
 */
const PrestigeDetailLayout = ({ children, college }) => {
  return (
    <div 
      className="prestige-story-root" 
      style={{ position: 'relative', width: '100%', background: 'transparent', zIndex: 1 }}
    >
      {/* 3rd Spectral Layer (Lavender) */}
      <div className="spectral-ambient-band" />
      
      {/* Rendering narrative sections as children over global spectral bands */}
      {children}
    </div>
  );
};

export default PrestigeDetailLayout;
