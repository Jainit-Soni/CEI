"use client";

import Link from "next/link";
import { useCompare } from "@/lib/CompareContext";
import "./CompareFloatingBar.css";

export default function CompareFloatingBar() {
    const { selectedColleges, removeFromCompare, clearCompare } = useCompare();

    if (selectedColleges.length === 0) return null;

    return (
        <div className="compare-bar">
            <div className="compare-bar-inner">
                <div className="compare-info">
                    <span className="compare-count">{selectedColleges.length} selected</span>
                    <div className="compare-thumbs">
                        {selectedColleges.map((c) => (
                            <div key={c.id} className="compare-thumb">
                                <span>{c.shortName || c.name.substring(0, 10)}</span>
                                <button
                                    onClick={() => removeFromCompare(c.id)}
                                    className="compare-remove"
                                    aria-label="Remove"
                                >
                                    ×
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="compare-actions">
                    <button onClick={clearCompare} className="compare-clear">
                        Clear
                    </button>
                    <Link href="/compare" className="compare-link">
                        Compare Now
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    </Link>
                </div>
            </div>
        </div>
    );
}
