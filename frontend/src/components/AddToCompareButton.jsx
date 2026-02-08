"use client";

import { useCompare } from "../lib/CompareContext";
import "./AddToCompareButton.css";

export default function AddToCompareButton({ college, className = "", showText = false }) {
    const { addToCompare, removeFromCompare, isInCompare } = useCompare();
    const isSelected = isInCompare(college.id);

    const toggleCompare = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (isSelected) {
            removeFromCompare(college.id);
        } else {
            addToCompare(college);
        }
    };

    return (
        <button
            className={`compare-btn ${isSelected ? "active" : ""} ${className}`}
            onClick={toggleCompare}
            title={isSelected ? "Remove from Compare" : "Add to Compare"}
        >
            <span className="compare-icon">{isSelected ? "✓" : "+"}</span>
            {showText && <span className="compare-text">{isSelected ? "Added" : "Compare"}</span>}
        </button>
    );
}
