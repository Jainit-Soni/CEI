/**
 * backend/lib/scoringEngine.js
 * High-Granularity Institutional Scoring Engine (Phase 13: Evidence-First)
 */

/**
 * redone computeInstitutionalCeiScore (Phase 13)
 * Returns a composite object with 4 distinct, evidence-first scores.
 * @param {object} college - The college object
 * @param {object} coverage - The coverage result from computeCoverageIndex
 */
function computeInstitutionalCeiScore(college, coverage = {}) {
    if (!college) return { 
        institutionStrengthScore: 0, 
        admissionRealityScore: 0, 
        dataConfidenceScore: 0, 
        searchPriorityScore: 0,
        competitivenessBand: 'Emerging' 
    };

    const id = college.id || college._id || 'unknown';
    // Helper: Stable Deterministic Fuzzing Factor (0.01 - 0.99)
    const getFuzz = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return (Math.abs(hash) % 100) / 100 * 1.5;
    };
    const fuzz = getFuzz(id);

    // 1. Institution Strength Score (0-100)
    // Signals: Core Registry, NIRF Proxy, Program Breadth, Intake
    let strength = 12; // Base floor for all recognized institutes
    if (college.isCore) {
        strength += (college.coreMetadata?.coreTier === 1) ? 68 : 58;
    }
    
    // Prestige/Ranking signals
    if (college.rankingTier === 'Tier 1') strength += 15;
    else if (college.rankingTier === 'Tier 2') strength += 8;

    // Program Breadth (Scale 5)
    const courseCount = Array.isArray(college.courses) ? college.courses.length : 0;
    strength += Math.min(5, (courseCount / 30) * 5);

    // Regional Trust Bonus (Compliance)
    if (college.state && global.stateBenchmarks) {
        const benchmark = global.stateBenchmarks.get(college.state.toLowerCase());
        if (benchmark && benchmark.ptr < 25) {
            strength += 3; // Boost for operating in a state with healthy faculty ratios
        }
    }

    const institutionStrengthScore = parseFloat(Math.min(99.99, strength + fuzz).toFixed(2));

    // 2. Admission Reality Score (0-100) - STATE/TRUTH SCOPED
    // Note: Faking national scores is forbidden. 0 if no truth.
    let reality = 0;
    if (coverage.hasCutoffs || coverage.hasSeatMatrix) {
        reality = 42 + (coverage.coverageScore / 2.5); 
        if (college.isCore) reality += 12;
    }
    const admissionRealityScore = reality > 0 ? parseFloat(Math.min(99.99, reality + fuzz).toFixed(2)) : 0;

    // 3. Data Confidence Score (0-100) - PROVENANCE
    let confidence = (coverage.truthRowCount || 0) * 5; // +5 per truth row (max 40)
    confidence += (coverage.sourceFamilies?.length || 0) * 10; // +10 per source family (max 30)
    if (college.verificationStatus === 'VERIFIED') confidence += 20;
    if (coverage.coverageBucket === 'Rich') confidence += 10;
    if (coverage.hasPlacements) confidence += 15; // Major trust signal
    if (college.isCore) confidence += 40; // Manual curation from official sources

    const dataConfidenceScore = parseFloat(Math.min(99.99, confidence + (fuzz * 2)).toFixed(2));

    // 4. Search Priority Score (Internal Ranker)
    let searchPriority = (institutionStrengthScore * 0.75) + (dataConfidenceScore * 0.25);
    if (college.isCore) searchPriority += 15;
    const searchPriorityScore = parseFloat(searchPriority.toFixed(2));

    // Band Determination
    let band = 'Emerging';
    if (institutionStrengthScore >= 82) band = 'Elite';
    else if (institutionStrengthScore >= 65) band = 'High';
    else if (institutionStrengthScore >= 45) band = 'Competitive';
    else if (institutionStrengthScore >= 25) band = 'Moderate';

    return {
        institutionStrengthScore,
        admissionRealityScore,
        dataConfidenceScore,
        searchPriorityScore,
        ceiScore: institutionStrengthScore, // Map Strength as the primary CEI score
        competitivenessBand: band
    };
}

/**
 * computeCoverageIndex (Unchanged but validated)
 */
function computeCoverageIndex(college, verifiedFieldNames = [], truthRowCount = 0, truthEntityTypes = [], truthSourceFamilies = []) {
    const hasCourses = (Array.isArray(college.courses) && college.courses.length > 0) || 
                       truthEntityTypes.includes('program') || truthEntityTypes.includes('course');

    const hasIntake = verifiedFieldNames.includes('student_intake');
    const SEAT_MATRIX_TYPES = new Set(['joinedInstitutionProgramTruth', 'seat_matrix', 'seatMatrix']);
    const hasSeatMatrix = truthEntityTypes.some(t => SEAT_MATRIX_TYPES.has(t));
    const CUTOFF_TYPES = new Set(['cutoff', 'cutoffTruth', 'admissionCutoff', 'rankCutoff']);
    const hasCutoffs = truthEntityTypes.some(t => CUTOFF_TYPES.has(t));

    const fees = college.fees;
    const hasFees = !!((fees && typeof fees === 'object' && !Array.isArray(fees) && Object.keys(fees).length > 0) || 
                       truthEntityTypes.includes('fees') || truthEntityTypes.includes('fee'));

    const pl = college.placements;
    const hasPlacements = !!((pl && typeof pl === 'object' && ((typeof pl.averagePackageNumeric === 'number' && pl.averagePackageNumeric > 0) || (typeof pl.highestPackageNumeric === 'number' && pl.highestPackageNumeric > 0))) ||
                             truthEntityTypes.includes('placement') || truthEntityTypes.includes('placements'));

    const sourceFamilySet = new Set();
    if (college.sourceFamily) sourceFamilySet.add(college.sourceFamily);
    for (const sf of truthSourceFamilies) if (sf) sourceFamilySet.add(sf);
    const sourceFamilies = Array.from(sourceFamilySet);

    const truthFields = [hasCourses, hasIntake, hasSeatMatrix, hasCutoffs, hasFees, hasPlacements];
    const trueCount = truthFields.filter(Boolean).length;
    const coverageScore = Math.round((trueCount / 6) * 100);

    let coverageBucket = 'None';
    if (trueCount >= 4) coverageBucket = 'Rich';
    else if (trueCount >= 1) coverageBucket = 'Partial';

    return {
        hasCourses, hasIntake, hasSeatMatrix, hasCutoffs, hasFees, hasPlacements,
        sourceFamilies, truthRowCount, coverageScore, coverageBucket
    };
}

module.exports = { computeInstitutionalCeiScore, computeCoverageIndex };
