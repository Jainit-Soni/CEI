'use client';

import React from 'react';
import { Award } from 'lucide-react';
import './NarrativePedigree.css';

const NarrativePedigree = ({ college }) => {
  // --- Live Truth Integration ---
  const hasRankings = college.rankings && Array.isArray(college.rankings) && college.rankings.length > 0;
  
  // Best Rank Calculation (Minimum numeric value = best rank)
  const bestRank = hasRankings 
    ? Math.min(...college.rankings.map(r => parseInt(r.rank)).filter(r => !isNaN(r)))
    : null;

  // Generate dynamic pedigree nodes based on live truth
  const pedigreeNodes = hasRankings 
    ? college.rankings.map(r => ({
        label: `${r.source || 'Official'} Ranking`,
        value: `#${r.rank}`,
        sub: `${r.category || 'Institutional'} Category | ${r.year || '2024'}`,
        icon: Award
      }))
    : [
        { 
          label: 'Data Integrity', 
          value: 'Audit Pending', 
          sub: 'Verified institutional lineage in progress.', 
          icon: Award 
        }
      ];

  return (
    <section className="prestige-section narrative-pedigree">
      <div className="section-container">
        <header className="narrative-header" data-aos="fade-up">
          <span className="prestige-subheading">Institutional Lineage</span>
          <h2 className="prestige-heading">Research Pedigree</h2>
          <div className="dossier-stamp">
            {hasRankings ? 'Status: Rankings Verified' : 'Status: Data Audit Pending'}
          </div>
        </header>

        <div className="pedigree-flex">
          <div className="pedigree-content">
            <p className="pedigree-intro">
              The institutional lineage of {college.name} is defined by a consistent protocol of 
              high-impact research and global intellectual contribution.
            </p>
            <div className="pedigree-grid">
              {pedigreeNodes.map((node, i) => (
                <div key={i} className="pedigree-node" data-aos="fade-right" data-aos-delay={i * 150}>
                  <div className="node-icon-box"><node.icon size={20} /></div>
                  <div className="node-info">
                    <span className="node-label">{node.label}</span>
                    <span className="node-value">{node.value}</span>
                    <span className="node-sub">{node.sub}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="pedigree-hero-stat" data-aos="zoom-in">
            <div className="stat-circle">
              <span className="stat-val">
                {bestRank ? `#${bestRank}` : 'PENDING'}
              </span>
              <span className="stat-label">
                {bestRank ? 'Best Authority Rank' : 'Evaluation Progress'}
              </span>
              <div className="stat-glow" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NarrativePedigree;
