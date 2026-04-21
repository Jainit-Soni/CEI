'use client';

import React, { useState, useEffect } from 'react';
import { fetchCollegeTruthCourses } from '@/lib/api';
import SectionTrustSummary from '../Truth/SectionTrustSummary';
import GlassPanel from '../GlassPanel';
import './TruthCoursesSection.css';

/**
 * TruthCoursesSection.jsx
 * =======================
 * Displays the unique academic programs for an institution.
 */
export default function TruthCoursesSection({ collegeId }) {
    const [data, setData] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!collegeId) return;

        const load = async () => {
            try {
                setIsLoading(true);
                const result = await fetchCollegeTruthCourses(collegeId);
                setData(result);
            } catch (err) {
                if (err.response?.status !== 404) {
                    console.error("Failed to load truth courses", err);
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
                Loading Official Program Catalog...
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
                <div className="te-icon">📚</div>
                <h3 className="te-title">No course registry available</h3>
                <p className="te-desc">Current evaluated official registry is pending verification for this institution.</p>
            </GlassPanel>
        );
    }

    return (
        <div className="truth-courses-section fade-in">
            <SectionTrustSummary 
                status={data.sectionStatus}
                trustMetadata={{
                    source: data.source,
                    isVerified: !data.fallbackUsed,
                    lastEvaluatedAt: new Date().toISOString() // Placeholder or real if available
                }}
                titleOverride="Official Academic Programs & Curriculum"
            />

            <div className="courses-intel-strip">
                <div className="cis-item">
                    <span className="cis-val">{data.totalCount}</span>
                    <span className="cis-lab">Indexed Program Rows</span>
                </div>
                <div className="cis-item">
                    <span className="cis-lab">{data.source}</span>
                </div>
            </div>

            {data.fallbackUsed && (
                <div className="truth-honesty-banner fallback">
                    <span className="thb-icon">⚠️</span>
                    <span className="thb-text">
                        Showing institution summary courses. Detailed AICTE course registry not available for this college.
                    </span>
                </div>
            )}

            {data.isTruncated && (
                <div className="truth-honesty-banner truncation">
                    <span className="thb-icon">ℹ️</span>
                    <span className="thb-text">
                        Showing first {data.items.length} course offerings. More official rows may exist in the master registry.
                    </span>
                </div>
            )}

            <div className="courses-catalog-v4">
                {(data.items || []).map((course, idx) => (
                    <div key={idx} className="course-card-v4">
                        <div className="cc-header">
                            <h4 className="cc-title">{course.name}</h4>
                            {course.degree && <span className="cc-degree">{course.degree}</span>}
                        </div>
                        <div className="cc-body">
                            <div className="cc-main-meta">
                                {course.programme && (
                                    <div className="cc-meta-row">
                                        <span className="cc-label">Programme</span>
                                        <span className="cc-value">{course.programme}</span>
                                    </div>
                                )}
                                <div className="cc-grid-meta">
                                    {course.intake && (
                                        <div className="cc-meta-item">
                                            <span className="cc-label">Intake</span>
                                            <span className="cc-value-bold">{course.intake}</span>
                                        </div>
                                    )}
                                    {course.mode && (
                                        <div className="cc-meta-item">
                                            <span className="cc-label">Mode</span>
                                            <span className="cc-value">{course.mode.replace('_', ' ')}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="cc-footer">
                                {course.university && <span className="cc-tag">Univ: {course.university}</span>}
                                {course.year && <span className="cc-tag">Ref: {course.year}</span>}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

