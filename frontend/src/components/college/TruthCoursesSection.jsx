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
                <h3 className="te-title">Official program data unavailable</h3>
                <p className="te-desc">No current evaluated official source is linked for academic programs for this institution.</p>
            </GlassPanel>
        );
    }

    return (
        <div className="truth-courses-section fade-in">
            <SectionTrustSummary 
                status={data.sectionStatus}
                trustMetadata={data.trustMetadata}
                titleOverride="Official Academic Programs & Curriculum"
            />

            <div className="courses-intel-strip">
                <div className="cis-item">
                    <span className="cis-val">{data.totalCount}</span>
                    <span className="cis-lab">Indexed Programs</span>
                </div>
            </div>

            <div className="courses-catalog-v4">
                {(data.items || []).map((course, idx) => (
                    <div key={idx} className="course-card-v4">
                        <div className="cc-header">
                            <h4 className="cc-title">{course.name}</h4>
                            <span className="cc-degree">{course.degree}</span>
                        </div>
                        <div className="cc-body">
                            {course.specialization && (
                                <div className="cc-spec">
                                    <span className="cc-label">Specialization</span>
                                    <span className="cc-value">{course.specialization}</span>
                                </div>
                            )}
                            <div className="cc-footer">
                                <span className="cc-tag">Duration: {course.duration}</span>
                                {course.university && <span className="cc-tag">Univ: {course.university}</span>}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
