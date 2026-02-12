"use client";

import { useState, useEffect } from "react";
import "./ROICalculator.css";

const DEFAULT_INITIAL_DATA = {};

export default function ROICalculator({ initialData = DEFAULT_INITIAL_DATA, title = "True ROI Simulator" }) {
    // Hidden defaults
    const [duration, setDuration] = useState(initialData.duration || 2); // MBA usually 2 years
    // NEW: Projection horizon
    const [projectionYears, setProjectionYears] = useState(5);

    // Active Inputs
    const [tuitionPerYear, setTuitionPerYear] = useState(initialData.tuition || 800000);
    const [livingPerMonth, setLivingPerMonth] = useState(15000);
    const [avgPackage, setAvgPackage] = useState(initialData.avgPackage || 1200000);

    const [stats, setStats] = useState(null);

    useEffect(() => {
        calculateStats();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialData]);

    useEffect(() => {
        calculateStats();
    }, [tuitionPerYear, livingPerMonth, avgPackage, duration, projectionYears]);

    const calculateStats = () => {
        // Costs
        const totalFees = tuitionPerYear * duration;
        const totalLiving = livingPerMonth * 12 * duration;
        const totalInvest = totalFees + totalLiving;

        // Progressive Tax Logic
        const calculateInHand = (annual) => {
            if (annual <= 500000) return annual; // No tax
            if (annual <= 1000000) return annual * 0.90; // 10% approx
            if (annual <= 2000000) return annual * 0.80; // 20%
            return annual * 0.70; // 30% for high earners
        };

        const annualInHand = calculateInHand(avgPackage);
        const monthlyInHand = annualInHand / 12;

        // Dynamic Horizon with Inflation Discounting (6%)
        const yearsToProject = projectionYears;
        const inflationRate = 0.06;
        const hikeRate = 0.10;

        let totalEarnings = 0;
        let nominalEarnings = 0;

        for (let i = 0; i < yearsToProject; i++) {
            const currentYearNominal = annualInHand * Math.pow(1 + hikeRate, i);
            nominalEarnings += currentYearNominal;

            // Discount back to present value (Real Value)
            const currentYearReal = currentYearNominal / Math.pow(1 + inflationRate, i);
            totalEarnings += currentYearReal;
        }

        // Multiplier based on Real Value
        const multiplier = (totalEarnings / totalInvest).toFixed(1);

        // ROI Score
        const score = Math.min(100, Math.max(0, (multiplier / projectionYears) * 100));

        setStats({
            totalInvest,
            totalFees,
            totalLiving,
            monthlyInHand,
            annualInHand,
            multiplier,
            score,
            totalEarnings: Math.round(totalEarnings),
            nominalEarnings: Math.round(nominalEarnings),
            taxRate: Math.round((1 - (annualInHand / avgPackage)) * 100)
        });
    };

    const formatMoney = (amount) => {
        if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
        if (amount >= 100000) return `₹${(amount / 100000).toFixed(2)} L`;
        return `₹${amount.toLocaleString()}`;
    };

    // Scenarios
    const setScenario = (type) => {
        const basePkg = initialData.avgPackage || 1200000;
        if (type === 'opt') setAvgPackage(basePkg * 1.3);
        else if (type === 'pes') setAvgPackage(basePkg * 0.8);
        else setAvgPackage(basePkg);
    };

    return (
        <div className="premium-tab-card roi-container">
            <div className="roi-header">
                <div>
                    <h3>{title}</h3>
                    <p className="roi-subtitle">Simulate your financial future. Calculate break-even time and real disposable income.</p>
                </div>
                <div className="roi-toggles">
                    <button onClick={() => setScenario('pes')} className="toggle-btn pes">Conservative</button>
                    <button onClick={() => setScenario('std')} className="toggle-btn std">Realistic</button>
                    <button onClick={() => setScenario('opt')} className="toggle-btn opt">Optimistic</button>
                </div>
            </div>

            <div className="roi-grid">
                {/* Visual Card */}
                <div className="roi-visual-card">
                    <div className="multiplier-badge">
                        <span className="mult-label">{projectionYears}-Year Wealth Multiplier (Real)</span>
                        <div className="mult-value">{stats?.multiplier || "0.0"}x</div>
                        <span className="mult-sub">Returns {stats?.multiplier}x your investment in real value</span>
                    </div>

                    <div className="gauge-container">
                        <div className="gauge-bg"></div>
                        <div className="gauge-fill" style={{ transform: `rotate(${((stats?.score || 0) * 1.8) - 90}deg)` }}></div>
                        <div className="gauge-center">
                            <span className="emoji">{stats?.multiplier > (projectionYears * 0.6) ? '🚀' : '⚖️'}</span>
                        </div>
                    </div>
                </div>

                {/* Stats & Inputs */}
                <div className="roi-details">
                    <div className="stat-row">
                        <div className="stat-item red">
                            <span className="s-lbl">Total Investment</span>
                            <span className="s-val">{formatMoney(stats?.totalInvest || 0)}</span>
                        </div>
                        <div className="stat-arrow">➔</div>
                        <div className="stat-item green">
                            <span className="s-lbl">{projectionYears}-Year Real Wealth</span>
                            <span className="s-val">{formatMoney(stats?.totalEarnings || 0)}</span>
                        </div>
                    </div>

                    <div className="roi-inputs">
                        <div className="input-group">
                            <label>Avg Package (LPA)</label>
                            <div className="range-row">
                                <input
                                    type="range" min="300000" max="5000000" step="50000"
                                    value={avgPackage} onChange={e => setAvgPackage(Number(e.target.value))}
                                />
                                <span className="range-val">{formatMoney(avgPackage)}</span>
                            </div>
                        </div>

                        <div className="input-group">
                            <label>Total Tuition (Yearly)</label>
                            <div className="range-row">
                                <input
                                    type="range" min="50000" max="1500000" step="10000"
                                    value={tuitionPerYear} onChange={e => setTuitionPerYear(Number(e.target.value))}
                                />
                                <span className="range-val">{formatMoney(tuitionPerYear)}</span>
                            </div>
                        </div>

                        <div className="input-group">
                            <label>Time Horizon (Years)</label>
                            <div className="range-row">
                                <input
                                    type="range" min="1" max="15" step="1"
                                    value={projectionYears} onChange={e => setProjectionYears(Number(e.target.value))}
                                    style={{ accentColor: '#8b5cf6' }}
                                />
                                <span className="range-val">{projectionYears} Years</span>
                            </div>
                        </div>

                        <div className="input-split-row">
                            <div className="input-group">
                                <label>Monthly Living</label>
                                <div className="range-row compact">
                                    <input
                                        type="range" min="5000" max="50000" step="1000"
                                        value={livingPerMonth} onChange={e => setLivingPerMonth(Number(e.target.value))}
                                    />
                                    <span className="range-val">{formatMoney(livingPerMonth)}</span>
                                </div>
                            </div>
                            <div className="input-group">
                                <label>Course Duration</label>
                                <div className="range-row compact">
                                    <input
                                        type="number" min="1" max="5"
                                        value={duration} onChange={e => setDuration(Number(e.target.value))}
                                        className="num-input"
                                    />
                                    <span className="range-val-static">Years</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="roi-note">
                        *Projection includes 10% annual salary hike and inflation adjustments.
                    </div>
                </div>
            </div>

            {/* Analysis Breakdown Section */}
            <div className="roi-breakdown">
                <h4>Calculation Analysis 📊</h4>
                <div className="breakdown-grid">
                    <div className="breakdown-col">
                        <h5>Investment (Cost)</h5>
                        <ul className="math-list">
                            <li>Tuition: {formatMoney(stats?.totalFees || 0)} <span className="math-op">(Yearly x {duration})</span></li>
                            <li>Living: {formatMoney(stats?.totalLiving || 0)} <span className="math-op">(Monthly x 12 x {duration})</span></li>
                            <li className="math-total">Total Invested: {formatMoney(stats?.totalInvest || 0)}</li>
                        </ul>
                    </div>
                    <div className="breakdown-col">
                        <h5>Earnings (Real Return)</h5>
                        <ul className="math-list">
                            <li>Package: {formatMoney(avgPackage)} <span className="math-op">(Nominal)</span></li>
                            <li>Tax/Deductions: <span className="negative">-{stats?.taxRate}%</span> <span className="math-op">(Effective)</span></li>
                            <li>Inflation Discount: <span className="negative">-6%</span> <span className="math-op">(Compounded)</span></li>
                            <li className="math-total">Real Asset Value: {formatMoney(stats?.totalEarnings || 0)}</li>
                        </ul>
                    </div>
                </div>
                <div className="calculation-logic">
                    <strong>The Logic:</strong> We project your income with a 10% annual hike (Nominal: {formatMoney(stats?.nominalEarnings || 0)}),
                    but adjust it for 6% inflation to show you the <strong>Real value</strong> in today's money.
                    This is why our Multiplier may seem lower than basic calculators—it shows the truth.
                </div>
            </div>

            {/* Why This Matters Section */}
            <div className="roi-education">
                <h4>Why this matters?</h4>
                <p className="roi-edu-intro">
                    A high placement package (e.g., 10 LPA) might seem great, but if the fees are astronomical (e.g., 25 Lakhs),
                    your <strong>Real Income</strong> after EMI might be lower than someone with a 6 LPA package from a cheaper college.
                </p>

                <div className="roi-definitions">
                    <div className="def-item">
                        <strong>Break-Even Point:</strong>
                        <p>The moment you recover your total investment (Fees + Living).</p>
                    </div>
                    <div className="def-item">
                        <strong>Disposable Income:</strong>
                        <p>What you actually take home after paying your Loan EMI and Taxes.</p>
                    </div>
                    <div className="def-item">
                        <strong>Opportunity Cost:</strong>
                        <p>The income you lost while studying (relevant for Masters/MBA).</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
