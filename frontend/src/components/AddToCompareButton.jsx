"use client";

import { useCompare } from "@/lib/CompareContext";
import "./AddToCompareButton.css";

export default function AddToCompareButton({ college, className = "" }) {
    const { isInCompare, addToCompare, removeFromCompare } = useCompare();
    const active = isInCompare(college.id);

    const handleClick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (active) {
            removeFromCompare(college.id);
        } else {
            addToCompare(college);
        }
    };

    return (
        <button
            className={`compare-btn ${active ? "active" : ""} ${className}`}
            onClick={handleClick}
            title={active ? "Remove from compare" : "Add to compare"}
            aria-label={active ? "Remove from compare" : "Add to compare"}
        >
            <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <path d="M16 3h5v5" />
                <path d="M4 20L21 3" />
                <path d="M21 16v5h-5" />
                <path d="M15 15l5 5" />
                <path d="M4 4l5 5" />
            </svg>
        </button>
    );
}
