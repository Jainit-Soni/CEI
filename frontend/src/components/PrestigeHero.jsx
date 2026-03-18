'use client';

import React, { useEffect, useState } from 'react';
import { MapPin, ExternalLink, ArrowDown } from 'lucide-react';
import './PrestigeHero.css';

/**
 * PrestigeHero - The Aura Section
 * A cinematic, full-screen opening that establishes the institution's character.
 */
const PrestigeHero = ({ college }) => {
  const [scrollPos, setScrollPos] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollPos(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Removed dark cinematic images in favor of ultra-premium White Light Glass aesthetic
  return (
    <section className="prestige-hero">
      {/* Premium White Glass Background Layer */}
      <div 
        className="hero-bg-layer prestige-light-mesh"
        style={{ transform: `translateY(${scrollPos * 0.4}px)` }}
      />
      
      {/* Frosted Glass Overlay Structure */}
      <div className="hero-overlay glass-light" />

      {/* Content Layer */}
      <div className="hero-content-container">
        {/* 1. BREADCRUMBS */}
        <nav className="hero-breadcrumbs">
          <span className="crumb">Search</span>
          <span className="crumb-sep">/</span>
          <span className="crumb">Colleges</span>
          <span className="crumb-sep">/</span>
          <span className="crumb active">{college?.name}</span>
        </nav>

        <div className="aura-identity">
          {/* 2. TRUST PILLS */}
          <div className="hero-trust-row">
            <span className="trust-pill verified">
              <span className="dot" /> Verified Intelligence
            </span>
            <span className="trust-pill official">Official Institution</span>
          </div>

          <h1 className="prestige-heading hero-title">
            {college?.name}
          </h1>
          
          <div className="hero-meta-strip">
            <div className="meta-item">
              <MapPin size={16} />
              <span>{college?.location}</span>
            </div>
            {college?.university && college.university !== 'NOT APPLICABLE' && (
              <div className="meta-item">
                <span>Affiliated to {college.university}</span>
              </div>
            )}
          </div>

          {/* 3. PERFORMANCE ACCENT (Score) */}
          <div className="hero-score-pill">
            <span className="score-label">CEI INDEX</span>
            <span className="score-value">{college?.score || '8.4'}</span>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="scroll-hint">
          <span className="hint-label">The Foundation</span>
          <ArrowDown className="hint-icon" size={20} />
        </div>
      </div>
    </section>
  );
};

export default PrestigeHero;
