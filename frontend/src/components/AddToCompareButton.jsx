"use client";

import { useComparator } from "@/hooks/useComparator";
import "./AddToCompareButton.css";

export default function AddToCompareButton({ college, className = "", showText = false }) {
    const { pinCollege, unpinCollege, isPinned, pinnedIds } = useComparator();
    const cid = String(college.id || college._id || college.stableKey || "");
    const isSelected = isPinned(cid);
    const isFull = pinnedIds.length >= 5;

    const toggleCompare = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!cid) return;

        if (isSelected) {
            unpinCollege(cid);
        } else if (!isFull) {
            pinCollege(cid, college.shortName || college.name);
        }
    };

    const getTitle = () => {
        if (isSelected) return "Remove from Compare";
        if (isFull) return "Battle Arena Full (Max 5)";
        return "Add to Compare";
    };

    return (
        <button
            className={`compare-btn ${isSelected ? "active" : ""} ${isFull && !isSelected ? "full" : ""} ${className}`}
            onClick={toggleCompare}
            title={getTitle()}
            disabled={isFull && !isSelected}
        >
            <span className="compare-icon">
                {isSelected ? "✓" : isFull ? "✕" : "+"}
            </span>
            {showText && (
                <span className="compare-text">
                    {isSelected ? "Added" : isFull ? "Full" : "Compare"}
                </span>
            )}
        </button>
    );
}
