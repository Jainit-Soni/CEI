"use client";

import { useCompare } from "../lib/CompareContext";
import { useRouter } from "next/navigation";
import Button from "./Button";
import "./CompareFloatingBar.css";

export default function CompareFloatingBar() {
    const { compareList, removeFromCompare, setCompareList } = useCompare(); // I'll update context to include setCompareList or clearAll
    const router = useRouter();

    if (compareList.length === 0) return null;

    const clearAll = () => {
        if (setCompareList) setCompareList([]);
        else {
            // Fallback if setCompareList isn't exposed (but I'll add it)
            compareList.forEach(c => removeFromCompare(c.id));
        }
    };

    return (
        <div className="compare-bar-container bounceInUp">
            <div className="compare-bar-glass">
                <div className="compare-items-scroll">
                    {compareList.map(item => (
                        <div key={item.id} className="compare-pill">
                            <span className="pill-name">{item.shortName || item.name}</span>
                            <button
                                className="pill-remove"
                                onClick={() => removeFromCompare(item.id)}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>

                <div className="compare-divider"></div>

                <div className="compare-controls">
                    <div className="compare-info">
                        <span className="compare-count">{compareList.length} / 3</span>
                        <button className="clear-all-btn" onClick={clearAll}>Clear All</button>
                    </div>
                    <button
                        className="compare-submit-btn"
                        onClick={() => router.push("/compare")}
                    >
                        Compare Now
                    </button>
                </div>
            </div>
        </div>
    );
}
