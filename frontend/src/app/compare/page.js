"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useCompare } from "@/lib/CompareContext";
import { fetchCollegesBatch } from "@/lib/api";
import Container from "@/components/Container";
import GlassPanel from "@/components/GlassPanel";
import Button from "@/components/Button";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./compare.css";

export default function ComparePage() {
    const { selectedColleges, removeFromCompare } = useCompare();
    const [collegeData, setCollegeData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            if (selectedColleges.length === 0) {
                setCollegeData([]);
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const ids = selectedColleges.map(c => c.id);
                const results = await fetchCollegesBatch(ids);
                setCollegeData(results);
            } catch (err) {
                console.error("Failed to load comparison data", err);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [selectedColleges]);

    const handleDownloadPdf = () => {
        const doc = new jsPDF();

        doc.setFontSize(18);
        doc.text("College Comparison Report", 14, 20);

        doc.setFontSize(10);
        doc.text(`Generated on ${new Date().toLocaleDateString()}`, 14, 28);

        const tableColumn = ["Feature", ...collegeData.map(c => c.shortName || c.name)];
        const tableRows = [
            ["Location", ...collegeData.map(c => c.location)],
            ["Tuition Fees", ...collegeData.map(c => c.tuition || "N/A")],
            ["Avg Placement", ...collegeData.map(c => c.placements?.averagePackage || "N/A")],
            ["Highest Placement", ...collegeData.map(c => c.placements?.highestPackage || "N/A")],
            ["Key Exams", ...collegeData.map(c => c.acceptedExams?.join(", ") || "N/A")],
            ["Ranking", ...collegeData.map(c => c.rankingTier || "Unranked")]
        ];

        autoTable(doc, {
            head: [tableColumn],
            body: tableRows,
            startY: 35,
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246] }
        });

        doc.save("college-comparison.pdf");
    };

    const handleShare = () => {
        const ids = collegeData.map(c => c.id).join(",");
        const url = `${window.location.origin}/compare?ids=${ids}`;
        navigator.clipboard.writeText(url);
        alert("Comparison link copied to clipboard!");
    };

    if (selectedColleges.length === 0) {
        return (
            <div className="compare-empty">
                <Container>
                    <GlassPanel className="empty-panel">
                        <h1>Start Comparing</h1>
                        <p>Select up to 3 colleges to compare them side by side.</p>
                        <Button href="/colleges" variant="primary">Browse Colleges</Button>
                    </GlassPanel>
                </Container>
            </div>
        );
    }

    return (
        <div className="compare-page">
            <Container>
                <div className="compare-header">
                    <div className="bg-white/80 backdrop-blur-md p-4 rounded-xl border border-white/20 shadow-sm flex items-center justify-between w-full">
                        <div>
                            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-600">Compare Colleges</h1>
                            <Link href="/colleges" className="text-sm text-blue-600 hover:underline">← Add more colleges</Link>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleShare} className="px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200 rounded-md transition-colors">
                                🔗 Share
                            </button>
                            <button onClick={handleDownloadPdf} className="px-3 py-1.5 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded-md transition-colors shadow-sm">
                                ⬇ Download PDF
                            </button>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="compare-loading">Loading comparison...</div>
                ) : (
                    <div className="compare-grid-wrapper">
                        <div className="compare-grid" style={{ "--cols": collegeData.length }}>
                            {/* Header Row */}
                            <div className="compare-row header-row">
                                <div className="compare-cell label-cell"></div>
                                {collegeData.map((college) => (
                                    <div key={college.id} className="compare-cell data-cell">
                                        <div className="college-header">
                                            <button
                                                className="remove-btn"
                                                onClick={() => removeFromCompare(college.id)}
                                            >
                                                Remove
                                            </button>
                                            <h3>{college.shortName || college.name}</h3>
                                            <p>{college.location.split(",")[0]}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Fees - High Priority */}
                            <div className="compare-row">
                                <div className="compare-cell label-cell">Fees (Tuition)</div>
                                {collegeData.map((college) => (
                                    <div key={college.id} className="compare-cell data-cell highlight">
                                        {college.tuition || "Contact Institute"}
                                        <div className="sub-text">{college.meta?.ownership || "Private"}</div>
                                    </div>
                                ))}
                            </div>

                            {/* Placement Packages - CRITICAL */}
                            <div className="compare-row">
                                <div className="compare-cell label-cell">Placement Packages</div>
                                {collegeData.map((college) => (
                                    <div key={college.id} className="compare-cell data-cell">
                                        {college.placements ? (
                                            <div className="placement-stats">
                                                <div className="stat-row">
                                                    <span className="stat-label">Avg:</span>
                                                    <span className="stat-value highlight">{college.placements.averagePackage}</span>
                                                </div>
                                                <div className="stat-row">
                                                    <span className="stat-label">Median:</span>
                                                    <span className="stat-value">{college.placements.medianPackage}</span>
                                                </div>
                                                <div className="stat-row">
                                                    <span className="stat-label">Highest:</span>
                                                    <span className="stat-value">{college.placements.highestPackage}</span>
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-muted">Data not available</span>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Placements - High Priority */}
                            <div className="compare-row">
                                <div className="compare-cell label-cell">Top Recruiters</div>
                                {collegeData.map((college) => (
                                    <div key={college.id} className="compare-cell data-cell">
                                        {college.topRecruiters?.length > 0 ? (
                                            <div className="recruiters-list">
                                                {college.topRecruiters.slice(0, 4).map(r => (
                                                    <span key={r} className="recruiter-tag">{r}</span>
                                                ))}
                                                {college.topRecruiters.length > 4 && <span className="recruiter-more">+{college.topRecruiters.length - 4} more</span>}
                                            </div>
                                        ) : <span className="text-muted">Data unavailable</span>}
                                    </div>
                                ))}
                            </div>

                            {/* Ranking */}
                            <div className="compare-row">
                                <div className="compare-cell label-cell">Tier / Ranking</div>
                                {collegeData.map((college) => (
                                    <div key={college.id} className="compare-cell data-cell">
                                        <span className={`badge tier-${college.rankingTier?.toLowerCase().replace(" ", "-") || "na"}`}>
                                            {college.rankingTier || "Unranked"}
                                        </span>
                                    </div>
                                ))}
                            </div>

                            {/* Degrees/Courses */}
                            <div className="compare-row">
                                <div className="compare-cell label-cell">Academic Focus</div>
                                {collegeData.map((college) => {
                                    const degrees = [...new Set(college.courses?.map(c => c.degree))];
                                    return (
                                        <div key={college.id} className="compare-cell data-cell">
                                            {degrees.length > 0 ? degrees.join(", ") : "Various Programs"}
                                            <div className="sub-text">{college.courses?.length || 0} total courses</div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Exams */}
                            <div className="compare-row">
                                <div className="compare-cell label-cell">Admission Exams</div>
                                {collegeData.map((college) => (
                                    <div key={college.id} className="compare-cell data-cell">
                                        <div className="tags-list">
                                            {college.acceptedExams?.map(e => (
                                                <span key={e} className="tag">{e.toUpperCase()}</span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Action */}
                            <div className="compare-row action-row">
                                <div className="compare-cell label-cell"></div>
                                {collegeData.map((college) => (
                                    <div key={college.id} className="compare-cell data-cell">
                                        <Button href={`/college/${college.id}`} variant="outline" size="sm" isFullWidth>
                                            View Full Profile
                                        </Button>
                                    </div>
                                ))}
                            </div>

                        </div>
                    </div>
                )}
            </Container>
        </div>
    );
}
