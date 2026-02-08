"use client";

import { useState, useEffect } from "react";
import GlassPanel from "./GlassPanel";
import "./ROICalculator.css";

export default function ROICalculator({ initialData = {}, title = "True ROI Calculator" }) {
    // Defaults
    const [tuitionPerYear, setTuitionPerYear] = useState(initialData.tuition || 150000);
    const [duration, setDuration] = useState(initialData.duration || 4); // years
    const [livingPerMonth, setLivingPerMonth] = useState(12000);
    const [avgPackage, setAvgPackage] = useState(initialData.avgPackage || 600000); // LPA
    const [loanInterest, setLoanInterest] = useState(9.5); // %

    const [results, setResults] = useState(null);

    useEffect(() => {
        calculateROI();
    }, [initialData]); // Recalculate if props change

    const calculateROI = () => {
        // 1. Total Cost
        const totalTuition = tuitionPerYear * duration;
        const totalLiving = livingPerMonth * 12 * duration;
        const principal = totalTuition + totalLiving;

        // 2. Loan Dynamics (Simple Amortization Estimate)
        // Assuming loan for 100% of cost for worst case, or user can adjust.
        // Let's assume standard loan for total cost.
        const monthlyRate = loanInterest / 12 / 100;
        // Standard tenure 7 years (84 months) for calculation of EMI obligation
        const tenureMonths = 84;
        const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) / (Math.pow(1 + monthlyRate, tenureMonths) - 1);

        // 3. Earnings
        const inHandMonthly = (avgPackage * 0.85) / 12; // Deducting ~15% for tax/PF roughly
        const disposableIncomeString = inHandMonthly - Math.max(15000, livingPerMonth * 1.2); // Living cost increases after college
        const disposableIncome = Math.max(0, disposableIncomeString);

        // 4. Break Even
        // How many months of *Disposable Income* to pay back the Principal + Interest accrued *during college*?
        // Actually, simpler metric: How many months of *Full In-Hand Salary* to recover Total Cost? (Standard ROI metric)
        const monthsToRecoverCost = principal / inHandMonthly;
        const yearsToRecover = monthsToRecoverCost / 12;

        setResults({
            totalCost: principal,
            breakEvenYears: yearsToRecover.toFixed(1),
            emi: Math.round(emi),
            inHand: Math.round(inHandMonthly),
            verdict: getVerdict(yearsToRecover)
        });
    };

    const getVerdict = (years) => {
        if (years < 1.5) return { text: "💎 Excellent Investment", color: "text-emerald-600", bg: "bg-emerald-50" };
        if (years < 3) return { text: "✅ Good Returns", color: "text-blue-600", bg: "bg-blue-50" };
        if (years < 5) return { text: "⚠️ Moderate Risk", color: "text-yellow-600", bg: "bg-yellow-50" };
        return { text: "🛑 High Financial Burden", color: "text-red-600", bg: "bg-red-50" };
    };

    return (
        <GlassPanel className="roi-calculator" variant="subtle">
            <div className="roi-header">
                <h3>{title}</h3>
                <span className="roi-badge">Financial Intelligence</span>
            </div>

            <div className="roi-grid">
                {/* Left: Inputs */}
                <div className="roi-inputs">
                    <div className="input-group">
                        <label>Tuition Fees (Yearly)</label>
                        <input
                            type="number"
                            value={tuitionPerYear}
                            onChange={(e) => setTuitionPerYear(Number(e.target.value))}
                        />
                    </div>
                    <div className="input-group">
                        <label>Course Duration (Years)</label>
                        <input
                            type="number"
                            value={duration}
                            onChange={(e) => setDuration(Number(e.target.value))}
                            min="1"
                            max="6"
                        />
                    </div>
                    <div className="input-group">
                        <label>Living Cost (Monthly)</label>
                        <input
                            type="number"
                            value={livingPerMonth}
                            onChange={(e) => setLivingPerMonth(Number(e.target.value))}
                        />
                    </div>
                    <div className="input-group">
                        <label>Avg Package (LPA)</label>
                        <input
                            type="number"
                            value={avgPackage}
                            onChange={(e) => setAvgPackage(Number(e.target.value))}
                        />
                    </div>
                    <button className="btn-calc" onClick={calculateROI}>Recalculate</button>
                </div>

                {/* Right: Results */}
                {results && (
                    <div className="roi-results">
                        <div className={`verdict-box ${results.verdict.bg}`}>
                            <span className={`verdict-text ${results.verdict.color}`}>
                                {results.verdict.text}
                            </span>
                            <span className="verdict-sub">Based on estimated break-even time</span>
                        </div>

                        <div className="metrics-grid">
                            <div className="metric">
                                <span className="metric-label">Total Investment</span>
                                <span className="metric-value">₹{(results.totalCost / 100000).toFixed(2)} Lakhs</span>
                            </div>
                            <div className="metric">
                                <span className="metric-label">Break-Even Time</span>
                                <span className="metric-value highlight">{results.breakEvenYears} Years</span>
                            </div>
                            <div className="metric">
                                <span className="metric-label">Est. Monthly In-Hand</span>
                                <span className="metric-value">₹{results.inHand.toLocaleString()}</span>
                            </div>
                            <div className="metric">
                                <span className="metric-label">Est. Loan EMI</span>
                                <span className="metric-value">₹{results.emi.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </GlassPanel>
    );
}
