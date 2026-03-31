import React from 'react';
import { ShieldCheck, Award, Zap, Database } from 'lucide-react';

const ScoreRow = ({ label, value, color, icon: Icon, description }) => (
  <div className="mb-5 last:mb-0">
    <div className="flex justify-between items-end mb-1.5">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-lg bg-${color}-500/10 text-${color}-400`}>
          <Icon size={16} />
        </div>
        <div>
          <span className="text-white font-bold text-sm block leading-none mb-1">{label}</span>
          <span className="text-slate-500 text-[10px] uppercase tracking-wider font-semibold">{description}</span>
        </div>
      </div>
      <span className={`text-xl font-black text-${color}-400 tabular-nums`}>
        {value?.toFixed(1) || 0}<span className="text-[10px] text-slate-500 ml-0.5">/100</span>
      </span>
    </div>
    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden border border-white/5">
      <div 
        className={`h-full bg-gradient-to-r from-${color}-600 to-${color}-400 transition-all duration-1000 ease-out`}
        style={{ width: `${Math.max(5, value || 0)}%` }}
      />
    </div>
  </div>
);

export default function EvidenceScorecard({ college }) {
  if (!college) return null;

  const {
    institutionStrengthScore: strength = 0,
    admissionRealityScore: reality = 0,
    dataConfidenceScore: confidence = 0,
    coverage = {}
  } = college;

  const signals = [
    { key: 'hasCourses', label: 'Programs' },
    { key: 'hasIntake', label: 'Intake' },
    { key: 'hasPlacements', label: 'Placements' },
    { key: 'hasFees', label: 'Fees' },
    { key: 'hasCutoffs', label: 'Cutoffs' },
    { key: 'hasSeatMatrix', label: 'Seats' }
  ].filter(s => coverage[s.key]);

  return (
    <div className="evidence-scorecard bg-[#0f172a]/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-2xl">
      <div className="flex items-center justify-between mb-8">
        <h4 className="text-white font-black text-sm uppercase tracking-[0.2em] flex items-center gap-2">
          <Zap size={16} className="text-amber-400" /> Intelligence Scorecard
        </h4>
        <div className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
          <span className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">Evidence-First V3</span>
        </div>
      </div>

      <div className="space-y-6">
        <ScoreRow 
          label="Institutional Strength" 
          value={strength} 
          color="indigo" 
          icon={Award}
          description="Registry Status • NIRF Proxy • Scale"
        />
        
        <ScoreRow 
          label="Admission Reality" 
          value={reality} 
          color="amber" 
          icon={Zap}
          description="Cutoff Percentile • Seat Fill Ratio"
        />

        <ScoreRow 
          label="Data Confidence" 
          value={confidence} 
          color="emerald" 
          icon={ShieldCheck}
          description="Provenance • Source Diversification"
        />
      </div>

      {/* Verified Signals Footer */}
      <div className="mt-8 pt-6 border-t border-white/5">
        <div className="flex items-center gap-2 mb-3">
          <Database size={12} className="text-slate-500" />
          <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Verified Data Signals</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {signals.length > 0 ? signals.map(s => (
            <span key={s.key} className="px-2 py-1 bg-white/5 border border-white/10 rounded text-[9px] font-bold text-slate-300 uppercase">
              ✓ {s.label}
            </span>
          )) : (
            <span className="text-slate-600 text-[10px] italic font-medium tracking-tight">Only AISHE Base Data Available</span>
          )}
        </div>
      </div>
    </div>
  );
}
