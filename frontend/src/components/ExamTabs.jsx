"use client";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import GlassPanel from './GlassPanel';
import Pagination from './Pagination';
import './ExamTabs.css';

import { searchAll, fetchExamColleges } from '@/lib/api';

export default function ExamTabs({ exam }) {
    const [activeTab, setActiveTab] = useState('overview');

    // Colleges Tab State
    const [targetColleges, setTargetColleges] = useState(exam?.acceptedCollegesResolved || []);
    const [isLoadingColleges, setIsLoadingColleges] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedState, setSelectedState] = useState('');
    const [selectedDistrict, setSelectedDistrict] = useState('');
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [totalColleges, setTotalColleges] = useState(exam?.acceptedCount || 0);
    const [totalPages, setTotalPages] = useState(1);

    // Available States for dropdown
    const [availableStates, setAvailableStates] = useState([]);

    // Debounce for search
    const searchTimeout = useRef(null);

    const loadColleges = useCallback(async (pageNum, query, stateFilter = selectedState, districtFilter = selectedDistrict, append = false) => {
        if (!exam?.id) return;
        setIsLoadingColleges(true);
        try {
            const res = await fetchExamColleges(exam.id, { page: pageNum, limit: 18, q: query, state: stateFilter, district: districtFilter });
            if (res && res.data) {
                setTargetColleges(prev => append ? [...prev, ...res.data] : res.data);
                setHasMore(res.pagination.hasNext);
                setTotalColleges(res.pagination.totalCount);
                setTotalPages(res.pagination.totalPages);
            }
        } catch (error) {
            console.error("Failed to load exam colleges:", error);
        } finally {
            setIsLoadingColleges(false);
        }
    }, [exam?.id, selectedState, selectedDistrict]);

    // Initial load when switching to colleges tab
    useEffect(() => {
        // Fetch global state list once for the dropdown
        import('@/lib/api').then(({ fetchFilters }) => {
            fetchFilters().then(data => {
                if (data && data.states) setAvailableStates(data.states);
            }).catch(e => console.error(e));
        });
    }, []);

    useEffect(() => {
        if (activeTab === 'colleges' && targetColleges.length <= 50 && page === 1 && !searchQuery && !selectedState && !selectedDistrict) {
            loadColleges(1, '', '', '', false);
        }
    }, [activeTab, loadColleges, targetColleges.length, page, searchQuery, selectedState, selectedDistrict]);

    const handleSearchChange = (e) => {
        const val = e.target.value;
        setSearchQuery(val);
        setPage(1);

        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => {
            loadColleges(1, val, selectedState, selectedDistrict, false);
        }, 500);
    };

    const handleStateChange = (e) => {
        const val = e.target.value;
        setSelectedState(val);
        setPage(1);
        loadColleges(1, searchQuery, val, selectedDistrict, false);
    };

    const handleDistrictChange = (e) => {
        const val = e.target.value;
        setSelectedDistrict(val);
        setPage(1);

        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => {
            loadColleges(1, searchQuery, selectedState, val, false);
        }, 500);
    };

    const handleLoadMore = () => {
        const nextPage = page + 1;
        setPage(nextPage);
        loadColleges(nextPage, searchQuery, selectedState, selectedDistrict, false);
    };

    if (!exam) return null;

    const tabs = [
        { id: 'overview', label: 'Briefing' },
        { id: 'timeline', label: 'Timeline' },
        { id: 'syllabus', label: 'Intel (Syllabus)' },
        { id: 'prep', label: 'Training' },
        { id: 'colleges', label: 'Targets (Colleges)' },
    ];

    return (
        <div className="mission-tabs-container">
            {/* Navigation Tabs */}
            <div className="mission-tabs-nav">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        className={`mission-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.id)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Content Area */}
            <div className="mission-tabs-content" style={{ minHeight: '600px' }}>

                {/* 1. OVERVIEW TAB */}
                {activeTab === 'overview' && (
                    <div className="tab-pane fade-in">
                        <div className="mission-grid-2">
                            <div className="mission-card">
                                <h3 className="card-header">Mission Profile</h3>
                                <p className="mission-text">
                                    {exam.name} ({exam.shortName}) is a {exam.level || "national"}-level
                                    entrance exam conducted by {exam.conductingBody}.
                                    It is the gateway for admission into {exam.courses?.join(", ")} courses.
                                </p>
                                <div className="tags-row">
                                    {(exam.courses || []).map(c => <span key={c} className="mission-tag">{c}</span>)}
                                </div>
                            </div>

                            <div className="mission-card">
                                <h3 className="card-header">Target Parameters</h3>
                                {exam.safeScore ? (
                                    <div className="safe-score-box">
                                        <div className="sc-item">
                                            <span className="sc-label">Min Qualifying</span>
                                            <span className="sc-val">{exam.safeScore.min}</span>
                                        </div>
                                        <div className="sc-divider"></div>
                                        <div className="sc-item highlight">
                                            <span className="sc-label">Safe Target</span>
                                            <span className="sc-val">{exam.safeScore.target}</span>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="no-data">Intel pending.</p>
                                )}
                            </div>

                            <div className="mission-card wide">
                                <h3 className="card-header">Marking Protocol</h3>
                                {exam.markingScheme ? (
                                    <div className="marking-grid">
                                        <div className="mark-item positive">
                                            <span className="mark-val">+{exam.markingScheme.correct}</span>
                                            <span className="mark-desc">Correct</span>
                                        </div>
                                        <div className="mark-item negative">
                                            <span className="mark-val">-{exam.markingScheme.incorrect}</span>
                                            <span className="mark-desc">Incorrect</span>
                                        </div>
                                        <div className="mark-item neutral">
                                            <span className="mark-val">0</span>
                                            <span className="mark-desc">Unattempted</span>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="no-data">Standard marking scheme applies.</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* 2. TIMELINE TAB */}
                {activeTab === 'timeline' && (
                    <div className="tab-pane fade-in">
                        <div className="mission-card">
                            <h3 className="card-header">Operation Schedule</h3>
                            {exam.dates ? (
                                <div className="timeline-stepper">
                                    <div className="step-item">
                                        <div className="step-marker"></div>
                                        <div className="step-content">
                                            <span className="step-date mono">{exam.dates.registration}</span>
                                            <span className="step-title">Registration Phase</span>
                                        </div>
                                    </div>
                                    <div className="step-item active">
                                        <div className="step-marker pulse"></div>
                                        <div className="step-content">
                                            <span className="step-date mono">{exam.dates.examWindow}</span>
                                            <span className="step-title">Execution (Exam) Date</span>
                                        </div>
                                    </div>
                                    <div className="step-item">
                                        <div className="step-marker"></div>
                                        <div className="step-content">
                                            <span className="step-date mono">{exam.dates.result}</span>
                                            <span className="step-title">Debrief (Result)</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p>Dates classified.</p>
                            )}
                        </div>
                    </div>
                )}

                {/* 3. SYLLABUS TAB */}
                {activeTab === 'syllabus' && (
                    <div className="tab-pane fade-in">
                        <div className="mission-grid-2">
                            <div className="mission-card">
                                <h3 className="card-header">Exam Pattern</h3>
                                {exam.pattern && exam.pattern.length > 0 ? (
                                    <ul className="custom-list">
                                        {exam.pattern.map((p, i) => <li key={i}>{p}</li>)}
                                    </ul>
                                ) : (
                                    <p className="no-data">Pattern details not available yet.</p>
                                )}
                            </div>
                            {/* Only show syllabus card if syllabus is genuinely different from pattern */}
                            {exam.syllabus && exam.syllabus.length > 0 && JSON.stringify(exam.syllabus) !== JSON.stringify(exam.pattern) && (
                                <div className="mission-card">
                                    <h3 className="card-header">Syllabus Sections</h3>
                                    <div className="syllabus-tags">
                                        {exam.syllabus.map(s => (
                                            <span key={s} className="mission-chip">{s}</span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 4. PREP TAB */}
                {activeTab === 'prep' && (
                    <div className="tab-pane fade-in">
                        <div className="mission-grid-2">
                            {exam.prepResources && exam.prepResources.length > 0 ? (
                                <div className="mission-card">
                                    <h3 className="card-header">Preparation Resources</h3>
                                    <ul className="check-list">
                                        {exam.prepResources.slice(0, 5).map((r, i) => (
                                            <li key={i}><strong>{r.type ? r.type + ": " : ""}</strong>{r.title}</li>
                                        ))}
                                        {exam.prepResources.length > 5 && (
                                            <li className="more-items">+{exam.prepResources.length - 5} more resources availabe in full guide</li>
                                        )}
                                    </ul>
                                </div>
                            ) : (
                                <div className="mission-card">
                                    <h3 className="card-header">Preparation Resources</h3>
                                    <p className="no-data">Exam-specific preparation resources are being curated. Check back soon.</p>
                                </div>
                            )}
                            {exam.pastPapers && exam.pastPapers.length > 0 && (
                                <div className="mission-card">
                                    <h3 className="card-header">Past Papers & Resources</h3>
                                    <ul className="check-list">
                                        {exam.pastPapers.map((p, i) => (
                                            <li key={i}>
                                                <a href={p.url} target="_blank" rel="noopener noreferrer" className="mini-college-card" style={{ display: 'inline-block', textDecoration: 'none' }}>
                                                    {p.label} ↗
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {exam.officialUrl && (
                                <div className="mission-card">
                                    <h3 className="card-header">Official Resources</h3>
                                    <a href={exam.officialUrl} target="_blank" rel="noopener noreferrer" className="mini-college-card" style={{ display: 'inline-block', textDecoration: 'none' }}>
                                        Visit Official Website ↗
                                    </a>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* 5. COLLEGES TAB */}
                {activeTab === 'colleges' && (
                    <div className="tab-pane fade-in">
                        <div className="mission-card">
                            <div className="card-header-flex" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '1rem' }}>
                                    <h3 className="card-header" style={{ margin: 0 }}>Target Institutes ({totalColleges} Accepting {exam.shortName})</h3>
                                    <div className="exam-college-search" style={{ position: 'relative', minWidth: '250px', flex: '1', maxWidth: '400px' }}>
                                        <input
                                            type="text"
                                            placeholder="Search specific colleges..."
                                            value={searchQuery}
                                            onChange={handleSearchChange}
                                            className="retro-input"
                                            style={{ width: '100%', padding: '0.6rem 1rem', borderRadius: '4px', background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.1)', color: '#0f172a' }}
                                        />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', width: '100%' }}>
                                    <select
                                        value={selectedState}
                                        onChange={handleStateChange}
                                        className="retro-input"
                                        style={{ padding: '0.6rem 1rem', borderRadius: '4px', background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.1)', color: '#0f172a', flex: '1', minWidth: '200px' }}
                                    >
                                        <option value="">All States</option>
                                        {availableStates.map(st => (
                                            <option key={st} value={st}>{st}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="text"
                                        placeholder="Specific City / District..."
                                        value={selectedDistrict}
                                        onChange={handleDistrictChange}
                                        className="retro-input"
                                        style={{ padding: '0.6rem 1rem', borderRadius: '4px', background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.1)', color: '#0f172a', flex: '1', minWidth: '200px' }}
                                    />
                                </div>
                            </div>

                            <div className="colleges-grid-mini">
                                {targetColleges.length > 0 ? targetColleges.map((c, i) => {
                                    const id = typeof c === 'object' ? c.id : c;
                                    const name = typeof c === 'object' ? (c.shortName || c.name || c.id) : c;

                                    return (
                                        <a href={`/college/${id}`} key={id || i} className="mini-college-card">
                                            {name}
                                        </a>
                                    );
                                }) : !isLoadingColleges ? (
                                    <p className="no-data" style={{ gridColumn: '1 / -1' }}>No specific colleges found matching your criteria.</p>
                                ) : null}
                            </div>

                            {isLoadingColleges && (
                                <div className="colleges-grid-mini mt-4">
                                    {Array.from({ length: 12 }).map((_, i) => (
                                        <div key={i} className="skeleton-tag skeleton" style={{ width: '100%', height: '42px', borderRadius: '10px' }}></div>
                                    ))}
                                </div>
                            )}

                            {totalPages > 1 && !isLoadingColleges && (
                                <div className="mt-8" style={{ marginTop: '2rem' }}>
                                    <Pagination
                                        page={page}
                                        totalPages={totalPages}
                                        hasNext={hasMore}
                                        hasPrev={page > 1}
                                        onPageChange={(p) => {
                                            setPage(p);
                                            loadColleges(p, searchQuery, false);
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}
