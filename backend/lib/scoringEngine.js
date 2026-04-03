/**
 * backend/lib/scoringEngine.js
 * High-Granularity Institutional Scoring Engine (Phase 14: Scaled & Integrated)
 */

/**
 * computeInstitutionalCeiScore
 * Returns a composite object with 4 distinct scores, calibrated for all 67k colleges.
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
    // Helper: Stable Deterministic Fuzzing Factor
    const getFuzz = (str) => {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return (Math.abs(hash) % 100) / 100 * 0.8;
    };
    const fuzz = getFuzz(id);

    // 1. Institution Strength Score (0-100)
    let strength = 20; // Improved Baseline for recognized institutes
    
    // Core Status Boost (Priority 1)
    if (college.isCore) {
        strength += (college.coreMetadata?.coreTier === 1) ? 65 : 55;
    }
    
    // Prestige/Ranking signals from Registry or NIRF
    const rank = college.ranking || (college.rankings && college.rankings[0]?.rank);
    if (college.rankingTier === 'Tier 1' || (rank > 0 && rank <= 100)) {
        strength += 12;
    } else if (college.rankingTier === 'Tier 2' || (rank > 0 && rank <= 300)) {
        strength += 6;
    }

    // Program Breadth (Scale) - Calibrated for Management vs Engineering
    // Engineering needs ~30 programs for full scale, Management needs ~5.
    const courseCount = Array.isArray(college.courses) ? college.courses.length : 0;
    const isManagement = college.name?.includes('Management') || college.name?.includes('Business') || college.id?.includes('IIM');
    const scaleDivisor = isManagement ? 5 : 35;
    strength += Math.min(3, (courseCount / scaleDivisor) * 3);

    const institutionStrengthScore = parseFloat(Math.min(99.99, strength + fuzz).toFixed(2));

    // 2. Admission Reality Score (0-100)
    let reality = 0;
    if (coverage.hasCutoffs || coverage.hasSeatMatrix || coverage.hasPlacements) {
        reality = 35 + (coverage.coverageScore / 2.5); 
        if (college.isCore) reality += 15;
        // Premium Placement Signal
        const avgPkg = college.placements?.averagePackageNumeric || 0;
        if (avgPkg >= 25) reality += 20;
        else if (avgPkg >= 15) reality += 10;
    }
    const admissionRealityScore = reality > 0 ? parseFloat(Math.min(99.99, reality + fuzz).toFixed(2)) : 0;

    // 3. Data Confidence Score (0-100)
    let confidence = (coverage.truthRowCount || 0) * 10; 
    confidence += (coverage.sourceFamilies?.length || 0) * 15; 
    if (college.verificationStatus === 'VERIFIED') confidence += 20;
    if (coverage.hasPlacements) confidence += 20; 
    if (college.isCore) confidence += 30; 

    const dataConfidenceScore = parseFloat(Math.min(99.99, confidence + (fuzz * 2)).toFixed(2));

    // 4. Search Priority Score
    // Balances strength with data availability
    let searchPriority = (institutionStrengthScore * 0.65) + (dataConfidenceScore * 0.35);
    if (college.isCore) searchPriority += 10;
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
        ceiScore: institutionStrengthScore,
        competitivenessBand: band
    };
}

/**
 * computeCoverageIndex (Scale-Ready)
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
