"use client";

import { createContext, useContext, useState, useEffect } from "react";

const ScoreContext = createContext();

export function ScoreProvider({ children }) {
    const [scores, setScores] = useState({});
    const [isLoaded, setIsLoaded] = useState(false);

    // Load from local storage on mount
    useEffect(() => {
        if (typeof window !== "undefined") {
            const stored = localStorage.getItem("user_exam_scores");
            if (stored) {
                try {
                    setScores(JSON.parse(stored));
                } catch (e) {
                    console.error("Failed to parse scores", e);
                }
            }
            setIsLoaded(true);
        }
    }, []);

    const saveScores = (newScores) => {
        setScores(newScores);
        if (typeof window !== "undefined") {
            localStorage.setItem("user_exam_scores", JSON.stringify(newScores));
        }
    };

    const getPrediction = (college) => {
        if (!college.pastCutoffs || college.pastCutoffs.length === 0) return null;

        // Find relevant cutoff
        // Logic: Check if user has score for any exam accepted by college
        let bestPrediction = null;

        college.pastCutoffs.forEach(cutoffData => {
            const examName = cutoffData.examId.replace(/20\d\d/g, '').trim().toUpperCase();
            const userPercentile = parseFloat(scores[examName]); // e.g. "95.5"

            if (!isNaN(userPercentile)) {
                // Parse cutoff string (e.g. "General: 90" or just "90")
                // Simple parser: extract first number
                const cutoffMatch = cutoffData.cutoff.match(/(\d+(\.\d+)?)/);
                if (cutoffMatch) {
                    const cutoffVal = parseFloat(cutoffMatch[0]);

                    let status = "Dream ✨";
                    let color = "indigo";

                    if (userPercentile >= cutoffVal + 2) {
                        status = "Safe 🛡️";
                        color = "emerald";
                    } else if (userPercentile >= cutoffVal - 5) {
                        status = "Target 🎯";
                        color = "amber";
                    }

                    // Prioritize Safe > Target > Dream
                    if (!bestPrediction ||
                        (status === "Safe 🛡️") ||
                        (status === "Target 🎯" && bestPrediction.status === "Dream ✨")) {
                        bestPrediction = { status, color, exam: examName, cutoff: cutoffVal };
                    }
                }
            }
        });

        return bestPrediction;
    };

    return (
        <ScoreContext.Provider value={{ scores, saveScores, getPrediction, isLoaded }}>
            {children}
        </ScoreContext.Provider>
    );
}

export function useScores() {
    return useContext(ScoreContext);
}
