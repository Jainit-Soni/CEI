'use client';

import React from 'react';
import { Newspaper, Trophy, BookOpen, GraduationCap } from 'lucide-react';
import './NarrativeIntel.css';

const NarrativeIntel = ({ college }) => {
  // Real data ingestion
  const rankings = (college.rankings && college.rankings.length > 0) 
    ? college.rankings 
    : [];

  const departments = (college.courses && college.courses.length > 0) 
    ? [...new Set(college.courses.map(c => c.department || c.degreeNameType || 'Academic Module'))].slice(0, 8)
    : [];

  const ceiScore = college.ceiScore != null && Number.isFinite(Number(college.ceiScore)) ? Number(college.ceiScore) : null;

  return (
    <section className="prestige-section narrative-intel">
      <div className="section-container">
        <div className="glass-card-root score-card">
          <div className="score-hero">
            <div className="score-meter">
               <div className="meter-value" style={{ width: `${ceiScore || 0}%` }}></div>
               <div className="meter-label" style={{ fontSize: ceiScore === null ? '1.2rem' : 'inherit', textAlign: 'center' }}>
                   {ceiScore !== null ? ceiScore.toFixed(1) : 'Score pending verification'}
               </div>
            </div>
            <header className="narrative-header">
              <span className="prestige-subheading">Institutional Score</span>
              <h2 className="prestige-heading">CEI Intelligence Analysis</h2>
              <p className="prestige-body-text">
                A weighted calculation of institutional rigor, competitive standing, and academic infrastructure.
              </p>
            </header>
          </div>

          <div className="intel-grid">
            {/* Rankings Pillar */}
            <div className="intel-pillar rankings-pillar">
              <div className="pillar-label">
                <Trophy size={18} color="var(--color-accent)" />
                <span>Institutional Standing</span>
              </div>
              <div className="editorial-table-container">
                <table className="editorial-table">
                  <thead>
                    <tr>
                      <th>Authority</th>
                      <th>Category</th>
                      <th>Rank</th>
                      <th>Year</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rankings.length > 0 ? rankings.map((rank, i) => (
                      <tr key={i}>
                        <td>{rank.source || rank.rankingAuthority}</td>
                        <td className="text-secondary">{rank.category || 'Overall'}</td>
                        <td className="text-accent font-bold">{rank.rank || rank.rankValue}</td>
                        <td>{rank.year || rank.rankingYear}</td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="4" className="data-empty-tag">Official Ranking Data Pending Audit</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Academic Architecture */}
            <div className="intel-pillar architecture-pillar">
              <div className="pillar-label">
                <BookOpen size={18} color="var(--color-accent)" />
                <span>Academic Architecture</span>
              </div>
              <div className="dept-grid">
                {departments.length > 0 ? departments.map((dept, i) => (
                  <div key={i} className="dept-tag">
                    <GraduationCap size={14} />
                    <span>{dept}</span>
                  </div>
                )) : (
                  <div className="data-empty-tag">Course Catalog Under Verification</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NarrativeIntel;
