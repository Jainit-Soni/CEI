"use client";

import { useState, useEffect, useRef } from "react";
import Container from "@/components/Container";
import { fetchColleges } from "@/lib/api"; // We'll use this to fetch details of saved IDs

function useStickyState(defaultValue, key) {
    const [value, setValue] = useState(() => {
        if (typeof window !== "undefined") {
            const stickyValue = window.localStorage.getItem(key);
            return stickyValue !== null ? JSON.parse(stickyValue) : defaultValue;
        }
        return defaultValue;
    });

    useEffect(() => {
        if (typeof window !== "undefined") {
            window.localStorage.setItem(key, JSON.stringify(value));
        }
    }, [key, value]);

    return [value, setValue];
}

export default function ChoiceFillingClient() {
    // State for the list of colleges in the "cart"
    // Structure: [{ id: 'college-id', order: 1, ...details }]
    const [choices, setChoices] = useStickyState([], "choice-filling-cart");
    const [hydrated, setHydrated] = useState(false);
    const [loading, setLoading] = useState(false);
    const [draggedItem, setDraggedItem] = useState(null);

    // Hydration fix
    useEffect(() => {
        setHydrated(true);
    }, []);

    // Fetch full details for choices if they only have IDs (e.g. added from another page)
    useEffect(() => {
        async function hydrateChoices() {
            if (choices.length === 0) return;

            const missingDetails = choices.filter(c => !c.name);
            if (missingDetails.length > 0) {
                setLoading(true);
                try {
                    // We need a batch fetch endpoint or loop. 
                    // Since we implemented batch fetch in a previous check (routes/colleges.js -> /colleges/batch), let's use it.
                    // But wait, did we verify /colleges/batch exists in api.js? Yes, likely. 
                    // If not, we fall back to individual fetches or filtering a larger list.
                    // Let's assume we can fetch by IDs or just fetch all and filter.
                    // Actually, let's look at api.js again. Yes, fetchCollegesBatch exists (I saw it in the verification step).

                    const ids = missingDetails.map(c => c.id);
                    // Dynamic import to avoid circular dep issues if any, though likely fine
                    const { fetchCollegesBatch } = await import("@/lib/api");
                    const details = await fetchCollegesBatch(ids);

                    // Merge details back into choices
                    const choiceMap = new Map(choices.map(c => [c.id, c]));
                    details.forEach(detail => {
                        if (choiceMap.has(detail.id)) {
                            choiceMap.set(detail.id, { ...choiceMap.get(detail.id), ...detail });
                        }
                    });
                    setChoices(Array.from(choiceMap.values()));
                } catch (err) {
                    console.error("Failed to hydrate choice details", err);
                } finally {
                    setLoading(false);
                }
            }
        }
        if (hydrated) {
            hydrateChoices();
        }
    }, [hydrated]); // Run once on mount/hydration

    /* --- Drag and Drop Handlers --- */
    const handleDragStart = (e, index) => {
        setDraggedItem(choices[index]);
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/html", e.target.parentNode);
        e.dataTransfer.setDragImage(e.target.parentNode, 20, 20);
    };

    const handleDragOver = (index) => {
        const draggedOverItem = choices[index];

        // if the item is dragged over itself, ignore
        if (draggedItem === draggedOverItem) {
            return;
        }

        // filter out the currently dragged item
        let items = choices.filter((item) => item !== draggedItem);

        // add the dragged item after the dragged over item
        items.splice(index, 0, draggedItem);

        setChoices(items);
    };

    const handleDragEnd = () => {
        setDraggedItem(null);
    };

    const removeChoice = (id) => {
        setChoices(choices.filter((c) => c.id !== id));
    };

    const clearList = () => {
        if (confirm("Are you sure you want to clear your entire list?")) {
            setChoices([]);
        }
    };

    const exportPDF = async () => {
        if (choices.length === 0) return;

        try {
            const { jsPDF } = await import("jspdf");
            const autoTable = (await import("jspdf-autotable")).default;

            const doc = new jsPDF();

            // Header
            doc.setFontSize(20);
            doc.setTextColor(79, 70, 229); // Indigo color
            doc.text("My College Preference List", 14, 22);

            doc.setFontSize(10);
            doc.setTextColor(100);
            doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 28);

            doc.setDrawColor(200);
            doc.line(14, 32, 196, 32);

            // Table Data
            const tableData = choices.map((c, i) => [
                i + 1,
                c.shortName || c.name,
                c.rankingTier || "N/A",
                (c.location || "N/A").split(',').pop().trim()
            ]);

            // Table
            autoTable(doc, {
                startY: 38,
                head: [['Priority', 'College Name', 'Tier', 'Location']],
                body: tableData,
                theme: 'grid',
                headStyles: { fillColor: [79, 70, 229], textColor: 255, fontSize: 10, fontStyle: 'bold' },
                bodyStyles: { fontSize: 9, textColor: 50 },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                columnStyles: {
                    0: { cellWidth: 20, halign: 'center' },
                    2: { cellWidth: 30, halign: 'center' },
                    3: { cellWidth: 40 }
                },
            });

            // Footer
            const pageHeight = doc.internal.pageSize.height;
            doc.setFontSize(8);
            doc.setTextColor(150);
            doc.text("Generated by Admission Intelligence Platform", 14, pageHeight - 10);

            doc.save("my-college-choices.pdf");
        } catch (err) {
            console.error("PDF generation failed:", err);
            alert("Failed to generate PDF. Please try again.");
        }
    };

    /* --- Render --- */
    if (!hydrated) return null; // Avoid hydration mismatch

    return (
        <div className="choice-filling-page">
            <Container>
                <header className="page-header">
                    <div className="header-content">
                        <h1 className="page-title">
                            Smart <span className="highlight">Choice Filling</span>
                        </h1>
                        <p className="page-subtitle">
                            Drag, drop, and organize your preference list. We'll analyze your safety net.
                        </p>
                    </div>
                    <div className="header-actions">
                        <button className="btn-secondary" onClick={clearList} disabled={choices.length === 0}>
                            Clear List
                        </button>
                        <button className="btn-primary" onClick={exportPDF} disabled={choices.length === 0}>
                            Export PDF
                        </button>
                    </div>
                </header>

                {choices.length === 0 ? (
                    <div className="empty-state-choice">
                        <div className="empty-icon">📋</div>
                        <h3>Your list is empty</h3>
                        <p>Go to college pages and click "Add to List" to build your preferences.</p>
                        <a href="/colleges" className="btn-text">Browse Colleges &rarr;</a>
                    </div>
                ) : (
                    <div className="choice-list-container">
                        <div className="list-stats">
                            <div className="stat-pill">
                                <span className="label">Total Choices:</span>
                                <span className="value">{choices.length}</span>
                            </div>
                        </div>

                        <ul className="choice-list">
                            {choices.map((college, index) => (
                                <li
                                    key={college.id}
                                    className="choice-item"
                                    draggable
                                    onDragStart={(e) => handleDragStart(e, index)}
                                    onDragOver={() => handleDragOver(index)}
                                    onDragEnd={handleDragEnd}
                                >
                                    <div className="item-rank">#{index + 1}</div>
                                    <div className="item-content">
                                        <div className="item-header">
                                            <h4 className="item-name">{college.shortName || college.name || "Loading..."}</h4>
                                            <span className={`tier-badge ${(college.rankingTier || "Tier 3").replace(/\s+/g, '-').toLowerCase()}`}>
                                                {college.rankingTier || "N/A"}
                                            </span>
                                        </div>
                                        <div className="item-details">
                                            <span className="location">{college.location?.split(',').pop().trim()}</span>
                                            {/* Placeholder for Probability Logic Integration in future */}
                                        </div>
                                    </div>
                                    <button
                                        className="item-remove"
                                        onClick={() => removeChoice(college.id)}
                                        title="Remove from list"
                                    >
                                        &times;
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </Container>
        </div>
    );
}
