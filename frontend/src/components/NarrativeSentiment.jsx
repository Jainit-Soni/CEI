'use client';

import React from 'react';
import { ShieldCheck, Info, CheckCircle2, AlertCircle, TrendingUp, IndianRupee } from 'lucide-react';
import LiquidScoreRing from './animations/LiquidScoreRing';
import './NarrativeSentiment.css';

const NarrativeSentiment = ({ college, benchmarks }) => {
  // Algorithmic Fact Extraction
  const integrityScore = college.ceiScore ? Number(college.ceiScore).toFixed(2) : 0;

  return (
    <section className="prestige-section narrative-sentiment truth-audit-section">
      <div className="section-container">
        <div className="glass-card-root sentiment-card audit-summary-card">
          <header className="narrative-header mb-10">
            <span className="prestige-subheading flex items-center gap-2">
              <ShieldCheck size={14} className="text-blue-400" />
              Algorithmic Transparency
            </span>
            <h2 className="prestige-heading">CEI Score Calculation Breakdown</h2>
            <p className="text-slate-500 max-w-2xl mt-2 font-medium">
              We've unpacked the exact algorithmic parameters and verified truth signals that construct this institution's unique rating.
            </p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
            {/* Integrity Score */}
            <div className="lg:col-span-4 p-8 rounded-3xl bg-white/[0.03] border border-white/10 flex flex-col items-center justify-center min-h-[350px]">
              <LiquidScoreRing score={integrityScore} size={220} />
              <div className="mt-8 text-center">
                <h4 className="font-bold text-white mb-2 uppercase tracking-widest text-[10px]">Unified CEI Score</h4>
                <p className="text-[10px] text-slate-500 leading-relaxed max-w-[200px] mx-auto">
                  Consolidated algorithmic standing against {benchmarks?.metadata?.state || 'National'} benchmarks.
                </p>
              </div>
            </div>

            {/* Columnar Breakdown */}
            <div className="lg:col-span-8 flex flex-col gap-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Institution Base Strength (70%) */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-400 mb-6 flex items-center gap-2">
                    <TrendingUp size={12} /> Base Strength (70% Weight)
                  </h4>
                  <div className="p-5 rounded-2xl border border-blue-500/10 bg-blue-500/[0.03] backdrop-blur-md">
                     <div className="flex items-baseline gap-2 mb-6">
                       <span className="text-3xl font-black text-white">{college.institutionStrengthScore ? Number(college.institutionStrengthScore).toFixed(2) : Number(college.ceiScore || 0).toFixed(2)}</span>
                       <span className="text-[10px] font-bold text-blue-500/60 uppercase tracking-widest">/ 100.00</span>
                     </div>
                     <div className="space-y-4">
                        <div className="flex justify-between items-center text-[10px] font-bold border-b border-white/5 pb-3">
                           <span className="text-slate-400 uppercase tracking-wider">Registry Status</span>
                           <span className={college.isCore ? "text-green-400" : "text-slate-500"}>{college.isCore ? 'Elite Core' : 'Standard'}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-bold border-b border-white/5 pb-3">
                           <span className="text-slate-400 uppercase tracking-wider">Ranking Tier</span>
                           <span className={college.rankingTier === 'Tier 1' || college.coreMetadata?.coreTier === 1 ? "text-green-400" : "text-slate-500"}>{college.rankingTier || (college.coreMetadata?.coreTier === 1 ? 'Tier 1' : 'Unranked')}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-bold border-b border-white/5 pb-3">
                           <span className="text-slate-400 uppercase tracking-wider">Program Breadth</span>
                           <span className="text-white">{college.courses?.length || 0} Evaluated</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-bold pb-1">
                           <span className="text-slate-400 uppercase tracking-wider">Verified Placements</span>
                           <span className={college.coverage?.hasPlacements ? "text-green-400" : "text-red-400"}>{college.coverage?.hasPlacements ? 'Active' : 'Missing'}</span>
                        </div>
                     </div>
                  </div>
                </div>

                {/* Data Confidence Index (30%) */}
                <div className="space-y-4">
                  <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-6 flex items-center gap-2">
                    <ShieldCheck size={12} /> Confidence Index (30% Weight)
                  </h4>
                  <div className="p-5 rounded-2xl border border-indigo-500/10 bg-indigo-500/[0.03] backdrop-blur-md">
                     <div className="flex items-baseline gap-2 mb-6">
                       <span className="text-3xl font-black text-white">{college.dataConfidenceScore ? Number(college.dataConfidenceScore).toFixed(2) : Number(college.ceiScore || 0).toFixed(2)}</span>
                       <span className="text-[10px] font-bold text-indigo-500/60 uppercase tracking-widest">/ 100.00</span>
                     </div>
                     <div className="space-y-4">
                        <div className="flex justify-between items-center text-[10px] font-bold border-b border-white/5 pb-3">
                           <span className="text-slate-400 uppercase tracking-wider">Truth Audit Rows</span>
                           <span className="text-white">{college.coverage?.truthRowCount || 0} Signals</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-bold border-b border-white/5 pb-3">
                           <span className="text-slate-400 uppercase tracking-wider">Source Diversity</span>
                           <span className="text-white">{college.coverage?.sourceFamilies?.length || 0} Families</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-bold border-b border-white/5 pb-3">
                           <span className="text-slate-400 uppercase tracking-wider">Verification Status</span>
                           <span className={college.verificationStatus === 'VERIFIED' ? "text-green-400" : "text-slate-500"}>{college.verificationStatus || 'Pending'}</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-bold pb-1">
                           <span className="text-slate-400 uppercase tracking-wider">Coverage Bucket</span>
                           <span className={college.coverage?.coverageBucket === 'Rich' ? "text-green-400" : college.coverage?.coverageBucket === 'Partial' ? "text-amber-400" : "text-slate-500"}>{college.coverage?.coverageBucket || 'None'}</span>
                        </div>
                     </div>
                  </div>
                </div>
              </div>
              
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 flex items-center gap-3">
                <Info size={16} className="text-blue-400 flex-shrink-0" />
                <p className="text-[10px] text-slate-500 italic leading-snug">
                  The final CEI Score is an algorithmic synthesis (CEI Internal Methodology) of the Base Strength ({college.institutionStrengthScore ? Number(college.institutionStrengthScore).toFixed(2) : '0.00'}) and Data Confidence Index ({college.dataConfidenceScore ? Number(college.dataConfidenceScore).toFixed(2) : '0.00'}). This ensures UI simplicity while maintaining underlying evidence-based precision.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NarrativeSentiment;
