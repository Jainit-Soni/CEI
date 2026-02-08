"use client";

import { createContext, useContext, useState, useEffect } from "react";

const CompareContext = createContext();

export function CompareProvider({ children }) {
    const [compareList, setCompareList] = useState([]);
    const [isHydrated, setIsHydrated] = useState(false);

    // Initial load from localStorage
    useEffect(() => {
        const saved = localStorage.getItem("compareList");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    setCompareList(parsed);
                }
            } catch (e) {
                console.error("Failed to parse compare list", e);
            }
        }
        setIsHydrated(true);
    }, []);

    // Save to localStorage only after hydration and only when list changes
    useEffect(() => {
        if (isHydrated) {
            localStorage.setItem("compareList", JSON.stringify(compareList));
        }
    }, [compareList, isHydrated]);


    const addToCompare = (college) => {
        if (compareList.length >= 3) {
            alert("You can compare mainly 3 colleges at a time.");
            return;
        }
        if (compareList.find(c => c.id === college.id)) return;
        setCompareList([...compareList, college]);
    };

    const removeFromCompare = (id) => {
        setCompareList(compareList.filter(c => c.id !== id));
    };

    const isInCompare = (id) => {
        return compareList.some(c => c.id === id);
    };

    return (
        <CompareContext.Provider value={{ compareList, addToCompare, removeFromCompare, isInCompare, setCompareList }}>
            {children}
        </CompareContext.Provider>
    );
}

export const useCompare = () => useContext(CompareContext);
