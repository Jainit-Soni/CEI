'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Map, Activity, Shield } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { fetchLiveActivity } from '@/lib/api';
import './TacticalHUD.css';

const TacticalHUD = ({ college }) => {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [liveStats, setLiveStats] = useState({ active_now: 1 });

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 100);
    window.addEventListener('scroll', handleScroll);
    
    const loadPulse = async () => {
      try {
        const stats = await fetchLiveActivity(college.id);
        if (stats) setLiveStats(stats);
      } catch (err) {
        console.warn("Live Pulse unavailable");
      }
    };

    loadPulse();
    const interval = setInterval(loadPulse, 15000);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearInterval(interval);
    };
  }, [college.id]);

  const openInMaps = () => {
    const query = encodeURIComponent(`${college.name}, ${college.location}`);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  };

  return (
    <div className={`tactical-hud ${scrolled ? 'scrolled' : ''}`}>
      <div className="hud-container">
        {/* Navigation Action */}
        <button className="hud-back-btn" onClick={() => router.back()}>
          <ArrowLeft size={18} />
          <span className="hud-button-label">Back to Results</span>
        </button>

        {/* Minimal Utility */}
        <div className="hud-utilities">
          <button className="hud-protocol-btn" onClick={openInMaps}>
            <Map size={18} />
            <span className="hud-button-label">Google Maps</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default TacticalHUD;
