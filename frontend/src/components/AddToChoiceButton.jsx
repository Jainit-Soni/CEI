"use client";

import { useState, useEffect } from "react";
import { PlusCircle, CheckCircle2 } from "lucide-react";
import "./AddToChoiceButton.css";

export default function AddToChoiceButton({ college, className = "" }) {
    const [added, setAdded] = useState(false);

    useEffect(() => {
        // Check if already in list
        const stored = localStorage.getItem("choice-filling-cart");
        if (stored) {
            try {
                const list = JSON.parse(stored);
                if (Array.isArray(list) && list.some(c => c.id === college.id)) {
                    setAdded(true);
                }
            } catch (e) {
                console.error("Failed to parse list", e);
            }
        }
    }, [college.id]);

    const toggleList = (e) => {
        e.preventDefault();
        e.stopPropagation();

        const stored = localStorage.getItem("choice-filling-cart");
        let list = [];
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed)) list = parsed;
            } catch (e) {
                console.error("Failed to parse list", e);
            }
        }

        if (added) {
            // Remove
            const newList = list.filter(c => c.id !== college.id);
            localStorage.setItem("choice-filling-cart", JSON.stringify(newList));
            setAdded(false);
        } else {
            // Add (Double Check for Duplicates)
            if (!list.some(c => c.id === college.id)) {
                // Prepare clean object
                const newItem = {
                    id: college.id,
                    name: college.name,
                    shortName: college.shortName,
                    rankingTier: college.rankingTier,
                    location: college.location,
                    placements: college.placements,
                    tuition: college.tuition,
                    acceptedExams: college.acceptedExams,
                    addedAt: new Date().toISOString()
                };
                list.push(newItem);
                localStorage.setItem("choice-filling-cart", JSON.stringify(list));
                setAdded(true);
            }
        }

        // Dispatch Event
        window.dispatchEvent(new Event("local-storage-update"));
    };

    return (
        <button
            onClick={toggleList}
            className={`add-list-btn ${added ? "added" : ""} ${className}`}
            title={added ? "Remove from List" : "Add to Priority List"}
        >
            {added ? (
                <>
                    <CheckCircle2 size={16} />
                    <span>Added</span>
                </>
            ) : (
                <>
                    <PlusCircle size={16} />
                    <span>Add to User List</span>
                </>
            )}
        </button>
    );
}
