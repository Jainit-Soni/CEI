import React, { useState, useEffect, useMemo } from 'react';
import { fetchCollegeTruthCutoffs } from '@/lib/api';
import SectionTrustSummary from '../Truth/SectionTrustSummary';
import SourcePopover from '../Truth/SourcePopover';
import GlassPanel from '../GlassPanel';
import './TruthCutoffsSection.css';

/**
 * TruthCutoffsSection.jsx — Final Implementation with Smart Grouping
 * ================================================================
 * Premium CEI-style admissions explorer with intelligent duplicate reduction.
 */
export default function TruthCutoffsSection({ collegeId }) {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [expandedCourses, setExpandedCourses] = useState(new Set());
    const [expandedRounds, setExpandedRounds] = useState(new Set());

    // QUOTA NORMALIZATION: Normalize quota labels for display and grouping
    const normalizeQuota = (quota) => {
        if (!quota) return 'All India';
        const q = quota.trim().toUpperCase();
        if (q === 'AI' || q === 'ALL INDIA') return 'All India';
        if (q === 'HS' || q === 'HOME STATE') return 'Home State';
        if (q === 'OS' || q === 'OTHER STATE') return 'Other State';
        return quota;
    };

    // DUPLICATE DEFENSE: Create dedupe key for exact duplicate detection
    const createDedupeKey = (item) => {
        // STRICT FIELD MAPPING PRIORITY
        const courseName = item.canonical?.canonicalCourseName || item.raw?.programName || item.courseName || null;
        const normalizedQuota = normalizeQuota(item.canonical?.quota || item.raw?.quota || item.quota || null);
        const round = item.canonical?.round || item.raw?.round || item.round || null;
        
        const openingRank = item.canonical?.openingRank ?? item.raw?.openingRank ?? item.openingRank ?? null;
        const closingRank = item.canonical?.closingRank ?? item.raw?.closingRank ?? item.closingRank ?? null;
        
        const seatType = item.raw?.seatType || item.seatType || null;
        const gender = item.raw?.gender || item.gender || null;
        const category = item.canonical?.category || item.raw?.category || item.category || null;
        const source = item.raw?.source || item.source || null;
        
        return `${courseName}|${normalizedQuota}|${round}|${seatType}|${gender}|${category}|${openingRank}|${closingRank}|${source}`;
    };

    // GROUPING STRUCTURE: Group cutoffs hierarchically with smart user-friendly grouping
    const processedData = useMemo(() => {
        if (!data?.items || data.items.length === 0) return { hierarchical: {}, courseSummaries: {} };
        
        console.log('[DEBUG] Raw data items:', data.items.length);
        console.log('[DEBUG] Sample items:', data.items.slice(0, 3));
        
        // Debug: Show all unique categories
        const allCategories = new Set();
        data.items.forEach(item => {
            const category = item.canonical?.category || item.raw?.category || item.category || "Unspecified";
            allCategories.add(category);
        });
        console.log('[DEBUG] All categories found:', Array.from(allCategories));
        
        // Remove exact duplicates first
        const seenKeys = new Set();
        const uniqueItems = data.items.filter(item => {
            const key = createDedupeKey(item);
            if (seenKeys.has(key)) return false;
            seenKeys.add(key);
            return true;
        });
               console.log('[DEBUG] Processing unique items for hierarchy:', uniqueItems.length);
        
        // RECOVERY DEBUG: Print 10 mapped rows
        console.log('--- RECOVERY DEBUG: Mapped Rows (Top 10) ---');
        uniqueItems.slice(0, 10).forEach((item, i) => {
            const courseName = item.canonical?.canonicalCourseName || item.raw?.programName || item.courseName || null;
            const quota = item.canonical?.quota || item.raw?.quota || item.quota || null;
            const nQuota = normalizeQuota(quota);
            console.log(`Row ${i}: [${item.raw?.source}] ${courseName} | ${nQuota} | ${item.raw?.seatType} | ${item.canonical?.openingRank}-${item.canonical?.closingRank}`);
        });

        // Create unique items for hierarchy
        const hierarchical = {};
        const courseSummaries = {};
        
        uniqueItems.forEach(item => {
            const courseKey = item.canonical?.canonicalCourseName || item.raw?.programName || item.courseName || null;
            const courseDisplayKey = courseKey || "Unknown Course";
            const normalizedQuota = normalizeQuota(item.canonical?.quota || item.raw?.quota || item.quota || null);
            const roundKey = item.canonical?.round || item.raw?.round || item.round || null;
            const roundDisplayKey = roundKey || 'Unknown';
            
            // Build hierarchy: Course -> Quota -> Round -> Items
            if (!hierarchical[courseDisplayKey]) {
                hierarchical[courseDisplayKey] = {};
            }
            if (!hierarchical[courseDisplayKey][normalizedQuota]) {
                hierarchical[courseDisplayKey][normalizedQuota] = {};
            }
            if (!hierarchical[courseDisplayKey][normalizedQuota][roundDisplayKey]) {
                hierarchical[courseDisplayKey][normalizedQuota][roundDisplayKey] = [];
            }
            
            hierarchical[courseDisplayKey][normalizedQuota][roundDisplayKey].push(item);
            
            // Calculate course summary
            if (!courseSummaries[courseDisplayKey]) {
                courseSummaries[courseDisplayKey] = {
                    courseName: courseDisplayKey,
                    totalEntries: 0,
                    quotas: new Set(),
                    rounds: new Set(),
                    bestOpening: Infinity,
                    worstClosing: 0
                };
            }
            
            const summary = courseSummaries[courseDisplayKey];
            summary.totalEntries += 1;
            summary.quotas.add(normalizedQuota);
            summary.rounds.add(roundDisplayKey);
            
            const opening = item.canonical?.openingRank ?? item.raw?.openingRank ?? item.openingRank;
            const closing = item.canonical?.closingRank ?? item.raw?.closingRank ?? item.closingRank;
            
            if (opening && typeof opening === 'number' && opening < summary.bestOpening) {
                summary.bestOpening = opening;
            }
            if (closing && typeof closing === 'number' && closing > summary.worstClosing) {
                summary.worstClosing = closing;
            }
        });
        
        // Convert Sets to arrays for easier rendering
        Object.keys(courseSummaries).forEach(courseKey => {
            const summary = courseSummaries[courseKey];
            summary.quotas = Array.from(summary.quotas);
            summary.rounds = Array.from(summary.rounds);
            summary.bestOpening = summary.bestOpening === Infinity ? null : summary.bestOpening;
        });
        
        console.log('[DEBUG] Final hierarchical structure:', Object.keys(hierarchical));
        console.log('[DEBUG] Final course summaries:', Object.keys(courseSummaries));
;
        
        return { hierarchical, courseSummaries };
    }, [data?.items]);

    // SUMMARY STRIP AT TOP: Calculate summary statistics using processed data
    const summary = useMemo(() => {
        const { hierarchical, courseSummaries } = processedData;
        const courseNames = Object.keys(courseSummaries);
        
        if (courseNames.length === 0) return null;
        
        const allQuotas = new Set();
        const allRounds = new Set();
        
        courseNames.forEach(courseName => {
            const summary = courseSummaries[courseName];
            summary.quotas.forEach(quota => allQuotas.add(quota));
            summary.rounds.forEach(round => allRounds.add(round));
        });
        
        return {
            totalRows: Object.values(courseSummaries).reduce((sum, s) => sum + s.totalEntries, 0),
            uniqueCourses: courseNames.length,
            roundsCovered: allRounds.size,
            quotasCovered: allQuotas.size
        };
    }, [processedData]);    // DEFAULT OPEN STATE: First course, first quota, first round expanded
    useEffect(() => {
        if (processedData.courseSummaries && Object.keys(processedData.courseSummaries).length > 0 && expandedCourses.size === 0) {
            const firstCourse = Object.keys(processedData.courseSummaries)[0];
            const newExpandedCourses = new Set([firstCourse]);
            setExpandedCourses(newExpandedCourses);

            const courseHierarchy = processedData.hierarchical[firstCourse];
            if (courseHierarchy) {
                const firstQuota = Object.keys(courseHierarchy)[0];
                const quotaRounds = courseHierarchy[firstQuota];
                if (quotaRounds) {
                    const firstRound = Object.keys(quotaRounds)[0];
                    setExpandedRounds(new Set([`${firstCourse}-${firstQuota}-${firstRound}`]));
                }
            }
        }
    }, [processedData.courseSummaries]);

    const toggleCourse = (courseKey) => {
        const newExpanded = new Set(expandedCourses);
        if (newExpanded.has(courseKey)) {
            newExpanded.delete(courseKey);
        } else {
            newExpanded.add(courseKey);
        }
        setExpandedCourses(newExpanded);
    };

    const toggleRound = (courseKey, quotaName, roundName) => {
        const roundKey = `${courseKey}-${quotaName}-${roundName}`;
        const newExpanded = new Set(expandedRounds);
        if (newExpanded.has(roundKey)) {
            newExpanded.delete(roundKey);
        } else {
            newExpanded.add(roundKey);
        }
        setExpandedRounds(newExpanded);
    };

    useEffect(() => {
        if (!collegeId) return;

        const load = async () => {
            try {
                setIsLoading(true);
                const result = await fetchCollegeTruthCutoffs(collegeId);
                setData(result);
            } catch (err) {
                if (err.response?.status !== 404) {
                    console.error("Failed to load truth cutoffs", err);
                    setError("Unable to connect to truth engine.");
                } else {
                    setData({ sectionStatus: 'official_data_unavailable' });
                }
            } finally {
                setIsLoading(false);
            }
        };

        load();
    }, [collegeId]);

    if (isLoading) {
        return (
            <div className="truth-section-loading">
                <span className="spinner"></span>
                Loading Evaluated Cutoff History...
            </div>
        );
    }

    if (error) {
        return (
            <GlassPanel className="truth-error-state">
                <div className="te-icon">⚠️</div>
                <div className="te-text">{error}</div>
            </GlassPanel>
        );
    }

    if (!data || data.sectionStatus === 'official_data_unavailable' || !data.items || data.items.length === 0) {
        return (
            <GlassPanel className="truth-empty-state">
                <div className="te-icon">🚫</div>
                <h3 className="te-title">Official data unavailable</h3>
                <p className="te-desc">No current evaluated official source is linked for admission cutoffs for this year.</p>
            </GlassPanel>
        );
    }

    return (
        <div className="truth-cutoffs-section fade-in">
            <SectionTrustSummary 
                status={data.sectionStatus}
                freshnessStatus={data.freshnessStatus}
                primarySource={data.primarySource}
                lastEvaluatedAt={data.lastEvaluatedAt}
                titleOverride="Evaluated Cutoff History & Admission Thresholds"
            />

            {/* INTEL OVERVIEW STRIP */}
            {summary && (
                <div className="cutoffs-intel-strip">
                    <div className="ci-item">
                        <span className="ci-label">PROGRAMS</span>
                        <span className="ci-value">{summary.uniqueCourses}</span>
                    </div>
                    <div className="ci-item">
                        <span className="ci-label">DATA POINTS</span>
                        <span className="ci-value">{summary.totalRows}</span>
                    </div>
                    <div className="ci-item">
                        <span className="ci-label">ADMISSION TYPE</span>
                        <span className="ci-value text-indigo">{summary.quotasCovered > 1 ? 'Multi-Quota' : 'Direct/Merit'}</span>
                    </div>
                </div>
            )}

            {/* COURSE LIST */}
            <div className="cutoffs-list-v4">
                {Object.entries(processedData.courseSummaries).map(([courseName, courseSummary]) => (
                    <div key={courseName} className={`cutoff-unit-v4 ${expandedCourses.has(courseName) ? 'is-expanded' : ''}`}>
                        <div className="cu-header-v4" onClick={() => toggleCourse(courseName)}>
                            <div className="cu-info-v4">
                                <h3 className="cu-title-v4">{courseName}</h3>
                                <div className="cu-meta-v4">
                                    <span className="cu-tag">{courseSummary.quotas.join(' • ')}</span>
                                    <span className="cu-tag">{courseSummary.rounds.length} Rounds</span>
                                </div>
                            </div>
                            <div className="cu-intel-v4">
                                {courseSummary.bestOpening && (
                                    <div className="cu-metric-v4">
                                        <span className="cu-m-lab">BEST RANK</span>
                                        <span className="cu-m-val highlight">{courseSummary.bestOpening}</span>
                                    </div>
                                )}
                                <div className="cu-toggle-v4">
                                    {expandedCourses.has(courseName) ? 'Close' : 'Inspect'}
                                </div>
                            </div>
                        </div>

                        {expandedCourses.has(courseName) && (
                            <div className="cu-content-v4">
                                {Object.entries(processedData.hierarchical[courseName]).map(([quotaName, rounds]) => (
                                    <div key={quotaName} className="quota-group-v4">
                                        <div className="qg-header-v4">
                                            <span className="qg-label-v4">{quotaName} Admissions</span>
                                        </div>
                                        {Object.entries(rounds).map(([roundName, roundItems]) => {
                                            const roundKey = `${courseName}-${quotaName}-${roundName}`;
                                            const isExpanded = expandedRounds.has(roundKey);
                                            
                                            return (
                                                <div key={roundName} className={`round-group-v4 ${isExpanded ? 'is-open' : ''}`}>
                                                    <div className="rg-header-v4" onClick={() => toggleRound(courseName, quotaName, roundName)}>
                                                        <div className="rg-title-v4">
                                                            <span className="rg-num-v4">Round {roundName}</span>
                                                            <span className="rg-meta-v4">{roundItems.length} categories</span>
                                                        </div>
                                                        <span className="rg-icon-v4">{isExpanded ? '−' : '+'}</span>
                                                    </div>

                                                    {isExpanded && (
                                                        <div className="rg-table-scroller-v4">
                                                            <table className="light-cutoff-table-v4">
                                                                <thead>
                                                                    <tr>
                                                                        <th>Category</th>
                                                                        <th>Seat Type / Gender</th>
                                                                        <th>Opening</th>
                                                                        <th>Closing Rank</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {roundItems.map((item, idx) => (
                                                                        <tr key={idx}>
                                                                            <td className="c-cat-v4">{item.canonical?.category || "Open"}</td>
                                                                            <td className="c-meta-v4">
                                                                                <span className="c-sub-pill">{item.raw?.seatType || "Gen"}</span>
                                                                                <span className="c-sub-pill">{item.raw?.gender || "Neutral"}</span>
                                                                            </td>
                                                                            <td className="c-rank-v4">{item.canonical?.openingRank || "—"}</td>
                                                                            <td className="c-rank-v4 c-closing-v4">{item.canonical?.closingRank || "—"}</td>
                                                                        </tr>
                                                                    ))}
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {data.hasConflict && (
                <div className="truth-section-disclaimer">
                    ℹ️ Semantic conflicts resolved. Displaying primary deterministic values.
                </div>
            )}
        </div>
    );
}
