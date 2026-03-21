'use client';

import React, { useState, useEffect } from 'react';
import './AdmissionsStickyNav.css';

const AdmissionsStickyNav = () => {
  const [activeSection, setActiveSection] = useState('aura');
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY;
      setIsVisible(scrollY > 400);

      const sections = ['aura', 'overview', 'foundation', 'intel', 'campus', 'pedigree', 'geography', 'branches', 'vault', 'edge', 'sentiment', 'gateway'];
      for (const section of sections.reverse()) {
        const element = document.querySelector(`.narrative-${section}, .prestige-${section}`);
        if (element && scrollY >= element.offsetTop - 300) {
          setActiveSection(section);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollTo = (section) => {
    const element = document.querySelector(`.narrative-${section}, .prestige-${section}`);
    if (element) {
      window.scrollTo({
        top: element.offsetTop - 80,
        behavior: 'smooth'
      });
    }
  };

  return (
    <nav className={`prestige-sticky-nav ${isVisible ? 'visible' : ''}`}>
      <div className="nav-container">
        {['aura', 'overview', 'foundation', 'intel', 'campus', 'pedigree', 'geography', 'branches', 'vault', 'edge', 'sentiment', 'gateway'].map((id) => (
          <button
            key={id}
            onClick={() => scrollTo(id)}
            className={`nav-dot-link ${activeSection === id ? 'active' : ''}`}
          >
            <span className="dot" />
            <span className="dot-label">{id}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

export default AdmissionsStickyNav;
