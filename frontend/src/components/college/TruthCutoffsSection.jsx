import React, { useState, useEffect, useMemo } from 'react';
import { fetchEngineeringCutoffs } from '@/lib/api';
import SectionTrustSummary from '../Truth/SectionTrustSummary';
import SourcePopover from '../Truth/SourcePopover';
import GlassPanel from '../GlassPanel';
import './TruthCutoffsSection.css';

/**
 * TruthCutoffsSection.jsx — Final Implementation with Smart Grouping
 * ================================================================
 * Premium CEI-style admissions explorer with intelligent duplicate reduction.
 */
export default function TruthCutoffsSection({ collegeId, collegeName, cutoffSearchName }) {
    const [allItems, setAllItems] = useState([]);
    const [meta, setMeta] = useState(null);
    const [page, setPage] = useState(1);
    const [initialLoading, setInitialLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState(null);
    const [isTruncated, setIsTruncated] = useState(false);
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
        // Prefer stable identity: id or entityKey if available
        if (item._id) return item._id;
        if (item.entityKey) return item.entityKey;
        
        // Fallback to semantic key
        const courseName = item.programTitle || item.programName || item.canonical?.canonicalCourseName || item.raw?.programName || item.courseName || null;
        const rawQuota = item.quotaLabel || item.canonical?.quota || item.raw?.quota || item.quota || null;
        const normalizedQuota = normalizeQuota(rawQuota);
        const round = item.roundLabel || item.roundNumber || item.canonical?.round || item.raw?.round || item.round || null;
        
        const seatType = item.categoryLabel || item.raw?.seatType || item.seatType || null;
        const gender = item.genderLabel || item.raw?.gender || item.gender || null;
        
        return `${courseName}|${normalizedQuota}|${round}|${seatType}|${gender}`;
    };

    // GROUPING STRUCTURE: Group cutoffs hierarchically with smart user-friendly grouping
    const processedData = useMemo(() => {
        if (!allItems || allItems.length === 0) return { hierarchical: {}, courseSummaries: {} };
        
        // Remove exact duplicates first
        const seenKeys = new Set();
        const uniqueItems = allItems.filter(item => {
            const key = createDedupeKey(item);
            if (seenKeys.has(key)) return false;
            seenKeys.add(key);
            return true;
        });
        
        // Create unique items for hierarchy
        const hierarchical = {};
        const courseSummaries = {};
        
        uniqueItems.forEach(item => {
            const courseKey = item.programTitle || item.programName || item.canonical?.canonicalCourseName || item.raw?.programName || item.courseName || null;
            const courseDisplayKey = courseKey || "Unknown Course";
            const rawQuota = item.quotaLabel || item.canonical?.quota || item.raw?.quota || item.quota || null;
            const normalizedQuota = normalizeQuota(rawQuota);
            const roundKey = item.roundLabel || item.roundNumber || item.canonical?.round || item.raw?.round || item.round || null;
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
            
            const opening = item.openingRank ?? item.canonical?.openingRank ?? item.raw?.openingRank ?? item.openingRank;
            const closing = item.closingRank ?? item.canonical?.closingRank ?? item.raw?.closingRank ?? item.closingRank;
            
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
        
        return { hierarchical, courseSummaries };
    }, [allItems]);

    // SUMMARY STRIP AT TOP
    const summary = useMemo(() => {
        const { courseSummaries } = processedData;
        const courseNames = Object.keys(courseSummaries);
        if (courseNames.length === 0) return null;
        
        const allQuotas = new Set();
        const allRounds = new Set();
        courseNames.forEach(courseName => {
            const s = courseSummaries[courseName];
            s.quotas.forEach(q => allQuotas.add(q));
            s.rounds.forEach(r => allRounds.add(r));
        });
        
        return {
            totalRows: Object.values(courseSummaries).reduce((sum, s) => sum + s.totalEntries, 0),
            uniqueCourses: courseNames.length,
            roundsCovered: allRounds.size,
            quotasCovered: allQuotas.size
        };
    }, [processedData]);

    // FETCH LOGIC
    const loadCutoffsBatch = async (targetPage, isInitial = false) => {
        if (!collegeName && !cutoffSearchName) return;
        
        try {
            if (isInitial) {
                setInitialLoading(true);
                setAllItems([]);
            } else {
                setLoadingMore(true);
            }
            setError(null);
            
            const params = {
                institutionId: collegeId,
                instituteName: cutoffSearchName || collegeName,
                counsellingYear: 2025,
                limit: 200, // Safe batch size
                page: targetPage
            };

            const result = await fetchEngineeringCutoffs(params);
            
            if (result.items && result.items.length > 0) {
                setAllItems(prev => isInitial ? result.items : [...prev, ...result.items]);
                setMeta(result.meta);
                setPage(result.meta.page);
                setIsTruncated(result.meta.hasNextPage);
            } else if (isInitial) {
                setMeta({ sectionStatus: 'official_data_unavailable' });
            }
        } catch (err) {
            console.error("Failed to load official cutoffs", err);
            setError("Unable to connect to JoSAA/CSAB truth engine.");
        } finally {
            setInitialLoading(false);
            setLoadingMore(false);
        }
    };

    // Initial Load Effect
    useEffect(() => {
        loadCutoffsBatch(1, true);
    }, [collegeName, cutoffSearchName]);

    const handleLoadMore = () => {
        if (meta?.hasNextPage && !loadingMore) {
            loadCutoffsBatch(page + 1, false);
        }
    };

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

    // DEFAULT OPEN STATE: First course, first quota, first round expanded
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

    if (initialLoading) {
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

    if (!meta || meta.sectionStatus === 'official_data_unavailable' || allItems.length === 0) {
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
                status="available"
                freshnessStatus="up_to_date"
                primarySource="JoSAA/CSAB official"
                lastEvaluatedAt={new Date().toISOString()}
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
                                                                            <td className="c-cat-v4">
                                                                                {item.categoryLabel || item.canonical?.category || "Open"}
                                                                            </td>
                                                                            <td className="c-meta-v4">
                                                                                <span className="c-sub-pill">{item.quotaLabel || item.raw?.seatType || "Gen"}</span>
                                                                                <span className="c-sub-pill">{item.genderLabel || item.raw?.gender || "Neutral"}</span>
                                                                            </td>
                                                                            <td className="c-rank-v4">{item.openingRank ?? item.canonical?.openingRank ?? "—"}</td>
                                                                            <td className="c-rank-v4 c-closing-v4">{item.closingRank ?? item.canonical?.closingRank ?? "—"}</td>
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

            {/* HONESTY & PAGINATION */}
            <div className="cutoffs-pagination-footer">
                {isTruncated ? (
                    <div className="truth-section-warning">
                        ⚠️ Showing {allItems.length} of {meta?.total || '...'} official cutoff rows.
                        <button 
                            className="load-more-btn" 
                            onClick={handleLoadMore}
                            disabled={loadingMore}
                        >
                            {loadingMore ? 'Loading Batch...' : 'Load Complete Official History'}
                        </button>
                    </div>
                ) : allItems.length > 0 && (
                    <div className="truth-section-disclaimer">
                        ✓ All {allItems.length} official cutoff rows for this college are currently loaded.
                    </div>
                )}
            </div>
        </div>
    );
}
