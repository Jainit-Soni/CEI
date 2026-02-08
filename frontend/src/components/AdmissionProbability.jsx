"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import GlassPanel from "./GlassPanel";
import Button from "./Button";
import { suggest, fetchCollege, fetchExams } from "../lib/api";
import "./AdmissionProbability.css";

export default function AdmissionProbability() {
    // UI State
    const [query, setQuery] = useState("");
    const [suggestions, setSuggestions] = useState([]);
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);

    // Data State
    const [selectedCollege, setSelectedCollege] = useState(null);
    const [exams, setExams] = useState([]);
    const [selectedExam, setSelectedExam] = useState("");

    // Calculation State
    const [userRank, setUserRank] = useState("");
    const [scoreType, setScoreType] = useState("percentile");
    const [results, setResults] = useState(null);
    const [isCalculating, setIsCalculating] = useState(false);

    // Refs
    const inputRef = useRef(null);
    const listRef = useRef(null);
    const debounceRef = useRef(null);

    // Load initial exams
    useEffect(() => {
        const loadExams = async () => {
            try {
                const data = await fetchExams();
                const rawExams = data.data || data || [];
                // Deduplicate exams by ID to prevent key warnings
                const uniqueExams = Array.from(new Map(rawExams.map(item => [item.id, item])).values());
                setExams(uniqueExams);
            } catch (err) {
                console.error("Failed to load exams", err);
            }
        };
        loadExams();
    }, []);

    // Click outside handler
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                inputRef.current &&
                !inputRef.current.contains(e.target) &&
                listRef.current &&
                !listRef.current.contains(e.target)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Debounced Fetch Logic
    const fetchSuggestions = useCallback(async (searchQuery) => {
        if (!searchQuery || searchQuery.length < 2) {
            setSuggestions([]);
            return;
        }

        setIsSuggesting(true);
        try {
            const data = await suggest({ q: searchQuery, type: "college" });
            if (data && Array.isArray(data)) {
                setSuggestions(data);
                setIsOpen(true);
            } else {
                setSuggestions([]);
            }
        } catch (err) {
            console.error("Suggest error", err);
            setSuggestions([]);
        } finally {
            setIsSuggesting(false);
        }
    }, []);

    const handleInputChange = (e) => {
        const val = e.target.value;
        setQuery(val);
        setSelectedCollege(null); // Reset selection on type
        setSelectedExam("");
        setResults(null);
        setActiveIndex(-1);

        if (debounceRef.current) clearTimeout(debounceRef.current);

        if (val.length < 2) {
            setSuggestions([]);
            setIsOpen(false);
            return;
        }

        debounceRef.current = setTimeout(() => {
            fetchSuggestions(val);
        }, 300);
    };

    // Load User Profile for Auto-fill
    const userProfile = useRef(null);
    useEffect(() => {
        const stored = localStorage.getItem("student-profile");
        if (stored) {
            userProfile.current = JSON.parse(stored);
        }
    }, []);

    const handleSelectCollege = async (college) => {
        setQuery(college.name);
        setSuggestions([]);
        setIsOpen(false);
        setActiveIndex(-1);

        try {
            // Fetch full college details including accepted exams
            const fullData = await fetchCollege(college.id);
            const dataToUse = fullData || college;
            setSelectedCollege(dataToUse);

            // SMART AUTO-FILLLogic
            if (userProfile.current && userProfile.current.exams) {
                const pExams = userProfile.current.exams;
                // Check if college accepts any exam we have a score for
                // Priority: CAT > CMAT > JEE > GATE (or based on value presence)

                const accepted = (dataToUse.acceptedExams || []).map(e => e.toLowerCase());
                const courses = (dataToUse.courses || []).flatMap(c => (c.exams || []).map(e => e.toLowerCase()));
                const allAccepted = [...new Set([...accepted, ...courses])];

                let match = null;

                // Check specific keys from our profile structure
                const keys = Object.keys(pExams);
                for (const key of keys) {
                    if (pExams[key] && allAccepted.includes(key.toLowerCase())) {
                        match = key;
                        break; // Take first match
                    }
                }

                if (match) {
                    setSelectedExam(match);
                    setUserRank(pExams[match]);
                    // Optional: Feedback toast? "Auto-filled from your profile!"
                }
            }

        } catch (err) {
            console.error("Fetch college details error", err);
            setSelectedCollege(college);
        }
    };

    const handleKeyDown = (e) => {
        if (!isOpen || suggestions.length === 0) return;

        switch (e.key) {
            case "ArrowDown":
                e.preventDefault();
                setActiveIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : 0));
                break;
            case "ArrowUp":
                e.preventDefault();
                setActiveIndex(prev => (prev > 0 ? prev - 1 : suggestions.length - 1));
                break;
            case "Enter":
                e.preventDefault();
                if (activeIndex >= 0 && suggestions[activeIndex]) {
                    handleSelectCollege(suggestions[activeIndex]);
                }
                break;
            case "Escape":
                setIsOpen(false);
                break;
        }
    };

    // Auto-scroll to active item
    useEffect(() => {
        if (activeIndex >= 0 && listRef.current) {
            const activeItem = listRef.current.children[activeIndex];
            if (activeItem) {
                activeItem.scrollIntoView({ block: "nearest" });
            }
        }
    }, [activeIndex]);

    const calculateProb = () => {
        if (!selectedCollege || !userRank) return;
        setIsCalculating(true);

        setTimeout(() => {
            const rank = parseFloat(userRank);
            const probResults = [];

            const pastCutoffs = selectedCollege.pastCutoffs || [];

            // Logic to calculate probability
            if (pastCutoffs.length > 0) {
                pastCutoffs.forEach(cp => {
                    if (selectedExam && cp.examId?.toLowerCase() !== selectedExam.toLowerCase()) return;

                    const parts = cp.cutoff.split("|");
                    parts.forEach(p => {
                        const match = p.match(/(.*?):\s*(\d+(\.\d+)?)/);
                        if (match) {
                            const branch = match[1].trim();
                            const threshold = parseFloat(match[2]);
                            let status = "Low Chance";
                            let color = "#ef4444"; // Red

                            // Smart Comparator Logic
                            const isDbPercentile = threshold <= 100;
                            const userVal = rank;

                            if (scoreType === "percentile") {
                                if (isDbPercentile) {
                                    // Percentile vs Percentile
                                    if (userVal >= threshold) {
                                        status = "High Chance";
                                        color = "#10b981";
                                    } else if (userVal >= threshold - 5) {
                                        status = "Moderate Chance";
                                        color = "#f59e0b";
                                    } else {
                                        status = "Low Chance";
                                        color = "#ef4444";
                                    }
                                } else {
                                    // Percentile vs Rank (Convert)
                                    const estRank = (100 - userVal) * 1000;
                                    if (estRank <= threshold) {
                                        status = "High Chance";
                                        color = "#10b981";
                                    } else if (estRank <= threshold * 1.5) {
                                        status = "Moderate Chance";
                                        color = "#f59e0b";
                                    } else {
                                        status = "Low Chance";
                                        color = "#ef4444";
                                    }
                                }
                            } else {
                                // Rank vs Rank
                                if (!isDbPercentile) {
                                    if (userVal <= threshold) {
                                        status = "High Chance";
                                        color = "#10b981";
                                    } else if (userVal <= threshold * 1.5) {
                                        status = "Moderate Chance";
                                        color = "#f59e0b";
                                    } else {
                                        status = "Low Chance";
                                        color = "#ef4444";
                                    }
                                } else {
                                    status = "Uncertain";
                                    color = "#94a3b8";
                                }
                            }

                            probResults.push({ branch, status, color, exam: cp.examId });
                        }
                    });
                });
            }

            if (probResults.length === 0) {
                probResults.push({
                    branch: "Historical Data Unavailable",
                    status: "Data Pending",
                    color: "#94a3b8",
                    note: `We don't have verified cutoff data for ${selectedExam || "this exam"} yet.`
                });
            }

            setResults(probResults);
            setIsCalculating(false);
        }, 800);
    };

    return (
        <GlassPanel className="prob-tool-card" variant="strong" glow>
            <div className="prob-tool-header">
                <div className="verified-badge">
                    <span className="v-icon">🛡️</span>
                    100% Verified Data
                </div>
                <h2>Admission Probability 🎯</h2>
                <p>Check your admission chances based on historical trends.</p>
            </div>

            <div className="prob-tool-body">
                {/* College Search Field */}
                <div className="prob-field">
                    <label>Select College</label>
                    <div className="search-wrap">
                        <input
                            ref={inputRef}
                            type="text"
                            placeholder="Type college name (e.g. Symbiosis, VIT)..."
                            value={query}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            onFocus={() => {
                                if (suggestions.length > 0) setIsOpen(true);
                            }}
                            className="prob-input"
                        />
                        {/* Loading Indicator */}
                        {isSuggesting && (
                            <div style={{ position: 'absolute', right: 12, top: 16 }}>
                                <span className="spinner-small"></span>
                            </div>
                        )}

                        {/* Suggestions Dropdown */}
                        {isOpen && suggestions.length > 0 && (
                            <div className="prob-suggestions" ref={listRef}>
                                {suggestions.map((s, idx) => (
                                    <div
                                        key={`${s.type}-${s.id}-${idx}`}
                                        className={`s-item ${idx === activeIndex ? 'active' : ''}`}
                                        onClick={() => handleSelectCollege(s)}
                                    >
                                        <div className="s-name">
                                            <strong>{s.name}</strong>
                                            {s.location && <span className="s-loc"> • {s.location}</span>}
                                        </div>
                                        <span className="s-type">{s.type === 'college' ? '🏫 College' : '📝 Exam'}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Exam Selection Field */}
                <div className="prob-field">
                    <label>Entrance Exam (Compulsory)</label>
                    <select
                        className="prob-input"
                        value={selectedExam}
                        onChange={(e) => setSelectedExam(e.target.value)}
                        disabled={!selectedCollege}
                        style={{ opacity: !selectedCollege ? 0.6 : 1 }}
                    >
                        {!selectedCollege ? (
                            <option value="">-- Select College First --</option>
                        ) : (
                            <>
                                <option value="">-- Select Exam --</option>
                                {exams
                                    .filter(e => {
                                        if (!selectedCollege) return false;
                                        // Smart Filter: Show exams accepted OR having past cutoffs
                                        const accepted = selectedCollege.acceptedExams || [];
                                        const courseExams = (selectedCollege.courses || []).flatMap(c => c.exams || []);
                                        const cutoffExams = (selectedCollege.pastCutoffs || []).map(p => p.examId);

                                        // Merge all sources
                                        const allRelevant = [...new Set([...accepted, ...courseExams, ...cutoffExams])];

                                        // Normalize IDs for comparison (handle case sensitivity)
                                        return allRelevant.some(id => id.toLowerCase() === e.id.toLowerCase());
                                    })
                                    .map(e => (
                                        <option key={e.id} value={e.id}>{e.shortName || e.name}</option>
                                    ))
                                }
                            </>
                        )}
                    </select>
                </div>

                {/* Score Input Field */}
                <div className="prob-field">
                    <div className="score-label-row">
                        <label>Your Score</label>
                        <div className="score-switcher">
                            <button className={scoreType === 'percentile' ? 'active' : ''} onClick={() => setScoreType('percentile')}>Percentile</button>
                            <button className={scoreType === 'rank' ? 'active' : ''} onClick={() => setScoreType('rank')}>Rank</button>
                        </div>
                    </div>
                    <div className="prob-input-row">
                        <input
                            type="number"
                            placeholder={scoreType === 'percentile' ? "e.g. 98.5" : "e.g. 5000"}
                            value={userRank}
                            onChange={(e) => setUserRank(e.target.value)}
                            className="prob-input"
                            onKeyDown={(e) => e.key === 'Enter' && calculateProb()}
                        />
                        <Button
                            onClick={calculateProb}
                            disabled={!selectedCollege || !userRank || !selectedExam || isCalculating}
                        >
                            {isCalculating ? "Calculating..." : "Check Probability"}
                        </Button>
                    </div>
                </div>

                {/* Results Display */}
                {results && (
                    <div className="prob-results-list fadeIn">
                        {results.map((res, i) => (
                            <div key={`${i}-${res.branch}`} className="prob-res-item">
                                <div className="res-meta">
                                    <strong>{res.branch}</strong>
                                    {res.exam && <span className="res-exam">{res.exam.toUpperCase()}</span>}
                                    {res.note && <span className="res-note">{res.note}</span>}
                                </div>
                                <div className="res-status" style={{ color: res.color }}>
                                    {res.status}
                                    <div className="status-dot" style={{ backgroundColor: res.color }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </GlassPanel>
    );
}
