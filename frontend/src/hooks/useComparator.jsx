"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { fetchCollegesBatch } from "@/lib/api";
import { useToast } from "@/components/Toast";

const ComparatorContext = createContext();

export const ComparatorProvider = ({ children }) => {
    const [pinnedIds, setPinnedIds] = useState([]);
    const [pinnedColleges, setPinnedColleges] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isHydrated, setIsHydrated] = useState(false);
    const [ghostCollege, setGhostCollege] = useState(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const { addToast } = useToast();

    // Load from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem("cei_pinned_ids");
        if (saved) {
            try {
                const ids = JSON.parse(saved);
                if (Array.isArray(ids)) {
                    // Normalize to unique strings
                    const uniqueIds = [...new Set(ids.map(id => String(id)))];
                    setPinnedIds(uniqueIds);
                }
            } catch (err) {
                console.error("Failed to parse pinned colleges", err);
            }
        }
        setIsHydrated(true);
    }, []);

    // Persistence Effect - ONLY runs after hydration
    useEffect(() => {
        if (!isHydrated) return;

        if (pinnedIds.length > 0) {
            localStorage.setItem("cei_pinned_ids", JSON.stringify(pinnedIds));
        } else {
            localStorage.removeItem("cei_pinned_ids");
        }
    }, [pinnedIds, isHydrated]);

    // Fetch details when IDs change
    useEffect(() => {
        const updateDetails = async () => {
            if (!isHydrated || pinnedIds.length === 0) {
                setPinnedColleges([]);
                return;
            }

            // check if we already have these colleges to avoid redundant fetch
            const currentIds = pinnedColleges.map(c => String(c.id || c._id));
            const hasAll = pinnedIds.every(id => currentIds.includes(id));
            if (hasAll && pinnedIds.length === currentIds.length) return;

            setIsLoading(true);
            try {
                const data = await fetchCollegesBatch(pinnedIds);
                
                // Robust batch response unwrapping: { college }, { data }, or direct object
                const unwrappedData = (data || []).map(item => {
                    if (item.college) return { ...item.college, truthContract: item.truthContract };
                    if (item.data) return item.data;
                    return item;
                });
                
                const uniqueData = Array.from(new Map(unwrappedData.map(item => [String(item.id || item._id), item])).values());
                setPinnedColleges(uniqueData);
            } catch (err) {
                console.error("Comparison fetch failed", err);
                addToast("Failed to sync comparison data.", "error", "Sync Error");
            } finally {
                setIsLoading(false);
            }
        };

        updateDetails();
    }, [pinnedIds, isHydrated]);

    const pinCollege = (rawId, name = "Institution") => {
        const id = String(rawId);
        if (pinnedIds.includes(id)) {
            addToast("Already in the comparison list.", "info", "Comparison");
            return;
        }
        if (pinnedIds.length >= 3) {
            addToast("The comparison list is full (max 3 institutions).", "warning", "Capacity Reached");
            return;
        }
        setPinnedIds([...pinnedIds, id]);
        addToast(`${name} added to comparison.`, "success", "Comparison", { label: "View List ⚖️", href: "/compare" });
    };

    const unpinCollege = (rawId) => {
        const id = String(rawId);
        // OPTIMISTIC UPDATE: Instant sync
        setPinnedIds(prev => prev.filter(i => i !== id));
        setPinnedColleges(prev => prev.filter(c => String(c.id || c._id) !== id));
    };

    const clearPins = () => {
        setPinnedIds([]);
        setPinnedColleges([]);
    };

    return (
        <ComparatorContext.Provider value={{
            pinnedIds,
            pinnedColleges,
            isLoading,
            pinCollege,
            unpinCollege,
            clearPins,
            isPinned: (rawId) => pinnedIds.includes(String(rawId)),
            ghostCollege,
            setGhostCollege,
            isDrawerOpen,
            setIsDrawerOpen
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
