"use client";

import React from "react";
import { motion } from "framer-motion";

const LiquidScoreRing = ({ score = 85, size = 160 }) => {
  const fillLevel = 100 - score; // Percentage to "hide" from top

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 100 100" className="overflow-visible">
        {/* Outer Glass Ring */}
        <circle
          cx="50"
          cy="50"
          r="48"
          fill="none"
          stroke="rgba(255, 255, 255, 0.1)"
          strokeWidth="1"
        />
        
        {/* The Masked Liquid */}
        <defs>
          <clipPath id="liquid-clip">
            <circle cx="50" cy="50" r="46" />
          </clipPath>
        </defs>

        <g clipPath="url(#liquid-clip)">
          {/* Static Background Fill */}
          <rect x="0" y="0" width="100" height="100" fill="rgba(255,255,255,0.05)" />
          
          {/* Animated Wave Liquid */}
          <motion.path
            d="M 0 100 V 50 Q 25 40 50 50 T 100 50 V 100 H 0 Z"
            fill="url(#liquid-gradient)"
            animate={{
              d: [
                "M 0 100 V 50 Q 25 40 50 50 T 100 50 V 100 H 0 Z",
                "M 0 100 V 50 Q 25 60 50 50 T 100 50 V 100 H 0 Z",
                "M 0 100 V 50 Q 25 40 50 50 T 100 50 V 100 H 0 Z"
              ],
              y: `${fillLevel}%`
            }}
            transition={{
              d: { duration: 3, repeat: Infinity, ease: "easeInOut" },
              y: { duration: 1.5, ease: "easeOut" }
            }}
          />
          
          <defs>
            <linearGradient id="liquid-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#6366f1" stopOpacity="0.8" />
              <stop offset="100%" stopColor="#db2777" stopOpacity="0.8" />
            </linearGradient>
          </defs>
        </g>

        {/* Gloss Overlay */}
        <circle
          cx="50"
          cy="50"
          r="46"
          fill="url(#glass-shine)"
          style={{ pointerEvents: 'none' }}
        />
        <defs>
          <radialGradient id="glass-shine" cx="30%" cy="30%" r="50%">
            <stop offset="0%" stopColor="white" stopOpacity="0.1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>

      {/* Centered Score */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
        <span className="text-4xl font-black text-white drop-shadow-lg leading-none">{score}</span>
        <span className="text-[8px] font-black text-white/60 uppercase tracking-[0.2em] mt-1">CEI SCORE</span>
      </div>
    </div>
  );
};

export default LiquidScoreRing;
