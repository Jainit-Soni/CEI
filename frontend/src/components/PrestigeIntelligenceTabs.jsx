'use client';

import React, { useState } from 'react';
import './PrestigeIntelligenceTabs.css';

const PrestigeIntelligenceTabs = ({ tabs, activeTab, onTabChange }) => {
  return (
    <div className="prestige-tabs-wrapper">
      <div className="tabs-nav-matrix">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`matrix-tab-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            <span className="tab-glimmer" />
            <div className="tab-content">
              <span className="tab-index">0{tabs.indexOf(tab) + 1}</span>
              <span className="tab-label">{tab.label}</span>
            </div>
            {activeTab === tab.id && <div className="tab-indicator-bar" />}
          </button>
        ))}
      </div>
    </div>
  );
};

export default PrestigeIntelligenceTabs;
