import React, { useEffect, useState } from 'react';
import { MapPin, ExternalLink, ArrowDown, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
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
        {/* 1. BACK BUTTON */}
        <Link href="/colleges" className="hero-back-btn">
          <ArrowLeft size={16} /> Back to Colleges
        </Link>

        <div className="aura-identity">
          {/* 2. TRUST PILLS */}
          <div className="hero-trust-row">
            <span className="trust-pill evaluated">
              <span className="dot" /> Evaluated Intelligence
            </span>
            {college?.competitivenessBand && (
              <span className="trust-pill band-pill">
                <span className="dot" /> {college.competitivenessBand} Band
              </span>
            )}
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
            {college?.location && (
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${college.name} ${college.location}`)}`}
                target="_blank" 
                rel="noopener noreferrer"
                className="maps-button"
              >
                Open in Maps <ExternalLink size={14} />
              </a>
            )}
            {college?.university && college.university !== 'NOT APPLICABLE' && (
              <div className="meta-item">
                <span>Affiliated to {college.university}</span>
              </div>
            )}
          </div>

          {/* 3. PERFORMANCE ACCENT (Score) */}
          <div className="hero-score-pill">
            <span className="score-label">CEI SCORE</span>
            <span className="score-value">{college?.ceiScore ? Number(college.ceiScore).toFixed(2) : 'Evaluating'}</span>
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
