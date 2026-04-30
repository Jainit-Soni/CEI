"use client";

import { useCompare } from "@/hooks/useComparator";
import { useRouter, usePathname } from "next/navigation";
import Button from "./Button";
import "./CompareFloatingBar.css";

export default function CompareFloatingBar() {
    const { compareList, removeFromCompare, clearAll } = useCompare();
    const router = useRouter();
    const pathname = usePathname();

    if (pathname !== "/colleges" && !pathname?.startsWith("/colleges?")) return null;
    if (compareList.length === 0) return null;


    return (
        <div className="compare-bar-container bounceInUp">
            <div className="compare-bar-glass">
                <div className="compare-items-scroll">
                    {compareList.map(item => (
                        <div key={item.id} className="compare-pill">
                            <span className="pill-name">{item.shortName || item.name}</span>
                            <button
                                className="pill-remove"
                                onClick={() => removeFromCompare(item.id)}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>

                <div className="compare-divider"></div>

                <div className="compare-controls">
                    <div className="compare-info">
                        <span className="compare-count">{compareList.length} / 3</span>
                        <button className="clear-all-btn" onClick={clearAll}>Clear All</button>
                    </div>
                    <button
                        className="compare-submit-btn"
                        onClick={() => router.push("/compare")}
                    >
                        Compare Now
                    </button>
                </div>
            </div>
        </div>
    );
}
