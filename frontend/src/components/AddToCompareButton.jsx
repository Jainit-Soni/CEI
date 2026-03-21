"use client";

import { useComparator } from "@/hooks/useComparator";
import "./AddToCompareButton.css";

export default function AddToCompareButton({ college, className = "", showText = false }) {
    const { pinCollege, unpinCollege, isPinned } = useComparator();
    const isSelected = isPinned(college.id);

    const toggleCompare = (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (isSelected) {
            unpinCollege(college.id);
        } else {
            // Comparator now takes ID only, fetch handles details
            pinCollege(college.id || college._id);
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
