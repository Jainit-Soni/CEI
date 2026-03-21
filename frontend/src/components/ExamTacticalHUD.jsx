'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Globe, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import './TacticalHUD.css';

const ExamTacticalHUD = ({ exam }) => {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 100);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const openOfficial = () => {
    if (exam.officialUrl) {
      window.open(exam.officialUrl, '_blank');
    }
  };

  return (
    <div className={`tactical-hud ${scrolled ? 'scrolled' : ''}`}>
      <div className="hud-container">
        {/* Navigation Action */}
        <button className="hud-back-btn" onClick={() => router.push('/exams')}>
          <ArrowLeft size={18} />
          <span className="hud-button-label">Back to Exams</span>
        </button>

        {/* Minimal Utility */}
        <div className="hud-utilities">
          <button className="hud-protocol-btn" onClick={openOfficial}>
            <Globe size={18} />
            <span className="hud-button-label">Official Website</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ExamTacticalHUD;
