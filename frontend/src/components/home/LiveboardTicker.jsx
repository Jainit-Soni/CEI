"use client";

import React from "react";
import { 
  Bell, 
  ArrowRight, 
  AlertCircle, 
  Info, 
  Clock, 
  Zap,
  ShieldCheck
} from "lucide-react";
import Link from "next/link";

const LiveboardTicker = () => {
  const alerts = [
    { 
      id: 1, 
      type: "critical", 
      text: "JoSAA 2026 Tentative Schedule released: Registration begins June 10.", 
      tag: "SCHEDULE 2026",
      link: "/colleges"
    },
    { 
      id: 2, 
      type: "warning", 
      text: "CEI Truth-Grade Audit: 42 top-tier institutes flagged for placement inflation.", 
      tag: "AUDIT ALERT",
      link: "/news"
    },
    { 
      id: 3, 
      type: "info", 
      text: "New 'Truth-Rank' algorithm live: ROI now accounts for living costs.", 
      tag: "ALGO UPDATE",
      link: "/roi-calculator"
    },
    { 
      id: 4, 
      type: "critical", 
      text: "IIT Madras CS Cutoff predicted to drop by 4% in 2026 session.", 
      tag: "PREDICTION",
      link: "/admission-calculator"
    },
    { 
      id: 5, 
      type: "info", 
      text: "50+ News updates added to the Registry today: Real-time sync active.", 
      tag: "SYSTEM LIVE",
      link: "/news"
    }
  ];

  // Duplicate alerts for seamless loop
  const displayAlerts = [...alerts, ...alerts];

  return (
    <div className="w-full bg-white/5 border-b border-white/5 backdrop-blur-sm overflow-hidden py-0.5 select-none group">
      <div className="flex animate-marquee-slower whitespace-nowrap hover:[animation-play-state:paused] items-center h-6">
        {displayAlerts.map((alert, idx) => (
          <Link 
            key={`${alert.id}-${idx}`}
            href={alert.link}
            className="flex items-center gap-3 px-8 border-r border-white/5 group/item cursor-pointer"
          >
            <div className={`flex items-center gap-1 px-1.5 py-0 rounded-full text-[7px] font-black uppercase tracking-[0.1em] ${
              alert.type === 'critical' ? 'bg-red-500/10 text-red-500/70 border border-red-500/10' :
              alert.type === 'warning' ? 'bg-amber-500/10 text-amber-500/70 border border-amber-500/10' :
              'bg-blue-500/10 text-blue-500/70 border border-blue-500/10'
            }`}>
              {alert.tag}
            </div>
            
            <span className="text-[11px] font-semibold text-slate-400 group-hover/item:text-slate-900 transition-colors">
              {alert.text}
            </span>
            
            <ArrowRight size={14} className="text-slate-600 group-hover/item:translate-x-1 transition-transform" />
          </Link>
        ))}
      </div>
      
      {/* CSS Animation injection */}
      <style jsx global>{`
        @keyframes marquee-slower {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee-slower {
          animation: marquee-slower 60s linear infinite;
        }
      `}</style>
    </div>
  );
};

export default LiveboardTicker;
