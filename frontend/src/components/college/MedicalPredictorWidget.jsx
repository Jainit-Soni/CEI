'use client';

import React, { useState } from 'react';
import { Target, ShieldCheck, AlertCircle, Calculator, Info, MapPin, TrendingUp, TrendingDown, Minus, Database } from 'lucide-react';
import { fetchMedicalPredictions } from '@/lib/api';
import './MedicalPredictorWidget.css';

/**
 * MedicalPredictorWidget (v3.2 - Policy Governed)
 * ===============================================
 * Features conditional rendering based on Exposure Policy.
 */
const MedicalPredictorWidget = ({ initialQuota, initialCategory, programType = 'MBBS', targetCollegeId }) => {
  const [rank, setRank] = useState('');
  const [quota, setQuota] = useState(initialQuota || 'All India');
  const [category, setCategory] = useState(initialCategory || 'OPEN');
  const [stateFilter, setStateFilter] = useState('All');
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredReason, setHoveredReason] = useState(null);

  const handlePredict = async () => {
    if (!rank || isNaN(rank)) return;
    setIsLoading(true);
    try {
      const data = await fetchMedicalPredictions({ 
        rank, 
        quota, 
        category, 
        state: stateFilter,
        programType 
      });
      setResults(data);
    } catch (err) {
      console.error("Prediction failed", err);
    } finally {
      setIsLoading(false);
    }
  };

  const renderTrendIcon = (trend) => {
    if (trend.signal === 'tightening') return <TrendingUp size={12} className="text-rose-400" />;
    if (trend.signal === 'loosening') return <TrendingDown size={12} className="text-emerald-400" />;
    return <Minus size={12} className="text-blue-400" />;
  };

  const renderCollegeList = (list, type) => {
    if (list.length === 0) return null;
    return (
      <div className={`prediction-group ${type}`}>
        <div className="group-header">
          {type === 'safe' && <ShieldCheck size={18} className="text-emerald-500" />}
          {type === 'realistic' && <Target size={18} className="text-blue-500" />}
          {type === 'risky' && <AlertCircle size={18} className="text-amber-500" />}
          <h4 className="capitalize">{type} Outcome Vectors</h4>
        </div>
        <div className="group-list">
          {list.slice(0, 10).map((item, idx) => {
            const { exposurePolicy } = item;
            return (
              <div 
                  key={idx} 
                  className={`prediction-item ${item.id === targetCollegeId ? 'target-highlight' : ''}`}
                  onMouseEnter={() => setHoveredReason(item.reason.interpretation)}
                  onMouseLeave={() => setHoveredReason(null)}
              >
                <div className="item-main">
                  <div className="item-identity">
                      <span className="college-name">{item.name}</span>
                      <div className="item-badges">
                          {item.confidence === 'RECOVERY' ? (
                              <span className="confidence-pill low">RECOVERY</span>
                          ) : (
                              <span className="confidence-pill high">TIER 1</span>
                          )}
                          {exposurePolicy.show.stability && item.stability === 'LOW' && (
                              <span className="stability-pill volatile">VOLATILE</span>
                          )}
                      </div>
                  </div>
                  <div className="item-meta">
                      <span className="location-tag"><MapPin size={10} /> {item.state}</span>
                      {exposurePolicy.show.percentiles && (
                        <span className="cutoff-stats">p50: {item.stats.p50.toLocaleString()}</span>
                      )}
                      {exposurePolicy.show.trend && (
                        <div className={`trend-badge ${item.trend.signal}`}>
                            {renderTrendIcon(item.trend)}
                            <span>{item.trend.label}</span>
                        </div>
                      )}
                      {!exposurePolicy.show.trend && (
                        <div className="trend-badge insufficient">
                            <Database size={10} />
                            <span>{exposurePolicy.label}</span>
                        </div>
                      )}
                  </div>
                  {exposurePolicy.warning && (
                    <div className="item-warning">
                        <AlertCircle size={10} /> {exposurePolicy.warning}
                    </div>
                  )}
                </div>
                <div className="item-action">
                  <Info size={14} className="info-icon" />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="medical-predictor-widget glass-card-root">
      <header className="predictor-header">
        <Calculator size={20} className="text-indigo-400" />
        <div className="header-text">
            <h3>Medical Admission Strategic Predictor</h3>
            <span className="header-badge">v3.2 Statistical Analysis</span>
        </div>
      </header>

      <div className="predictor-controls">
        <div className="input-group">
          <label>NEET UG Rank</label>
          <input 
            type="number" 
            placeholder="All India Rank" 
            value={rank} 
            onChange={(e) => setRank(e.target.value)}
          />
        </div>
        <div className="input-group">
          <label>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="OPEN">General</option>
            <option value="OBC">OBC</option>
            <option value="SC">SC</option>
            <option value="ST">ST</option>
            <option value="EWS">EWS</option>
          </select>
        </div>
        <div className="input-group">
          <label>Preferred State</label>
          <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
            <option value="All">All of India</option>
            <option value="Gujarat">Gujarat</option>
            <option value="Maharashtra">Maharashtra</option>
            <option value="Delhi">Delhi</option>
            <option value="Karnataka">Karnataka</option>
            <option value="Tamil Nadu">Tamil Nadu</option>
          </select>
        </div>
        <button className="predict-btn" onClick={handlePredict} disabled={isLoading}>
          {isLoading ? 'Aggregating Outcome Vectors...' : 'Execute v3.2 Strategic Model'}
        </button>
      </div>

      {hoveredReason && (
        <div className="explanation-tooltip animate-fade-in">
            <Info size={14} /> {hoveredReason}
        </div>
      )}

      {results && (
        <div className="prediction-results animate-fade-in">
          <div className="results-summary">
            Statistical Analysis for Rank {results.meta.userRank.toLocaleString()}. 
            Processed {results.safe.length + results.realistic.length + results.risky.length} eligible pathways.
          </div>
          {renderCollegeList(results.safe, 'safe')}
          {renderCollegeList(results.realistic, 'realistic')}
          {renderCollegeList(results.risky, 'risky')}
        </div>
      )}
    </div>
  );
};

export default MedicalPredictorWidget;
