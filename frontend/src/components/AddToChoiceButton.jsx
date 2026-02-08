"use client";

import { useState, useEffect } from "react";
import Button from "./Button";

export default function AddToChoiceButton({ college, variant = "secondary", className = "" }) {
    const [added, setAdded] = useState(false);

    useEffect(() => {
        // Check if already in list (using flat list for quick check)
        const stored = localStorage.getItem("choice-filling-cart");
        if (stored) {
            const list = JSON.parse(stored);
            if (list.some(c => c.id === college.id)) {
                setAdded(true);
            }
        }
    }, [college.id]);

    const toggleList = () => {
        // 1. Get Kanban State
        const kanbanRaw = localStorage.getItem("application-kanban");
        let kanban = kanbanRaw ? JSON.parse(kanbanRaw) : {
            shortlisted: [],
            applying: [],
            applied: [],
            interview: [],
            offer: [],
            rejected: []
        };

        // 2. Determine Action
        let isRemoving = false;

        // Check where it exists and remove it
        Object.keys(kanban).forEach(key => {
            const idx = kanban[key].findIndex(c => c.id === college.id);
            if (idx !== -1) {
                kanban[key].splice(idx, 1);
                isRemoving = true;
            }
        });

        if (!isRemoving) {
            // Add to Shortlisted
            kanban.shortlisted.push({
                id: college.id,
                name: college.name,
                shortName: college.shortName,
                rankingTier: college.rankingTier,
                location: college.location,
                addedAt: new Date().toISOString()
            });
        }

        setAdded(!isRemoving);

        // 3. Save Kanban
        localStorage.setItem("application-kanban", JSON.stringify(kanban));

        // 4. Sync Flat List (Choice Cart)
        const allColleges = Object.values(kanban).flat();
        localStorage.setItem("choice-filling-cart", JSON.stringify(allColleges));

        // 5. Dispatch Events
        window.dispatchEvent(new Event("storage"));
        window.dispatchEvent(new Event("local-storage-update"));
    };

    return (
        <Button
            onClick={toggleList}
            variant={added ? "primary" : variant}
            className={`${className} ${added ? "added-to-list" : ""}`}
            title={added ? "Remove from Choice List" : "Add to Choice List"}
        >
            {added ? "✓ In List" : "+ Add to List"}
        </Button>
    );
}
