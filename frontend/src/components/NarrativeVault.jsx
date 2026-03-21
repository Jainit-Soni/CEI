'use client';

import React from 'react';
import TruthFeesSection from './college/TruthFeesSection';
import './NarrativeVault.css';

const NarrativeVault = ({ collegeId }) => {
  return (
    <section className="prestige-section narrative-vault">
      <div className="section-container">
        <div className="glass-card-root vault-card">
          <div className="vault-header">
            <span className="prestige-subheading">Financial Transparency</span>
            <h2 className="prestige-heading">Institutional Vault</h2>
            <p className="prestige-body-text vault-intro">
              Access evaluated institutional fee structures and available scholarship pathways. 
              Every figure is audited for investment integrity.
            </p>
          </div>
          
          <div className="vault-content-frame">
            <TruthFeesSection collegeId={collegeId} />
          </div>
        </div>
      </div>
    </section>
  );
};

export default NarrativeVault;
