"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { fetchCollegesBatch } from "@/lib/api";

const ComparatorContext = createContext();

export const ComparatorProvider = ({ children }) => {
    const [pinnedIds, setPinnedIds] = useState([]);
    const [pinnedColleges, setPinnedColleges] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [ghostCollege, setGhostCollege] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem("cei_pinned_ids");
        if (saved) {
            try {
                const ids = JSON.parse(saved);
                if (Array.isArray(ids)) {
                    setPinnedIds(ids.map(id => String(id)));
                    // If we have IDs but no colleges yet, and it's the first load, 
                    // the next effect will handle the fetch.
                }
            } catch (err) {
                console.error("Failed to parse pinned colleges", err);
            }
        }
    }, []);

    // Fetch details when IDs change
    useEffect(() => {
        if (pinnedIds.length > 0) {
            localStorage.setItem("cei_pinned_ids", JSON.stringify(pinnedIds));
        } else {
            localStorage.removeItem("cei_pinned_ids");
        }
        
        const updateDetails = async () => {
            if (pinnedIds.length === 0) {
                setPinnedColleges([]);
                return;
            }
            setIsLoading(true);
            try {
                const data = await fetchCollegesBatch(pinnedIds);
                // Ensure unique colleges by ID to avoid React key warnings
                const uniqueData = Array.from(new Map(data.map(item => [item.id || item._id, item])).values());
                setPinnedColleges(uniqueData);
            } catch (err) {
                console.error("Comparison fetch failed", err);
            } finally {
                setIsLoading(false);
            }
        };

        updateDetails();
    }, [pinnedIds]);

    const pinCollege = (id) => {
        if (pinnedIds.includes(id)) return;
        if (pinnedIds.length >= 4) {
            // Logic for max pins (maybe show a toast?)
            window.dispatchEvent(new CustomEvent('api-error', { 
                detail: { title: "Comparison Limit", message: "You can compare up to 4 colleges at a time.", type: 'warning' } 
            }));
            return;
        }
        setPinnedIds([...pinnedIds, id]);
        setIsDrawerOpen(true);
    };

    const unpinCollege = (id) => {
        setPinnedIds(pinnedIds.filter(i => i !== id));
    };

    const clearPins = () => {
        setPinnedIds([]);
    };

    return (
        <ComparatorContext.Provider value={{
            pinnedIds,
            pinnedColleges,
            isLoading,
            isDrawerOpen,
            setIsDrawerOpen,
            pinCollege,
            unpinCollege,
            clearPins,
            isPinned: (id) => pinnedIds.includes(id),
            ghostCollege,
            setGhostCollege
        }}>
            {children}
        </ComparatorContext.Provider>
    );
};

export const useComparator = () => {
    const context = useContext(ComparatorContext);
    if (!context) {
        throw new Error("useComparator must be used within a ComparatorProvider");
    }
    return context;
};

// Backward compatibility alias for legacy components
export const useCompare = () => {
    const { 
        pinnedColleges, 
        pinCollege, 
        unpinCollege, 
        isPinned,
        clearPins,
        ghostCollege,
        setGhostCollege
    } = useComparator();

    return {
        compareList: pinnedColleges,
        addToCompare: pinCollege,
        removeFromCompare: unpinCollege,
        isInCompare: isPinned,
        clearAll: clearPins
    };
};
