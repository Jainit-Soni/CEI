'use strict';

/**
 * courseOfferingsReadService.js
 * ============================
 * Bridges the gap between institutions and detailed course offerings.
 */

const COLLECTION_NAME = 'course_offerings';
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

/**
 * Fetches course offerings for a college with graceful fallback.
 * 
 * @param {Object} params
 * @param {Object} params.db - Mongo DB instance
 * @param {Object} params.college - College/Institution document
 * @param {number} [params.limit] - Max items to return
 */
async function getCollegeTruthCourses({ db, college, limit = DEFAULT_LIMIT }) {
    if (!db) throw new Error('DB instance required');
    if (!college) throw new Error('College object required');

    const safeLimit = Math.min(Math.max(1, parseInt(limit) || DEFAULT_LIMIT), MAX_LIMIT);
    const institutionId = college.institution_id || college.id;

    let items = [];
    let totalCount = 0;
    let source = 'AICTE Course Registry';
    let fallbackUsed = false;

    // 1. Attempt Primary Truth Query
    if (institutionId) {
        const collection = db.collection(COLLECTION_NAME);
        
        // We query by institution_id as the primary bridge
        const query = { institution_id: institutionId };
        
        totalCount = await collection.countDocuments(query);
        
        if (totalCount > 0) {
            const rawDocs = await collection.find(query)
                .sort({ course_level: 1, course_name: 1 })
                .limit(safeLimit)
                .toArray();

            items = rawDocs.map(doc => ({
                name: doc.course_name,
                degree: doc.course_level,
                programme: doc.programme,
                intake: doc.intake,
                mode: doc.mode,
                university: doc.university,
                year: doc.requested_year_label || null
            }));
            
            // Determine dynamic source label if possible
            const firstWithYear = rawDocs.find(d => d.requested_year_label);
            if (firstWithYear) {
                source = `AICTE Registry (${firstWithYear.requested_year_label})`;
            }
        }
    }

    // 2. Fallback Logic
    if (items.length === 0) {
        fallbackUsed = true;
        source = 'Institution Summary Fallback';
        
        const fallbackCourses = college.courses || [];
        totalCount = fallbackCourses.length;
        
        // Normalize fallback items to same contract
        items = fallbackCourses.slice(0, safeLimit).map(c => ({
            name: c.name || c.degree || 'Unknown Course',
            degree: c.degree || null,
            programme: null,
            intake: c.intake || null,
            mode: null,
            university: null,
            year: null
        }));
    }

    return {
        sectionStatus: items.length > 0 ? 'available' : 'unavailable',
        source,
        fallbackUsed,
        totalCount,
        isTruncated: totalCount > safeLimit,
        items
    };
}

module.exports = {
    getCollegeTruthCourses
};
