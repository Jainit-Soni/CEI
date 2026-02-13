"use client";

import { useCompare } from "@/lib/CompareContext";
import Container from "@/components/Container";
import GlassPanel from "@/components/GlassPanel";
import Button from "@/components/Button";
import TrustBadge from "@/components/TrustBadge";
import EmptyState from "@/components/EmptyState";
import { useEffect, useState } from "react";
import { fetchCollegesBatch } from "@/lib/api";
import Link from "next/link";
import "./ComparePage.css";

export default function CompareClient() {
    const { compareList, removeFromCompare } = useCompare();
    const [fullColleges, setFullColleges] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (compareList.length === 0) {
            setFullColleges([]);
            return;
        }

        const ids = compareList.map(c => c.id).filter(id => id);
        if (ids.length === 0) return;

        const load = async () => {
            setIsLoading(true);
            try {
                const data = await fetchCollegesBatch(ids);
                // Ensure the order matches compareList
                const ordered = ids.map(id => data.find(c => c.id === id)).filter(Boolean);
                setFullColleges(ordered);
            } catch (err) {
                console.error("Batch fetch failed", err);
            } finally {
                setIsLoading(false);
            }
        };
        load();
    }, [compareList]);

    if (compareList.length === 0) {
        return (
            <div className="compare-page">
                <Container>
                    <EmptyState
                        icon="⚖️"
                        title="No colleges to compare"
                        description="Add up to 3 colleges to see how they stack up."
                        actionLabel="Return to List"
                        actionHref="/colleges"
                    />
                </Container>
            </div>
        );
    }

    const displayList = fullColleges.length > 0 ? fullColleges : compareList;

    const getHighlightClass = (type, value, allValues) => {
        if (!value) return "";
        const numVal = parseFloat(value.toString().replace(/[^0-9.]/g, ''));
        if (isNaN(numVal)) return "";

        const validNums = allValues.map(v => parseFloat(v?.toString().replace(/[^0-9.]/g, ''))).filter(n => !isNaN(n));
        if (validNums.length < 2) return "";

        if (type === 'fees' || type === 'rank') {
            const min = Math.min(...validNums);
            return numVal === min ? "winner-cell" : "";
        }
        if (type === 'salary') {
            const max = Math.max(...validNums);
            return numVal === max ? "winner-cell" : "";
        }
        return "";
    };

    const getVal = (c, field) => {
        if (field === 'fees') return c.tuition || c.fees;
        if (field === 'rank') return c.rankingTier || c.ranking;
        if (field === 'avgPackage') return c.placements?.averagePackage;
        if (field === 'highestPackage') return c.placements?.highestPackage;
        if (field === 'hostel') return c.meta?.hostelFees || "Contact Institute";
        if (field === 'naac') return c.meta?.naacGrade;
        if (field === 'ownership') return c.meta?.ownership;
        return null;
    };

    return (
        <div className="compare-page">
            <Container>
                <div className="compare-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <h1>Compare Colleges</h1>
                        {isLoading && <span className="loading-tag">Updating data...</span>}
                    </div>
                    <Button href="/colleges" variant="secondary" size="sm">Add More +</Button>
                </div>

                <div className="compare-table-wrapper">
                    <table className="compare-table">
                        <thead>
                            <tr>
                                <th className="label-col">Metric</th>
                                {displayList.map(c => (
                                    <th key={c.id} className="college-col">
                                        <div className="college-header">
                                            <Button
                                                onClick={() => removeFromCompare(c.id)}
                                                className="remove-btn"
                                                variant="ghost"
                                                size="xs"
                                            >× Remove</Button>
                                            <Link href={`/college/${c.id}`} className="college-link">
                                                {c.shortName || c.name}
                                            </Link>
                                            <div className="college-loc">{c.location}</div>
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="label-cell">Data Trust</td>
                                {displayList.map(c => (
                                    <td key={c.id}>
                                        <TrustBadge source={c.source || "Official"} lastUpdated={c.lastUpdated} />
                                    </td>
                                ))}
                            </tr>

                            <tr>
                                <td className="label-cell">Ranking Tier</td>
                                {displayList.map(c => (
                                    <td key={c.id}>
                                        <span className={`tier-badge ${getVal(c, 'rank')?.toLowerCase().includes('tier 1') ? 'tier-1' : ''}`}>
                                            {getVal(c, 'rank') || "—"}
                                        </span>
                                    </td>
                                ))}
                            </tr>

                            <tr>
                                <td className="label-cell">NAAC Grade</td>
                                {displayList.map(c => (
                                    <td key={c.id}>
                                        <strong>{getVal(c, 'naac') || "—"}</strong>
                                    </td>
                                ))}
                            </tr>

                            <tr>
                                <td className="label-cell">Ownership</td>
                                {displayList.map(c => (
                                    <td key={c.id}>{getVal(c, 'ownership') || "—"}</td>
                                ))}
                            </tr>

                            <tr className="section-divider"><td colSpan={displayList.length + 1}>Financials</td></tr>

                            <tr>
                                <td className="label-cell">Tuition (Approx)</td>
                                {displayList.map(c => {
                                    const val = getVal(c, 'fees');
                                    const allVals = displayList.map(item => getVal(item, 'fees'));
                                    return (
                                        <td key={c.id} className={getHighlightClass('fees', val, allVals)}>
                                            {val || "—"}
                                        </td>
                                    );
                                })}
                            </tr>

                            <tr>
                                <td className="label-cell">Hostel Fees</td>
                                {displayList.map(c => (
                                    <td key={c.id}>{getVal(c, 'hostel')}</td>
                                ))}
                            </tr>

                            <tr className="section-divider"><td colSpan={displayList.length + 1}>Placements</td></tr>

                            <tr>
                                <td className="label-cell">Avg Package</td>
                                {displayList.map(c => {
                                    const val = getVal(c, 'avgPackage');
                                    const allVals = displayList.map(item => getVal(item, 'avgPackage'));
                                    return (
                                        <td key={c.id} className={getHighlightClass('salary', val, allVals)}>
                                            <strong>{val || "—"}</strong>
                                        </td>
                                    );
                                })}
                            </tr>
                            <tr>
                                <td className="label-cell">Highest Package</td>
                                {displayList.map(c => {
                                    const val = getVal(c, 'highestPackage');
                                    const allVals = displayList.map(item => getVal(item, 'highestPackage'));
                                    return (
                                        <td key={c.id} className={getHighlightClass('salary', val, allVals)}>
                                            {val || "—"}
                                        </td>
                                    );
                                })}
                            </tr>

                            <tr className="section-divider"><td colSpan={displayList.length + 1}>Academics</td></tr>

                            <tr>
                                <td className="label-cell">Exams Accepted</td>
                                {displayList.map(c => (
                                    <td key={c.id}>
                                        <div className="chip-row">
                                            {(c.acceptedExams || []).map(e => (
                                                <span key={e} className="chip">{e.toUpperCase()}</span>
                                            ))}
                                        </div>
                                    </td>
                                ))}
                            </tr>
                        </tbody>
                    </table>

                    {/* Mobile View Placeholder (Rendered via CSS hidden/block) */}
                    <div className="compare-mobile-view">
                        <div className="mobile-colleges-nav">
                            {displayList.map(c => (
                                <div key={c.id} className="college-header-mobile">
                                    <div className="mobile-college-info">
                                        <h3>{c.shortName || c.name}</h3>
                                        <p className="college-loc">{c.location}</p>
                                    </div>
                                    <Button onClick={() => removeFromCompare(c.id)} variant="ghost" size="xs" className="remove-btn">Remove</Button>
                                </div>
                            ))}
                        </div>

                        {[
                            { title: "General Info", fields: ['rank', 'naac', 'ownership'] },
                            { title: "Financials", fields: ['fees', 'hostel'] },
                            { title: "Placements", fields: ['avgPackage', 'highestPackage'] }
                        ].map(section => (
                            <div key={section.title} className="feature-group">
                                <h4 className="feature-group-title">{section.title}</h4>
                                {displayList.map(c => (
                                    <div key={c.id} style={{ marginBottom: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                                        <p style={{ fontSize: '0.7rem', color: '#3b82f6', fontWeight: 800, textTransform: 'uppercase', marginBottom: '4px' }}>
                                            {c.shortName || c.name}
                                        </p>
                                        {section.fields.map(f => (
                                            <div key={f} className="compare-item-mobile">
                                                <span className="mobile-college-label">{f.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</span>
                                                <span className="mobile-college-value">{getVal(c, f) || "—"}</span>
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="compare-footer-note">
                    * Data is sourced from official mandates and NIRF filings. Placements are based on 2023-24 cycle.
                </div>
            </Container>
        </div>
    );
}
