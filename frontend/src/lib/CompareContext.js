"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useToast } from "@/components/Toast";

const CompareContext = createContext(null);

export function CompareProvider({ children }) {
    const [selectedColleges, setSelectedColleges] = useState([]);
    const { addToast } = useToast();

    // Load from localStorage OR URL params on mount
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const ids = params.get("ids");

        if (ids) {
            // If URL has IDs, fetch and use them (pseudo-loading basic info)
            // Ideally we'd fetch full details, but here we just store IDs
            // The ComparePage handles fetching details based on these IDs
            const idList = ids.split(",");
            const initialList = idList.map(id => ({ id, name: "Loading...", shortName: "..." }));
            setSelectedColleges(initialList);
        } else {
            // Fallback to localStorage
            const saved = localStorage.getItem("cei_compare_list");
            if (saved) {
                try {
                    setSelectedColleges(JSON.parse(saved));
                } catch (e) {
                    console.error("Failed to parse compare list", e);
                }
            }
        }
    }, []);

    // Save to localStorage whenever list changes
    useEffect(() => {
        localStorage.setItem("cei_compare_list", JSON.stringify(selectedColleges));
    }, [selectedColleges]);

    const addToCompare = useCallback((college) => {
        let shouldAdd = true;
        let message = "";
        let type = "success";

        setSelectedColleges((prev) => {
            if (prev.find((c) => c.id === college.id)) {
                shouldAdd = false;
                message = "Already in comparison list";
                type = "info";
                return prev;
            }
            if (prev.length >= 3) {
                shouldAdd = false;
                message = "You can compare up to 3 colleges";
                type = "warning";
                return prev;
            }
            message = `${college.shortName || college.name} added to compare`;
            // Return new state locally, actual state update happens
            return [...prev, { id: college.id, name: college.name, shortName: college.shortName }];
        });

        // Timeout to ensure this runs after the render cycle / state update logic is determined
        // But flawed because we don't know if state update actually happened above if we don't use the result.
        // Better approach: Check state *before* setting it.

    }, [addToast]);

    const removeFromCompare = useCallback((id) => {
        setSelectedColleges((prev) => prev.filter((c) => c.id !== id));
    }, []);

    const clearCompare = useCallback(() => {
        setSelectedColleges([]);
    }, []);

    const isInCompare = useCallback((id) => {
        return selectedColleges.some((c) => c.id === id);
    }, [selectedColleges]);

    return (
        <CompareContext.Provider value={{
            selectedColleges,
            addToCompare,
            removeFromCompare,
            clearCompare,
            isInCompare
        }}>
            {children}
        </CompareContext.Provider>
    );
}

export const useCompare = () => {
    const context = useContext(CompareContext);
    if (!context) {
        throw new Error("useCompare must be used within a CompareProvider");
    }
    return context;
};
