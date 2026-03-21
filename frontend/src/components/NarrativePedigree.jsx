'use client';

import React from 'react';
import { Award, Fingerprint, Book, Users } from 'lucide-react';
import './NarrativePedigree.css';

const NarrativePedigree = ({ college }) => {
  const pedigreeNodes = [
    { label: 'Research Patents', value: '42+ Filed', sub: 'Global Intellectual Property', icon: Fingerprint },
    { label: 'Distinguished Faculty', value: 'Tier-1 Experts', sub: 'PHD Density: 85%', icon: Users },
    { label: 'Publications', value: '1200+', sub: 'Peer Reviewed Journals', icon: Book },
    { label: 'Alumni Network', value: 'Global Reach', sub: 'Fortune 500 Nodes', icon: Award },
  ];

  return (
    <section className="prestige-section narrative-pedigree">
      <div className="section-container">
        <header className="narrative-header" data-aos="fade-up">
          <span className="prestige-subheading">Institutional Lineage</span>
          <h2 className="prestige-heading">Research Pedigree</h2>
          <div className="dossier-stamp">Pedigree Audit: Confirmed</div>
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
              <span className="stat-val">Tier-1</span>
              <span className="stat-label">Research Status</span>
              <div className="stat-glow" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default NarrativePedigree;
